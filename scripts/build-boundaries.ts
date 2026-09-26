// Regenerates the map outlines in public/geo from Natural Earth.
//
//   npm run boundaries
//
// The output is committed, so this only needs running to change the level of
// detail or pick up a new Natural Earth release — never as part of a build.
// Deploys stay offline and deterministic.
//
//   public/geo/countries.json      every country, keyed by ISO 3166-1 alpha-2,
//                                  with its Wikidata id (for Wikipedia links)
//   public/geo/admin1/<CC>.json    that country's states/provinces, keyed by
//                                  ISO 3166-2 — fetched only when a country is
//                                  opened, so the first load stays small.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { normalizeName } from './checklist.ts'

const root = join(import.meta.dirname, '..')
const cache = join(root, '.cache', 'natural-earth')
const out = join(root, 'public', 'geo')
const mapshaper = join(root, 'node_modules', '.bin', 'mapshaper')

const SOURCES = {
  countries:
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',
  admin1:
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson',
  rivers:
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson',
  lakes:
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_lakes.geojson',
  land: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson',
}

async function download(name: string, url: string): Promise<string> {
  const file = join(cache, `${name}.geojson`)
  if (existsSync(file)) return file
  console.log(`downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  return file
}

function run(...args: string[]) {
  execFileSync(mapshaper, [...args, '-quiet'], { stdio: 'inherit' })
}

mkdirSync(cache, { recursive: true })
const countriesSrc = await download('countries', SOURCES.countries)
const admin1Src = await download('admin1', SOURCES.admin1)
const riversSrc = await download('rivers', SOURCES.rivers)
const lakesSrc = await download('lakes', SOURCES.lakes)
const landSrc = await download('land', SOURCES.land)

// Countries. ISO_A2 is "-99" for France and Norway (a Natural Earth quirk);
// ISO_A2_EH fills those in. Territories sharing a code (e.g. Australia's
// Indian Ocean islands) are dissolved into their parent so one code = one shape.
mkdirSync(out, { recursive: true })
run(
  countriesSrc,
  '-filter',
  'ISO_A2_EH !== "-99"',
  '-dissolve',
  'ISO_A2_EH',
  'copy-fields=NAME,CONTINENT,WIKIDATAID',
  '-rename-fields',
  'code=ISO_A2_EH,name=NAME,continent=CONTINENT,wikidata=WIKIDATAID',
  '-simplify',
  '20%',
  'keep-shapes',
  '-o',
  join(out, 'countries.json'),
  'format=geojson',
  'precision=0.001',
)

// States/provinces, one file per country. Dissolving on the ISO code merges
// outlying pieces that share a code (Lord Howe Island is part of AU-NSW).
const admin1Out = join(out, 'admin1')
rmSync(admin1Out, { recursive: true, force: true })
mkdirSync(admin1Out, { recursive: true })
run(
  admin1Src,
  '-filter',
  'iso_a2 && iso_a2 !== "-1" && iso_a2 !== "-99" && iso_3166_2 && iso_3166_2.indexOf("~") === -1',
  '-dissolve',
  'iso_3166_2',
  'copy-fields=name,iso_a2,wikidataid',
  '-rename-fields',
  'code=iso_3166_2,wikidata=wikidataid',
  '-simplify',
  '8%',
  'keep-shapes',
  '-split',
  'iso_a2',
  '-filter-fields',
  'code,name,wikidata',
  '-o',
  admin1Out + '/',
  'format=geojson',
  'precision=0.001',
)

// Natural Earth draws France as one shape that includes its overseas
// departments, so "FR" would light up French Guiana and Réunion too. Each has
// its own ISO 3166-1 code, so split them out into countries of their own.
// The admin-1 file has an outline for each; any part of France's shape that
// falls inside one moves to the new country.
const OVERSEAS: Record<string, { code: string; name: string; continent: string }> = {
  'FR-GF': { code: 'GF', name: 'French Guiana', continent: 'South America' },
  'FR-GP': { code: 'GP', name: 'Guadeloupe', continent: 'North America' },
  'FR-MQ': { code: 'MQ', name: 'Martinique', continent: 'North America' },
  'FR-RE': { code: 'RE', name: 'Réunion', continent: 'Africa' },
  'FR-YT': { code: 'YT', name: 'Mayotte', continent: 'Africa' },
}

type Ring = [number, number][]
interface Feature {
  type: 'Feature'
  properties: Record<string, string>
  geometry:
    { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] }
}

const readLayer = (file: string): Feature[] => JSON.parse(readFileSync(file, 'utf8')).features
// One feature per line keeps diffs of the generated files reviewable.
const writeLayer = (file: string, features: Feature[]) =>
  writeFileSync(
    file,
    `{"type":"FeatureCollection","features":[\n${features.map((f) => JSON.stringify(f)).join(',\n')}\n]}\n`,
  )
const partsOf = (f: Feature): Ring[][] =>
  f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates

function boxOf(parts: Ring[][]): [number, number, number, number] {
  const points = parts.flat(2)
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

const countriesFile = join(out, 'countries.json')
const frFile = join(admin1Out, 'FR.json')
const countries = readLayer(countriesFile)
const frAdmin1 = readLayer(frFile)
const france = countries.find((f) => f.properties.code === 'FR')!
let franceParts = partsOf(france)

for (const region of frAdmin1.filter((f) => OVERSEAS[f.properties.code])) {
  const [w, s, e, n] = boxOf(partsOf(region))
  const inside = (part: Ring[]) => {
    const [x, y] = part[0][0]
    return x >= w - 0.5 && x <= e + 0.5 && y >= s - 0.5 && y <= n + 0.5
  }
  const moved = franceParts.filter(inside)
  franceParts = franceParts.filter((part) => !inside(part))
  // Use the admin-1 outline when the country layer dropped a tiny island.
  const coordinates = moved.length ? moved : partsOf(region)
  countries.push({
    type: 'Feature',
    properties: { ...OVERSEAS[region.properties.code], wikidata: region.properties.wikidata },
    geometry: { type: 'MultiPolygon', coordinates },
  })
}
france.geometry = { type: 'MultiPolygon', coordinates: franceParts }
writeLayer(countriesFile, countries)
writeLayer(
  frFile,
  frAdmin1.filter((f) => !OVERSEAS[f.properties.code]),
)

// All land, for the coastline: sea animals recorded far from it are errors
// (see scripts/assign-cells.ts). From the detailed 1:10m layer, because the
// 1:50m outlines fill in fjords and inlets (Oslo harbour would count as 60 km
// inland). Used by scripts only, never sent to the browser.
run(
  landSrc,
  '-each',
  'code="LAND"',
  '-filter-fields',
  'code',
  '-simplify',
  '15%',
  'keep-shapes',
  '-o',
  join(root, 'data', 'land.json'),
  'format=geojson',
  'precision=0.001',
)

// Every name Natural Earth knows each country by, for reading country lists
// written as text (GBIF checklist distributions; see scripts/checklist.ts).
{
  const names: Record<string, string> = {}
  const drawn = new Set(readLayer(countriesFile).map((f) => f.properties.code))
  const source = JSON.parse(readFileSync(countriesSrc, 'utf8')) as {
    features: { properties: Record<string, string | null> }[]
  }
  for (const { properties: p } of source.features) {
    const code = p.ISO_A2_EH
    if (!code || !drawn.has(code)) continue
    for (const field of [
      'NAME',
      'NAME_LONG',
      'FORMAL_EN',
      'NAME_EN',
      'NAME_ALT',
      'ADMIN',
      'GEOUNIT',
    ]) {
      const name = p[field]
      if (name) names[normalizeName(name)] ??= code
    }
  }
  for (const { code, name } of Object.values(OVERSEAS)) names[normalizeName(name)] = code
  writeFileSync(
    join(root, 'data', 'country-names.json'),
    JSON.stringify(Object.fromEntries(Object.entries(names).sort()), null, 1) + '\n',
  )
}

// Rivers and lakes, drawn under everything else so freshwater species' record
// dots have the water they follow for context. `rank` is Natural Earth's
// importance (lower = bigger), used to show only major rivers when zoomed out.
run(
  riversSrc,
  '-filter-fields',
  'scalerank',
  '-rename-fields',
  'rank=scalerank',
  '-each',
  'kind="river"',
  '-simplify',
  '30%',
  '-o',
  join(out, 'rivers.json'),
  'format=geojson',
  'precision=0.001',
)
run(
  lakesSrc,
  '-filter-fields',
  'scalerank',
  '-rename-fields',
  'rank=scalerank',
  '-each',
  'kind="lake"',
  '-simplify',
  '30%',
  'keep-shapes',
  '-o',
  join(out, 'lakes.json'),
  'format=geojson',
  'precision=0.001',
)

console.log(`wrote ${readdirSync(admin1Out).length} admin-1 files to ${admin1Out}`)
