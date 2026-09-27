// Turns GBIF occurrence counts and checklists into proposed native and
// introduced places.
//
// Pure and unit-tested; scripts/ranges.ts does the fetching and file writing.
//
// GBIF is the largest open collection of "this was recorded here", but raw
// records are noisy: garden plants, pets, misidentifications, a museum label
// with the wrong coordinates. So a place only counts when it has enough wild
// records (ranges.ts has already dropped the ones GBIF marks as cultivated or
// captive), and a person reviews every proposal before it lands, with
// `gbif.exclude` to reject a place for good and `gbif.include` to add one the
// data misses or to correct its status.
//
// Records are wildly uneven: 120,000 sightings of a species from Britain and
// the Netherlands against a few dozen from Belarus, where it's just as common.
// So the share threshold is kept tiny (it only catches strays on the most
// recorded species), and the minimum count scales with how well recorded the
// species is: 2 for rarely recorded species, up to 5.
//
// Whether a place is native or introduced comes from checklists
// (scripts/checklist.ts). For plants that's WCVP, which also decides whether a
// place is listed at all: records of a plant in a place WCVP doesn't list are
// garden plants or casual escapes far more often than a population it missed.
import type { Checklists } from './checklist.ts'
import { definitePlaces, placeStatus, type Status, type TdwgMap } from './tdwg.ts'

/** Countries shown by state/province. Chosen where Natural Earth's and GADM's
 *  subdivisions line up and the country is big enough that "found somewhere
 *  in it" says little. Everywhere else is listed as a whole country. */
export const SUBDIVIDED = new Set(['US', 'CA', 'MX', 'AU', 'BR', 'AR', 'IN', 'CN', 'ZA', 'JP'])

export interface GbifCounts {
  total: number
  /** ISO 3166-1 alpha-2 → records */
  countries: Record<string, number>
  /** ISO 3166-2 (as in public/geo) → records */
  subdivisions: Record<string, number>
}

export interface RangeRules {
  /** A place needs at least this share of the species' records as a count... */
  minRecordsShare: number
  /** ...clamped to this range... */
  minRecordsFloor: number
  minRecordsCeiling: number
  /** ...and at least this share of the species' records. */
  minShare: number
  /** Records a subdivided country needs before it's listed whole, when no state qualifies. */
  countryFallback: number
  /** If set, a place whose records are all from iNaturalist needs this many. */
  inatFloor?: number
}

export const DEFAULT_RULES: RangeRules = {
  minRecordsShare: 0.01,
  minRecordsFloor: 2,
  minRecordsCeiling: 5,
  minShare: 0.0002,
  countryFallback: 25,
}

/**
 * Fungi are identified from photos more often than anything else here, and
 * the deadly ones have deadly lookalikes (destroying angels in particular),
 * so their places need more records, and more again when every record is an
 * iNaturalist photo rather than a fungarium specimen or a survey.
 */
export const FUNGUS_RULES: RangeRules = {
  ...DEFAULT_RULES,
  minRecordsFloor: 3,
  minRecordsCeiling: 10,
  minShare: 0.0005,
  inatFloor: 10,
}

export function minRecords(total: number, rules: RangeRules = DEFAULT_RULES): number {
  const scaled = Math.ceil(total * rules.minRecordsShare)
  return Math.min(rules.minRecordsCeiling, Math.max(rules.minRecordsFloor, scaled))
}

export interface Overrides {
  exclude?: string[]
  /** Places to list whatever the data says, as native unless marked introduced. */
  include?: { code: string; introduced?: boolean }[]
}

/** The codes out of a species file's cited `gbif.include` / `gbif.exclude`. */
export function overridesOf(gbif?: {
  exclude?: { code: string }[]
  include?: { code: string; introduced?: true }[]
}): Overrides {
  return {
    exclude: gbif?.exclude?.map((e) => e.code),
    include: gbif?.include?.map((e) => ({ code: e.code, introduced: !!e.introduced })),
  }
}

const excluder = (overrides: Overrides) => {
  const excluded = new Set(overrides.exclude ?? [])
  return (code: string) => excluded.has(code) || excluded.has(code.slice(0, 2))
}

/**
 * Places with enough wild records to count: whole countries, or states in the
 * countries shown by state. `inat` is the part of the counts that came from
 * iNaturalist, for rules with an `inatFloor`.
 *
 * `confirmed` names places a checklist says are native range (for a plant,
 * WCVP's botanical country). They need the minimum count but not the share:
 * that share is what drops Georgia, in giant hogweed's native range, next to
 * the hundreds of thousands of records from where it's invasive.
 */
export function recordedPlaces(
  counts: GbifCounts,
  overrides: Overrides = {},
  rules: RangeRules = DEFAULT_RULES,
  inat?: GbifCounts,
  confirmed: (code: string) => boolean = () => false,
): string[] {
  const isExcluded = excluder(overrides)
  const floor = minRecords(counts.total, rules)
  const enough = (n: number, code: string, fromInat = 0) =>
    n >= floor &&
    (n >= counts.total * rules.minShare || confirmed(code)) &&
    (rules.inatFloor === undefined || n - fromInat >= floor || fromInat >= rules.inatFloor)

  const regions = new Set<string>()
  for (const [country, n] of Object.entries(counts.countries)) {
    if (!enough(n, country, inat?.countries[country]) || isExcluded(country)) continue
    if (!SUBDIVIDED.has(country)) {
      regions.add(country)
      continue
    }
    const states = Object.entries(counts.subdivisions).filter(
      ([code, m]) =>
        code.startsWith(`${country}-`) &&
        enough(m, code, inat?.subdivisions[code]) &&
        !isExcluded(code),
    )
    if (states.length) {
      for (const [code] of states) regions.add(code)
    } else if (n >= rules.countryFallback) {
      // Plenty of records but none tied to a state (usually at sea, off the
      // coast): the country is proven, just not where in it.
      regions.add(country)
    }
    // Otherwise a handful of scattered records, like 8 yellow-bellied sea
    // snakes around the US, would list the species "country-wide" in every
    // state from California to South Carolina. Leave it for review instead.
  }
  return [...regions].sort()
}

export interface RangeDiff {
  added: string[]
  removed: string[]
  kept: string[]
}

export function diffRegions(current: string[], proposed: string[]): RangeDiff {
  const now = new Set(current)
  const next = new Set(proposed)
  return {
    added: proposed.filter((c) => !now.has(c)),
    removed: current.filter((c) => !next.has(c)),
    kept: proposed.filter((c) => now.has(c)),
  }
}

/**
 * Places for an aquatic species: every territory with a record dot, minus
 * exclusions. Each dot's territory is GBIF's own attribution (see
 * scripts/ranges.ts), and any dot counts: a lone record at sea is far more
 * likely to be real than one on land, where zoo animals and pets turn up.
 * The site draws a dot only when its territory is listed (or it's in open
 * ocean), so the dots and the list always agree.
 */
export function regionsFromCells(
  cells: { code: string | null; n: number }[],
  overrides: Overrides = {},
): string[] {
  const isExcluded = excluder(overrides)
  const regions = new Set<string>()
  for (const { code } of cells) if (code && !isExcluded(code)) regions.add(code)
  return [...regions].sort()
}

export interface Proposal {
  native: string[]
  introduced: string[]
  /** Places with records that aren't listed, and why, for the reviewer. */
  unlisted: { code: string; why: string }[]
}

/**
 * Splits a species' places into native and introduced, and adds the places
 * checklists establish on their own.
 *
 * Plants: WCVP decides. A place with records is listed with WCVP's status
 * there, or not at all if WCVP doesn't list it. A botanical country that one
 * place holds (US-AL for "Alabama") is listed even without records.
 *
 * Everything else: native-range checklists add their countries, as native
 * (except the countries shown by state, which still need records at state
 * level). A place with records is introduced where a register or checklist
 * says so and no native-range checklist disagrees, and native otherwise.
 *
 * Then exclusions, and cited includes, which also settle a place's status.
 */
export function propose(
  recorded: string[],
  checklists: Pick<Checklists, 'native' | 'introduced' | 'wcvp'>,
  {
    plant = false,
    tdwg,
    overrides = {},
  }: { plant?: boolean; tdwg?: TdwgMap; overrides?: Overrides },
): Proposal {
  const isExcluded = excluder(overrides)
  const status = new Map<string, Status>()
  const unlisted: Proposal['unlisted'] = []
  if (plant) {
    if (!tdwg) throw new Error('plants need the botanical-country map (data/tdwg.json)')
    for (const code of recorded) {
      // WCVP gives the states themselves, so a plant is never listed whole in
      // a country shown by state.
      if (SUBDIVIDED.has(code)) {
        unlisted.push({ code, why: 'records not tied to a state' })
        continue
      }
      const s = placeStatus(code, checklists.wcvp, tdwg)
      if (s) status.set(code, s)
      else unlisted.push({ code, why: 'not in WCVP here: garden plants or casual escapes?' })
    }
    for (const [code, s] of Object.entries(definitePlaces(checklists.wcvp, tdwg))) {
      if (!status.has(code)) status.set(code, s)
    }
  } else {
    for (const code of recorded) {
      const country = code.slice(0, 2)
      const introduced = !!checklists.introduced[country] && !checklists.native[country]
      status.set(code, introduced ? 'introduced' : 'native')
    }
    for (const code of Object.keys(checklists.native)) {
      if (!SUBDIVIDED.has(code)) status.set(code, 'native')
    }
  }
  for (const code of [...status.keys()]) if (isExcluded(code)) status.delete(code)
  for (const { code, introduced } of overrides.include ?? []) {
    status.set(code, introduced ? 'introduced' : 'native')
  }
  // A country listed whole replaces its states, since the loader forbids both.
  for (const code of [...status.keys()]) {
    if (code.length > 2 && status.has(code.slice(0, 2))) status.delete(code)
  }
  const list = (s: Status) =>
    [...status]
      .filter(([, v]) => v === s)
      .map(([code]) => code)
      .sort()
  return { native: list('native'), introduced: list('introduced'), unlisted }
}
