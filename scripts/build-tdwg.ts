// Lines up WCVP's botanical countries (WGSRPD level 3) with the map's places.
//
//   npm run tdwg
//
// Writes data/tdwg.json (see scripts/tdwg.ts). Like the boundaries, the output
// is committed and only needs rebuilding when the map's outlines change. The
// level-3 shapes come from TDWG's own copy of the standard and are cached in
// .cache/, not committed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { SUBDIVIDED } from './gbif-range.ts'
import { shapeOf, type Outline } from './polygons.ts'
import { lineUp } from './tdwg.ts'

const ROOT = join(import.meta.dirname, '..')
const SOURCE = 'https://raw.githubusercontent.com/tdwg/wgsrpd/master/geojson/level3.geojson'
const CACHE = join(ROOT, '.cache', 'wgsrpd', 'level3.geojson')
const OUT = join(ROOT, 'data', 'tdwg.json')

if (!existsSync(CACHE)) {
  console.log(`downloading ${SOURCE}`)
  const res = await fetch(SOURCE)
  if (!res.ok) throw new Error(`${SOURCE}: HTTP ${res.status}`)
  mkdirSync(join(ROOT, '.cache', 'wgsrpd'), { recursive: true })
  writeFileSync(CACHE, Buffer.from(await res.arrayBuffer()))
}

interface Level3 {
  properties: { LEVEL3_COD: string; LEVEL3_NAM: string }
  geometry: Outline['geometry']
}
const level3 = (JSON.parse(readFileSync(CACHE, 'utf8')) as { features: Level3[] }).features
const regions = level3.map((f) =>
  shapeOf({ properties: { code: f.properties.LEVEL3_COD }, geometry: f.geometry }),
)
const names = Object.fromEntries(
  level3.map((f) => [f.properties.LEVEL3_COD, f.properties.LEVEL3_NAM]),
)

// The map's finest places: states in the countries shown by state, and every
// other country whole.
const geo = (file: string) =>
  (JSON.parse(readFileSync(join(ROOT, 'public', 'geo', file), 'utf8')) as { features: Outline[] })
    .features
const places = [
  ...geo('countries.json').filter((f) => !SUBDIVIDED.has(f.properties.code)),
  ...[...SUBDIVIDED].flatMap((country) => geo(`admin1/${country}.json`)),
].map(shapeOf)

const started = Date.now()
const map = lineUp(regions, names, places)
const sorted = <T>(record: Record<string, T>) =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(
  OUT,
  JSON.stringify({ regions: sorted(map.regions), places: sorted(map.places) }, null, 2) + '\n',
)

const unplaced = Object.entries(map.regions).filter(([, r]) => !r.places.length)
const shared = Object.entries(map.regions).filter(([, r]) => !r.main && r.places.length)
const uncovered = places.filter((p) => !map.places[p.code]).map((p) => p.code)
console.log(
  `✓ ${regions.length} botanical countries over ${places.length} places in ${((Date.now() - started) / 1000).toFixed(0)} s`,
)
console.log(`  on no place (too small for the map): ${unplaced.map(([c]) => c).join(' ') || '–'}`)
console.log(`  spread over several places, with none holding most of it: ${shared.length}`)
console.log(`  places no botanical country covers: ${uncovered.join(' ') || '–'}`)
