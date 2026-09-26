// Which state a record dot belongs to, once GBIF has said which country.
//
// GBIF attributes every record to a country (for marine records, whose waters
// it's in), and scripts/ranges.ts fetches each country's dots separately, so
// the country is GBIF's answer. For the big countries the map shows by state,
// this picks the state the dot lies in, or the nearest one for a dot at sea.

type Ring = [number, number][]
export interface Outline {
  properties: { code: string }
  geometry:
    { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] }
}

interface Indexed {
  code: string
  polygons: Ring[][]
  box: [number, number, number, number]
}

function index(outlines: Outline[]): Indexed[] {
  return outlines.map((f) => {
    const polygons =
      f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    const pts = polygons.flat(2)
    return {
      code: f.properties.code,
      polygons,
      box: [
        Math.min(...pts.map((p) => p[0])),
        Math.min(...pts.map((p) => p[1])),
        Math.max(...pts.map((p) => p[0])),
        Math.max(...pts.map((p) => p[1])),
      ],
    }
  })
}

function inRing([x, y]: [number, number], ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const inside = (p: [number, number], f: Indexed) =>
  f.polygons.some(([outer, ...holes]) => inRing(p, outer) && !holes.some((h) => inRing(p, h)))

// Distance in degrees from a point to a polygon's edges, with longitude scaled
// by latitude so a degree east means the same as a degree north.
function distance([x, y]: [number, number], f: Indexed): number {
  const k = Math.cos((y * Math.PI) / 180)
  let best = Infinity
  for (const polygon of f.polygons) {
    for (const ring of polygon) {
      for (let i = 0; i < ring.length - 1; i++) {
        const ax = (ring[i][0] - x) * k
        const ay = ring[i][1] - y
        const bx = (ring[i + 1][0] - x) * k
        const by = ring[i + 1][1] - y
        const dx = bx - ax
        const dy = by - ay
        const len = dx * dx + dy * dy
        const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
      }
    }
  }
  return best
}

function nearest(p: [number, number], candidates: Indexed[], maxDegrees: number): Indexed | null {
  const near = candidates.filter(
    (f) =>
      p[0] >= f.box[0] - maxDegrees * 2 &&
      p[0] <= f.box[2] + maxDegrees * 2 &&
      p[1] >= f.box[1] - maxDegrees &&
      p[1] <= f.box[3] + maxDegrees,
  )
  const hit = near.find((f) => inside(p, f))
  if (hit) return hit
  let best: Indexed | null = null
  let bestDistance = maxDegrees
  for (const f of near) {
    const d = distance(p, f)
    if (d <= bestDistance) {
      best = f
      bestDistance = d
    }
  }
  return best
}

/** A dot this far from every state of its country is left at country level. */
const MAX_STATE_DEGREES = 6

export function makeStateResolver(
  subdivisionsOf: (country: string) => Outline[],
): (point: [number, number], country: string) => string {
  const states = new Map<string, Indexed[]>()
  return (point, country) => {
    if (!states.has(country)) states.set(country, index(subdivisionsOf(country)))
    return nearest(point, states.get(country)!, MAX_STATE_DEGREES)?.code ?? country
  }
}

/**
 * For sea animals: whether a record dot lies on land, further than
 * `maxDegrees` (about 40 km) from the coast. Such records are errors, usually
 * a museum specimen placed at the museum rather than where it was collected
 * (a reef stonefish "recorded" in Madrid). Small islands missing from the land
 * outline only ever make this answer "no", so it never drops a real record.
 */
export function makeInlandTest(
  land: Outline[],
  maxDegrees = 0.35,
): (point: [number, number]) => boolean {
  const shapes = index(land)
  return (point) => {
    const onLand = shapes.filter((f) => inside(point, f))
    return onLand.length > 0 && onLand.every((f) => distance(point, f) > maxDegrees)
  }
}
