// Botanical countries, and how they line up with this map's places.
//
// The World Checklist of Vascular Plants (WCVP) says where each plant is
// native or introduced by "botanical country": the level-3 units of the World
// Geographical Scheme for Recording Plant Distributions (WGSRPD; Brummitt
// 2001). Most are a country or a US state, but not all. "Mexico Northwest" is
// several Mexican states, "Borneo" is three countries, "Ireland" takes
// Northern Ireland from the UK, and the smallest countries sit inside a
// neighbour's unit. data/tdwg.json, built by `npm run tdwg`, records which of
// the map's places each unit covers, found by overlapping their shapes.
//
// Pure, apart from the shapes it's given; scripts/build-tdwg.ts does the I/O.
import { boxOf, distance, inPolygon, inside, type Ring, type Shape } from './polygons.ts'

export type Status = 'native' | 'introduced'

export interface TdwgMap {
  /** Botanical country → its name, the places it overlaps, and the one place
   *  holding nearly all of it, if there is one. */
  regions: Record<string, { name: string; places: string[]; main?: string }>
  /** Place → the botanical countries covering it. */
  places: Record<string, string[]>
}

/** A point in a shape, weighted by the area it stands for (degrees², shrunk by latitude). */
type Sample = { point: [number, number]; weight: number }

// Sample spacing per polygon, in degrees: fine for islands, coarse for Siberia.
const MIN_SPACING = 0.005
const MAX_SPACING = 0.5
const PER_POLYGON = 400

/**
 * A point inside a polygon: the middle of the widest stretch of it along the
 * line of latitude halfway up. Used for polygons too small for the grid.
 */
export function interiorPoint(polygon: Ring[]): [number, number] | null {
  const [, s, , n] = boxOf(polygon[0])
  for (const f of [0.5, 0.3, 0.7, 0.2, 0.8]) {
    const y = s + (n - s) * f
    const xs: number[] = []
    for (const ring of polygon) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi)
      }
    }
    xs.sort((a, b) => a - b)
    let best: [number, number] | null = null
    let widest = 0
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (xs[i + 1] - xs[i] > widest) {
        widest = xs[i + 1] - xs[i]
        best = [(xs[i] + xs[i + 1]) / 2, y]
      }
    }
    if (best && inPolygon(best, polygon)) return best
  }
  return null
}

/** Grid points across each of a shape's polygons, weighted by area. */
export function samples(shape: Shape): Sample[] {
  const result: Sample[] = []
  for (const polygon of shape.polygons) {
    const [w, s, e, n] = boxOf(polygon[0])
    const spacing = Math.min(
      MAX_SPACING,
      Math.max(MIN_SPACING, Math.sqrt(((e - w) * (n - s)) / PER_POLYGON)),
    )
    const found: Sample[] = []
    for (let y = s + spacing / 2; y < n; y += spacing) {
      const weight = spacing * spacing * Math.cos((y * Math.PI) / 180)
      for (let x = w + spacing / 2; x < e; x += spacing) {
        if (inPolygon([x, y], polygon)) found.push({ point: [x, y], weight })
      }
    }
    if (!found.length) {
      // Smaller than the grid: one point, standing for the whole polygon.
      const point = interiorPoint(polygon)
      const area = (e - w) * (n - s) * Math.cos((((s + n) / 2) * Math.PI) / 180)
      if (point) found.push({ point, weight: area / 2 })
    }
    result.push(...found)
  }
  return result
}

/** How far (degrees, about 30 km) a point off one map's coast may be from the other's. */
const SNAP = 0.3

/** The shape containing a point or, for a point just off its coast, the nearest one. */
function locate(point: [number, number], shapes: Shape[]): Shape | undefined {
  const hit = shapes.find((t) => inside(point, t))
  if (hit) return hit
  // The two maps draw coasts and small islands differently, so a point on an
  // island in one can be in the sea in the other.
  const [x, y] = point
  let best: Shape | undefined
  let bestDistance = SNAP
  for (const t of shapes) {
    const [w, s, e, n] = t.box
    if (x < w - SNAP * 3 || x > e + SNAP * 3 || y < s - SNAP || y > n + SNAP) continue
    const d = distance(point, t)
    if (d <= bestDistance) {
      best = t
      bestDistance = d
    }
  }
  return best
}

/**
 * For each shape in `from`, the share of its area lying in each shape of `to`.
 * Area that lies in none of them, even allowing for coasts drawn differently,
 * is left out of the shares, but still counts towards the whole.
 */
export function overlaps(from: Shape[], to: Shape[]): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>()
  for (const shape of from) {
    const points = samples(shape)
    const total = points.reduce((sum, p) => sum + p.weight, 0)
    const shares = new Map<string, number>()
    for (const { point, weight } of points) {
      const hit = locate(point, to)
      if (hit) shares.set(hit.code, (shares.get(hit.code) ?? 0) + weight / total)
    }
    result.set(shape.code, shares)
  }
  return result
}

/** A share this small is two maps disagreeing about a border, not real overlap. */
export const MIN_SHARE = 0.05
/** A place holding this much of a botanical country stands for all of it. */
export const MAIN_SHARE = 0.9

/**
 * Lines up botanical countries with the map's places (the finest ones: states
 * in the countries shown by state, countries elsewhere). A unit and a place
 * overlap when at least MIN_SHARE of either lies in the other: both ways,
 * because Andorra is a sliver of "Spain" but lies wholly inside it, and
 * Kyoto is a sliver of "Japan". A unit's `main` place holds MAIN_SHARE of it.
 */
export function lineUp(regions: Shape[], names: Record<string, string>, places: Shape[]): TdwgMap {
  const regionShares = overlaps(regions, places) // region → place → share of the region
  const placeShares = overlaps(places, regions) // place → region → share of the place
  const map: TdwgMap = { regions: {}, places: {} }
  for (const r of regions) map.regions[r.code] = { name: names[r.code] ?? r.code, places: [] }
  const link = (region: string, place: string) => {
    const entry = map.regions[region]
    if (!entry.places.includes(place)) entry.places.push(place)
    const covering = (map.places[place] ??= [])
    if (!covering.includes(region)) covering.push(region)
  }
  for (const [region, shares] of regionShares) {
    for (const [place, share] of shares) {
      if (share >= MIN_SHARE) link(region, place)
      if (share >= MAIN_SHARE) map.regions[region].main = place
    }
  }
  for (const [place, shares] of placeShares) {
    for (const [region, share] of shares) if (share >= MIN_SHARE) link(region, place)
  }
  for (const entry of Object.values(map.regions)) entry.places.sort()
  for (const covering of Object.values(map.places)) covering.sort()
  return map
}

/** The botanical countries covering a place; for a country shown by state, all of its states'. */
function covering(place: string, map: TdwgMap): string[] {
  if (map.places[place]) return map.places[place]
  const within = Object.keys(map.places).filter((p) => p.startsWith(`${place}-`))
  return [...new Set(within.flatMap((p) => map.places[p]))]
}

/**
 * A place's status in a plant's WCVP distribution: native if any botanical
 * country covering it is native, else introduced if any is, else not listed.
 */
export function placeStatus(
  place: string,
  wcvp: Record<string, Status>,
  map: TdwgMap,
): Status | undefined {
  const statuses = covering(place, map).map((r) => wcvp[r])
  if (statuses.includes('native')) return 'native'
  if (statuses.includes('introduced')) return 'introduced'
  return undefined
}

/**
 * Places WCVP establishes on its own: the main place of each botanical country
 * the plant is listed in. Listed in "Alabama", it's in US-AL; listed in
 * "Mexico Northwest" or "Japan", it's somewhere in several states, and only
 * records can say which. A place's status follows the placeStatus rule.
 */
export function definitePlaces(wcvp: Record<string, Status>, map: TdwgMap): Record<string, Status> {
  const result: Record<string, Status> = {}
  for (const region of Object.keys(wcvp)) {
    const main = map.regions[region]?.main
    const status = main && placeStatus(main, wcvp, map)
    if (main && status) result[main] = status
  }
  return result
}
