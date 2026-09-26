import type { Feature, FeatureCollection, Geometry, Point, Position } from 'geojson'

export interface RegionProps {
  code: string
  name: string
  /** Wikidata id, used to link to the region's Wikipedia article. */
  wikidata?: string
  /** On a species' range: false where it's known without any records. */
  recorded?: boolean
  continent?: string
  count?: number
}

export type Regions = FeatureCollection<Geometry, RegionProps>

const cache = new Map<string, Promise<Regions | null>>()

/**
 * Fetches a JSON data file, or null if there isn't one. A missing file isn't
 * always a 404: the dev server and hosts with a single-page-app fallback
 * answer with index.html and a 200, so the content type is what's checked.
 */
function fetchJson<T>(url: string): Promise<T | null> {
  return fetch(url)
    .then((r) =>
      r.ok && r.headers.get('content-type')?.includes('json') ? (r.json() as Promise<T>) : null,
    )
    .catch(() => null)
}

// Files live in public/geo, resolved against Vite's BASE_URL ("/" by default).
function load(path: string): Promise<Regions | null> {
  let pending = cache.get(path)
  if (!pending) {
    pending = fetchJson<Regions>(`${import.meta.env.BASE_URL}geo/${path}`)
    cache.set(path, pending)
  }
  return pending
}

export async function loadCountries(): Promise<Regions> {
  const countries = await load('countries.json')
  if (!countries) throw new Error('countries.json is missing — run: npm run boundaries')
  return countries
}

/** States/provinces for one country, or null for countries Natural Earth doesn't subdivide. */
export function loadSubdivisions(country: string): Promise<Regions | null> {
  return load(`admin1/${country}.json`)
}

export type Water = FeatureCollection<Geometry, { kind: 'river' | 'lake'; rank: number }>

/** Major rivers and lakes, drawn under everything for context. */
export async function loadWater(): Promise<{ rivers: Water; lakes: Water } | null> {
  const [rivers, lakes] = await Promise.all([load('rivers.json'), load('lakes.json')])
  return rivers && lakes
    ? { rivers: rivers as unknown as Water, lakes: lakes as unknown as Water }
    : null
}

/** Grid cells where an aquatic species has been recorded: record count, and the territory the dot belongs to (null in open ocean). */
export type RecordPoints = FeatureCollection<Point, { n: number; code: string | null }>

const records = new Map<string, Promise<RecordPoints | null>>()

export function loadRecords(slug: string): Promise<RecordPoints | null> {
  let pending = records.get(slug)
  if (!pending) {
    pending = fetchJson<[number, number, number, (string | null)?][]>(
      `${import.meta.env.BASE_URL}occurrence/${slug}.json`,
    ).then((cells) =>
      cells
        ? {
            type: 'FeatureCollection',
            features: cells.map(([lon, lat, n, code]) => ({
              type: 'Feature',
              properties: { n, code: code ?? null },
              geometry: { type: 'Point', coordinates: [lon, lat] },
            })),
          }
        : null,
    )
    records.set(slug, pending)
  }
  return pending
}

export type BBox = [west: number, south: number, east: number, north: number]

/**
 * Bounding box of some features. Countries that straddle the 180° meridian
 * (Russia, Fiji, the Aleutians) would otherwise get a box spanning the whole
 * planet, so the box is also measured with longitudes shifted into 0–360 and
 * the narrower of the two wins. MapLibre accepts an east edge beyond 180.
 */
export function bbox(features: Feature<Geometry>[]): BBox | null {
  let w = Infinity
  let e = -Infinity
  let w360 = Infinity
  let e360 = -Infinity
  let s = Infinity
  let n = -Infinity
  const visit = (coords: unknown): void => {
    if (typeof (coords as Position)[0] === 'number') {
      const [x, y] = coords as Position
      const x360 = x < 0 ? x + 360 : x
      w = Math.min(w, x)
      e = Math.max(e, x)
      w360 = Math.min(w360, x360)
      e360 = Math.max(e360, x360)
      s = Math.min(s, y)
      n = Math.max(n, y)
    } else {
      for (const c of coords as unknown[]) visit(c)
    }
  }
  for (const f of features) {
    if (f.geometry.type === 'GeometryCollection') {
      for (const g of f.geometry.geometries) if ('coordinates' in g) visit(g.coordinates)
    } else {
      visit(f.geometry.coordinates)
    }
  }
  if (w === Infinity) return null
  return e360 - w360 < e - w ? [w360, s, e360, n] : [w, s, e, n]
}

function polygons(geometry: Geometry): Position[][][] {
  if (geometry.type === 'Polygon') return [geometry.coordinates]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates
  return []
}

// Planar area of a ring, scaled by latitude so high-latitude islands don't
// outweigh their true size. Only used to compare parts of one country.
function ringArea(ring: Position[]): number {
  let sum = 0
  let lat = 0
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    lat += ring[i][1]
  }
  return (Math.abs(sum) / 2) * Math.cos(((lat / (ring.length - 1)) * Math.PI) / 180)
}

// Degrees of empty space between two boxes (0 if they touch or overlap),
// measured the short way round the antimeridian.
function gap(a: BBox, b: BBox): number {
  const lng = Math.min(
    ...[-360, 0, 360].map((shift) => Math.max(0, a[0] - (b[2] + shift), b[0] + shift - a[2])),
  )
  const lat = Math.max(0, a[1] - b[3], b[1] - a[3])
  return Math.max(lng, lat)
}

const polygonFeature = (coordinates: Position[][]): Feature<Geometry> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates },
})

/**
 * The box to zoom to for one country or state. Framing every part of a
 * country is useless for France (French Guiana and Réunion would put the
 * camera over the Atlantic) or the US (Guam, Hawaii), so this frames the
 * largest landmass plus any part that is either big or close to it —
 * which keeps Tasmania, Corsica and Alaska but drops far-flung territories.
 */
export function frameBox(feature: Feature<Geometry>): BBox | null {
  const parts = polygons(feature.geometry)
  if (parts.length <= 1) return bbox([feature])
  const areas = parts.map((p) => ringArea(p[0]))
  const largest = Math.max(...areas)
  const main = bbox([polygonFeature(parts[areas.indexOf(largest)])])!
  const keep = parts.filter((part, i) => {
    if (areas[i] >= largest * 0.2) return true
    return gap(main, bbox([polygonFeature(part)])!) <= 5
  })
  return bbox(keep.map(polygonFeature))
}

/**
 * The English Wikipedia article for a region. Going through Wikidata finds the
 * right article even when a name is ambiguous ("Santa Catarina" is a Brazilian
 * state, several towns and a saint).
 */
export function wikipediaUrl(name: string, wikidata?: string): string {
  return wikidata
    ? `https://www.wikidata.org/wiki/Special:GoToLinkedPage/enwiki/${wikidata}`
    : `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(name)}`
}
