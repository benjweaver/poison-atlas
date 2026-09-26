// Turns GBIF occurrence counts into a proposed list of region codes.
//
// Pure and unit-tested; scripts/ranges.ts does the fetching and file writing.
//
// GBIF is the largest open collection of "this animal was recorded here", but
// raw records are noisy: zoo animals, pets, misidentifications, a museum label
// with the wrong coordinates. So a place only counts when it has enough
// records. And a person reviews every proposal before it lands, with
// `gbif.exclude` to reject a place for good and `gbif.include` to add one GBIF
// under-records.
//
// Records are wildly uneven: 120,000 adder sightings, mostly from British and
// Dutch naturalists, against a few dozen from Belarus, where adders are just
// as common. So the share threshold is kept tiny (it only catches strays on
// the most-recorded species), and the minimum count scales with how well
// recorded the species is: 2 for rarely recorded species, up to 5.

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
}

export const DEFAULT_RULES: RangeRules = {
  minRecordsShare: 0.01,
  minRecordsFloor: 2,
  minRecordsCeiling: 5,
  minShare: 0.0002,
  countryFallback: 25,
}

export function minRecords(total: number, rules: RangeRules = DEFAULT_RULES): number {
  const scaled = Math.ceil(total * rules.minRecordsShare)
  return Math.min(rules.minRecordsCeiling, Math.max(rules.minRecordsFloor, scaled))
}

export interface Overrides {
  exclude?: string[]
  include?: string[]
}

/** The codes out of a species file's cited `gbif.include` / `gbif.exclude`. */
export function overridesOf(gbif?: {
  exclude?: { code: string }[]
  include?: { code: string }[]
}): Overrides {
  return {
    exclude: gbif?.exclude?.map((e) => e.code),
    include: gbif?.include?.map((e) => e.code),
  }
}

export function proposeRegions(
  counts: GbifCounts,
  overrides: Overrides = {},
  rules: RangeRules = DEFAULT_RULES,
): string[] {
  const excluded = new Set(overrides.exclude ?? [])
  const isExcluded = (code: string) => excluded.has(code) || excluded.has(code.slice(0, 2))
  const floor = minRecords(counts.total, rules)
  const enough = (n: number) => n >= floor && n >= counts.total * rules.minShare

  const regions = new Set<string>()
  for (const [country, n] of Object.entries(counts.countries)) {
    if (!enough(n) || isExcluded(country)) continue
    if (!SUBDIVIDED.has(country)) {
      regions.add(country)
      continue
    }
    const states = Object.entries(counts.subdivisions).filter(
      ([code, m]) => code.startsWith(`${country}-`) && enough(m) && !isExcluded(code),
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

  for (const code of overrides.include ?? []) regions.add(code)
  // A manual include of a whole country wins over its GBIF-derived states,
  // since the loader forbids listing both.
  for (const code of [...regions]) {
    if (code.length > 2 && regions.has(code.slice(0, 2))) regions.delete(code)
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
  const excluded = new Set(overrides.exclude ?? [])
  const regions = new Set<string>()
  for (const { code } of cells) {
    if (code && !excluded.has(code) && !excluded.has(code.slice(0, 2))) regions.add(code)
  }
  return [...regions].sort()
}

/**
 * Adds countries that checklists say the species is native to (see
 * scripts/checklist.ts), filling places GBIF barely records. Big countries
 * are skipped: listing one whole would mark the species in every state, so
 * those still need records at state level. Exclusions still win.
 */
export function withChecklist(
  regions: string[],
  checklist: string[] = [],
  overrides: Overrides = {},
): string[] {
  const excluded = new Set(overrides.exclude ?? [])
  const result = new Set(regions)
  for (const code of checklist) {
    if (SUBDIVIDED.has(code) || excluded.has(code)) continue
    result.add(code)
  }
  // Cited hand-made additions (also applied to water species' dot-derived lists).
  for (const code of overrides.include ?? []) result.add(code)
  for (const code of [...result]) {
    if (code.length > 2 && result.has(code.slice(0, 2))) result.delete(code)
  }
  return [...result].sort()
}
