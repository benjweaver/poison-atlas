// Reads and validates every species file. Shared by the Vite plugin (dev and
// build) and `npm run validate`, so the checks CI runs are exactly the checks
// the dev server runs.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { parse } from 'yaml'
import { z } from 'zod'

import {
  imageSchema,
  speciesSchema,
  type Evidence,
  type Species,
  type SpeciesFile,
} from '../src/data/schema.ts'

export const ROOT = join(import.meta.dirname, '..')
export const SPECIES_DIR = join(ROOT, 'data', 'species')
export const IMAGES_FILE = join(ROOT, 'data', 'images.json')
export const GBIF_FILE = join(ROOT, 'data', 'gbif.json')
/** Record grids (dots on the map) for each species, served to the browser. */
export const GRID_DIR = join(ROOT, 'public', 'occurrence')
const GEO_DIR = join(ROOT, 'public', 'geo')

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

/** GBIF taxon keys from `npm run ranges`, used to link each species to its records. */
const gbifEntry = z.looseObject({
  key: z.number(),
  countries: z.record(z.string(), z.number()).default({}),
  subdivisions: z.record(z.string(), z.number()).default({}),
  checklist: z.record(z.string(), z.array(z.string())).optional(),
})
export type GbifEntry = z.infer<typeof gbifEntry>

/** What `npm run ranges` learned per species: taxon key, record counts, checklists. */
export function readGbif(): Record<string, GbifEntry> {
  if (!existsSync(GBIF_FILE)) return {}
  return z.record(z.string(), gbifEntry).parse(JSON.parse(readFileSync(GBIF_FILE, 'utf8')))
}

export function speciesFiles(): string[] {
  // Git doesn't keep empty directories, so a checkout with no species has none.
  if (!existsSync(SPECIES_DIR)) return []
  return readdirSync(SPECIES_DIR)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => join(SPECIES_DIR, f))
}

/**
 * What supports each listed place: GBIF records (counted from the record dots
 * when there are any, so the numbers match the map), the checklists that list
 * it, and cited hand-made additions. A country listed whole is supported by
 * records in any of its states.
 */
export function evidenceFor(
  data: SpeciesFile,
  entry: GbifEntry | undefined,
  gridFile?: string,
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
  for (const code of data.regions) {
    const list: Evidence[] = []
    const count = recordsIn(code)
    if (count) list.push({ kind: 'records', count })
    for (const source of entry?.checklist?.[code] ?? []) list.push({ kind: 'checklist', source })
    for (const e of data.gbif?.include ?? []) {
      if (e.code === code) list.push({ kind: 'cited', source: e.source })
    }
    if (data.gbif?.manual && data.gbif.source)
      list.push({ kind: 'cited', source: data.gbif.source })
    result[code] = list
  }
  return result
}

/**
 * Parses and checks every file, collecting all problems before throwing so a
 * contributor sees the full list at once rather than one error per run.
 */
export function loadSpecies(regions = knownRegions()): Species[] {
  const images = readImages()
  const gbif = readGbif()
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
    const seen = new Set<string>()
    for (const code of data.regions) {
      if (seen.has(code)) problems.push(`${where}: region ${code} is listed twice`)
      seen.add(code)
      if (!regions.has(code)) problems.push(`${where}: unknown region code ${code}`)
    }
    for (const { code } of [...(data.gbif?.exclude ?? []), ...(data.gbif?.include ?? [])]) {
      if (!regions.has(code)) problems.push(`${where}: unknown region code ${code} in gbif`)
    }
    // Listing "US" and "US-AZ" together is ambiguous: is it the whole country
    // or just Arizona? The map would show the whole country, so say which.
    for (const code of data.regions) {
      if (code.includes('-') && seen.has(code.slice(0, 2))) {
        problems.push(
          `${where}: lists both ${code.slice(0, 2)} and ${code} — use the country or its states, not both`,
        )
      }
    }

    const gridFile = join(GRID_DIR, `${slug}.json`)
    const records = existsSync(gridFile)
    const evidence = evidenceFor(data, gbif[slug], records ? gridFile : undefined)
    for (const code of data.regions) {
      if (!evidence[code]?.length) {
        problems.push(
          `${where}: ${code} is listed with no source (no records, checklist or citation)`,
        )
      }
    }
    if (data.gbif?.manual && !data.gbif.source) {
      problems.push(`${where}: a hand-kept range (gbif.manual) needs gbif.source`)
    }
    // Places listed without a single record: from checklists or citations.
    const unrecorded = records
      ? data.regions.filter((code) => !evidence[code]?.some((e) => e.kind === 'records'))
      : undefined
    species.push({
      ...data,
      slug,
      image: images[slug],
      gbifKey: gbif[slug]?.key,
      records,
      unrecorded,
      evidence,
    })
  }

  if (problems.length) throw new DataError(problems)
  return species
}
