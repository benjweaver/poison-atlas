// Point-in-polygon for GeoJSON outlines in longitude/latitude degrees, shared
// by the scripts that place records (assign-cells.ts, ranges.ts) and line up
// botanical countries with the map (tdwg.ts).

export type Ring = [number, number][]

export interface Outline {
  properties: { code: string }
  geometry:
    { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] }
}

/** [west, south, east, north] */
export type Box = [number, number, number, number]

/** An outline ready for repeated tests: its polygons and bounding box. */
export interface Shape {
  code: string
  polygons: Ring[][]
  box: Box
}

export function boxOf(points: Ring): Box {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x, y] of points) {
    w = Math.min(w, x)
    s = Math.min(s, y)
    e = Math.max(e, x)
    n = Math.max(n, y)
  }
  return [w, s, e, n]
}

export function shapeOf(outline: Outline): Shape {
  const polygons =
    outline.geometry.type === 'Polygon'
      ? [outline.geometry.coordinates]
      : outline.geometry.coordinates
  return { code: outline.properties.code, polygons, box: boxOf(polygons.flat(2) as Ring) }
}

export function inRing([x, y]: [number, number], ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Whether a polygon (outer ring, then holes) contains the point. */
export function inPolygon(point: [number, number], [outer, ...holes]: Ring[]): boolean {
  return inRing(point, outer) && !holes.some((h) => inRing(point, h))
}

export function inside(point: [number, number], shape: Shape): boolean {
  const [x, y] = point
  const [w, s, e, n] = shape.box
  if (x < w || x > e || y < s || y > n) return false
  return shape.polygons.some((p) => inPolygon(point, p))
}

// Distance in degrees from a point to a polygon's edges, with longitude scaled
// by latitude so a degree east means the same as a degree north.
export function distance([x, y]: [number, number], f: Shape): number {
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
