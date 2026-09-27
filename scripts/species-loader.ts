// Reads and validates every species file. Shared by the Vite plugin (dev and
// build) and `npm run validate`, so the checks CI runs are exactly the checks
// the dev server runs.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { parse } from 'yaml'
import { z } from 'zod'

import {
  imageSchema,
  poisonCentreSchema,
  speciesSchema,
  type Evidence,
  type PoisonCentre,
  type Species,
  type SpeciesFile,
} from '../src/data/schema.ts'
import { definitePlaces, placeStatus, type Status, type TdwgMap } from './tdwg.ts'

export const ROOT = join(import.meta.dirname, '..')
export const SPECIES_DIR = join(ROOT, 'data', 'species')
export const IMAGES_FILE = join(ROOT, 'data', 'images.json')
export const GBIF_FILE = join(ROOT, 'data', 'gbif.json')
export const TDWG_FILE = join(ROOT, 'data', 'tdwg.json')
export const CENTRES_FILE = join(ROOT, 'data', 'poison-centres.yaml')
/** Record grids (dots on the map) for each species, served to the browser. */
export const GRID_DIR = join(ROOT, 'public', 'occurrence')
const GEO_DIR = join(ROOT, 'public', 'geo')

/** How the site names WCVP when citing it. */
export const WCVP_NAME = 'World Checklist of Vascular Plants'

export class DataError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`species data has ${problems.length} problem(s):\n  ${problems.join('\n  ')}`)
    this.problems = problems
  }
}

/** Every region code the map can draw: countries plus each country's subdivisions. */
export function knownRegions(): Set<string> {
  const codes = new Set<string>()
  const countries = JSON.parse(readFileSync(join(GEO_DIR, 'countries.json'), 'utf8'))
  for (const f of countries.features) codes.add(f.properties.code)
  for (const file of readdirSync(join(GEO_DIR, 'admin1'))) {
    const admin1 = JSON.parse(readFileSync(join(GEO_DIR, 'admin1', file), 'utf8'))
    for (const f of admin1.features) codes.add(f.properties.code)
  }
  return codes
}

export function readImages(): Record<string, z.infer<typeof imageSchema>> {
  if (!existsSync(IMAGES_FILE)) return {}
  return z.record(z.string(), imageSchema).parse(JSON.parse(readFileSync(IMAGES_FILE, 'utf8')))
}

/** How WCVP's botanical countries line up with the map (scripts/tdwg.ts). */
export function readTdwg(): TdwgMap {
  return JSON.parse(readFileSync(TDWG_FILE, 'utf8')) as TdwgMap
}

/** What `npm run ranges` learned per species: taxon key, record counts, checklists. */
const gbifEntry = z.looseObject({
  key: z.number(),
  countries: z.record(z.string(), z.number()).default({}),
  subdivisions: z.record(z.string(), z.number()).default({}),
  checklist: z.record(z.string(), z.array(z.string())).optional(),
  introduced: z.record(z.string(), z.array(z.string())).optional(),
  wcvp: z.record(z.string(), z.enum(['native', 'introduced'])).optional(),
})
export type GbifEntry = z.infer<typeof gbifEntry>

export function readGbif(): Record<string, GbifEntry> {
  if (!existsSync(GBIF_FILE)) return {}
  return z.record(z.string(), gbifEntry).parse(JSON.parse(readFileSync(GBIF_FILE, 'utf8')))
}

export function speciesFiles(): string[] {
  return readdirSync(SPECIES_DIR)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => join(SPECIES_DIR, f))
}

/** A listed place's status: which of the species' two lists it's in. */
function statusIn(data: SpeciesFile, code: string): Status {
  return data.introduced?.includes(code) ? 'introduced' : 'native'
}

/**
 * What supports each listed place, native or introduced: GBIF records (counted
 * from the record dots when there are any, so the numbers match the map), the
 * checklists that list it with that status, and cited hand-made additions. A
 * country listed whole is supported by records in any of its states.
 */
export function evidenceFor(
  data: SpeciesFile,
  entry: GbifEntry | undefined,
  gridFile?: string,
  tdwg?: TdwgMap,
): Record<string, Evidence[]> {
  const cells = gridFile
    ? (JSON.parse(readFileSync(gridFile, 'utf8')) as [number, number, number, string?][])
    : []
  // Records in the place's dots, or else GBIF's count for it: a territory
  // smaller than a grid cell (Hong Kong, Washington DC) can share its dot with
  // a neighbour but still has its own records.
  const recordsIn = (code: string) =>
    cells.reduce((n, c) => (c[3] === code || c[3]?.startsWith(`${code}-`) ? n + c[2] : n), 0) ||
    (entry?.subdivisions[code] ?? entry?.countries[code] ?? 0)
  const result: Record<string, Evidence[]> = {}
  for (const code of [...data.regions, ...(data.introduced ?? [])]) {
    const status = statusIn(data, code)
    const list: Evidence[] = []
    const count = recordsIn(code)
    if (count) list.push({ kind: 'records', count })
    if (entry?.wcvp && tdwg && placeStatus(code, entry.wcvp, tdwg) === status) {
      list.push({ kind: 'checklist', source: WCVP_NAME })
    }
    // Native-range checklists support the place itself; registers of
    // introductions only its status, so a state takes its country's.
    const sources =
      status === 'native'
        ? (entry?.checklist?.[code] ?? [])
        : (entry?.introduced?.[code] ?? entry?.introduced?.[code.slice(0, 2)] ?? [])
    for (const source of sources) list.push({ kind: 'checklist', source })
    for (const e of data.gbif?.include ?? []) {
      if (e.code === code) list.push({ kind: 'cited', source: e.source })
    }
    if (data.gbif?.manual && data.gbif.source) {
      list.push({ kind: 'cited', source: data.gbif.source })
    }
    result[code] = list
  }
  return result
}

/**
 * Whether a place's evidence is enough to list it: records, a citation, a
 * native-range checklist, or WCVP for a place that stands for a whole
 * botanical country. WCVP for part of a wider unit ("Mexico Northwest"), or an
 * introduced-species register, only says what status a place has, not that
 * the species is there.
 */
function sufficient(
  code: string,
  status: Status,
  evidence: Evidence[],
  entry: GbifEntry | undefined,
  tdwg: TdwgMap,
): boolean {
  return evidence.some((e) => {
    if (e.kind !== 'checklist') return true
    if (e.source === WCVP_NAME) {
      return !!entry?.wcvp && definitePlaces(entry.wcvp, tdwg)[code] === status
    }
    return status === 'native'
  })
}

/**
 * Parses and checks every file, collecting all problems before throwing so a
 * contributor sees the full list at once rather than one error per run.
 */
export function loadSpecies(regions = knownRegions()): Species[] {
  const images = readImages()
  const gbif = readGbif()
  const tdwg = readTdwg()
  const problems: string[] = []
  const species: Species[] = []

  for (const file of speciesFiles()) {
    const slug = basename(file, '.yaml')
    const where = `data/species/${slug}.yaml`

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      problems.push(`${where}: file name must be lowercase-with-dashes`)
    }

    let raw: unknown
    try {
      raw = parse(readFileSync(file, 'utf8'))
    } catch (e) {
      problems.push(`${where}: invalid YAML — ${(e as Error).message.split('\n')[0]}`)
      continue
    }

    const result = speciesSchema.safeParse(raw)
    if (!result.success) {
      for (const issue of result.error.issues) {
        problems.push(`${where}: ${issue.path.join('.') || '(root)'} — ${issue.message}`)
      }
      continue
    }

    const data = result.data
    const listed = [...data.regions, ...(data.introduced ?? [])]
    const seen = new Set<string>()
    for (const code of listed) {
      if (seen.has(code)) {
        problems.push(
          data.regions.includes(code) && data.introduced?.includes(code)
            ? `${where}: ${code} is listed as both native and introduced`
            : `${where}: region ${code} is listed twice`,
        )
      }
      seen.add(code)
      if (!regions.has(code)) problems.push(`${where}: unknown region code ${code}`)
    }
    for (const { code } of [...(data.gbif?.exclude ?? []), ...(data.gbif?.include ?? [])]) {
      if (!regions.has(code)) problems.push(`${where}: unknown region code ${code} in gbif`)
    }
    // Listing "US" and "US-AZ" together is ambiguous: is it the whole country
    // or just Arizona? The map would show the whole country, so say which.
    // That holds across the two lists too.
    for (const code of listed) {
      if (code.includes('-') && seen.has(code.slice(0, 2))) {
        problems.push(
          `${where}: lists both ${code.slice(0, 2)} and ${code} — use the country or its states, not both`,
        )
      }
    }

    const entry = gbif[slug]
    const gridFile = join(GRID_DIR, `${slug}.json`)
    const records = existsSync(gridFile)
    const evidence = evidenceFor(data, entry, records ? gridFile : undefined, tdwg)
    // A water species' places are its dots' territories, so an include can
    // correct a place's status but not add a place with no dot.
    if (data.aquatic) {
      for (const { code } of data.gbif?.include ?? []) {
        if (!evidence[code]?.some((e) => e.kind === 'records')) {
          problems.push(
            `${where}: gbif.include ${code} has no record dots — on a water species, an include can only correct a place's status`,
          )
        }
      }
    }
    for (const code of listed) {
      if (!sufficient(code, statusIn(data, code), evidence[code] ?? [], entry, tdwg)) {
        problems.push(
          `${where}: ${code} is listed with no source (no records, checklist or citation)`,
        )
      }
    }
    // A plant's status is WCVP's unless a citation says otherwise.
    if (entry?.wcvp) {
      const cited = new Set(data.gbif?.include?.map((e) => e.code))
      for (const code of listed) {
        const wcvp = placeStatus(code, entry.wcvp, tdwg)
        if (wcvp && wcvp !== statusIn(data, code) && !cited.has(code)) {
          problems.push(
            `${where}: ${code} is listed as ${statusIn(data, code)}, but WCVP has it as ${wcvp} — cite a source in gbif.include to differ`,
          )
        }
      }
    }
    if (data.gbif?.manual && !data.gbif.source) {
      problems.push(`${where}: a hand-kept range (gbif.manual) needs gbif.source`)
    }
    // Places listed without a single record: from checklists or citations.
    const unrecorded = records
      ? listed.filter((code) => !evidence[code]?.some((e) => e.kind === 'records'))
      : undefined
    species.push({
      ...data,
      slug,
      image: images[slug],
      gbifKey: entry?.key,
      records,
      unrecorded,
      evidence,
    })
  }

  // Lookalikes that are in the atlas link to their page, and each page lists
  // the atlas species that name it as a lookalike without being named back.
  const byName = new Map(species.map((s) => [s.scientificName, s]))
  for (const s of species) {
    s.lookalikes = s.lookalikes?.map((l) => {
      const other = byName.get(l.scientificName)
      if (other === s) problems.push(`data/species/${s.slug}.yaml: lists itself as a lookalike`)
      return other ? { ...l, slug: other.slug } : l
    })
  }
  for (const s of species) {
    for (const l of s.lookalikes ?? []) {
      const other = l.slug ? species.find((o) => o.slug === l.slug) : undefined
      if (!other || other === s || other.lookalikes?.some((m) => m.slug === s.slug)) continue
      ;(other.resembledBy ??= []).push({ slug: s.slug, name: s.name })
    }
  }

  if (problems.length) throw new DataError(problems)
  return species
}

/**
 * Poison centres by country, validated like the species: every country code
 * must be one the map knows, and every entry needs its source and date.
 */
export function loadPoisonCentres(regions = knownRegions()): Record<string, PoisonCentre> {
  if (!existsSync(CENTRES_FILE)) return {}
  const where = 'data/poison-centres.yaml'
  const problems: string[] = []
  let raw: unknown
  try {
    raw = parse(readFileSync(CENTRES_FILE, 'utf8')) ?? {}
  } catch (e) {
    throw new DataError([`${where}: invalid YAML — ${(e as Error).message.split('\n')[0]}`])
  }
  const result = z.record(z.string(), poisonCentreSchema).safeParse(raw)
  if (!result.success) {
    throw new DataError(
      result.error.issues.map((i) => `${where}: ${i.path.join('.') || '(root)'} — ${i.message}`),
    )
  }
  for (const code of Object.keys(result.data)) {
    if (!/^[A-Z]{2}$/.test(code) || !regions.has(code)) {
      problems.push(`${where}: ${code} isn't a country on the map`)
    }
  }
  if (problems.length) throw new DataError(problems)
  return result.data
}
