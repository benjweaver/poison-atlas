// Where an aquatic species has actually been recorded, as a coarse grid.
//
// For land animals the map shades whole countries and states. That's wrong for
// something that lives in the sea or a river: shading all of Queensland for a
// box jellyfish says nothing about which beaches are the problem. So for
// aquatic species, `npm run ranges` also saves GBIF's record density as grid
// cells, and the map draws those as dots on the water.
//
// GBIF serves density as vector tiles (EPSG:4326, zoom 1 = 4 × 2 tiles of 90°).
// Each feature is one square cell with a `total` record count.
import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'

const ZOOM = 1
const COLS = 4
const ROWS = 2
const TILE_DEGREES = 90
// Cell edge in tile units (tiles are 4096 across), so 16 ≈ 0.35°, about 39 km.
const SQUARE = 16

/** [longitude, latitude, records] per cell, cell centres rounded to 0.01°. */
export type GridPoint = [number, number, number]

export interface Cell {
  /** Tile coordinates of the cell's corners, 0–extent. */
  ring: { x: number; y: number }[]
  total: number
}

/** Converts cells from one tile to lon/lat centres, dropping cells from the tile's buffer. */
export function cellsToPoints(
  tileX: number,
  tileY: number,
  extent: number,
  cells: Cell[],
): GridPoint[] {
  const points: GridPoint[] = []
  for (const { ring, total } of cells) {
    const xs = ring.map((p) => p.x)
    const ys = ring.map((p) => p.y)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    // Tiles repeat a margin of their neighbours' cells; keep each cell once.
    if (cx < 0 || cx >= extent || cy < 0 || cy >= extent) continue
    const lon = -180 + TILE_DEGREES * (tileX + cx / extent)
    const lat = 90 - TILE_DEGREES * (tileY + cy / extent)
    points.push([Math.round(lon * 100) / 100, Math.round(lat * 100) / 100, total])
  }
  return points
}

/** The zoom-1 tiles a bounding box touches (lon may run past 180 for antimeridian boxes). */
export function tilesFor([w, south, e, north]: [number, number, number, number]): [
  number,
  number,
][] {
  const tiles: [number, number][] = []
  const col = (lon: number) => Math.floor(((((lon + 180) % 360) + 360) % 360) / TILE_DEGREES)
  const row = (lat: number) =>
    Math.min(ROWS - 1, Math.max(0, Math.floor((90 - lat) / TILE_DEGREES)))
  const cols = new Set<number>()
  for (let lon = w; lon < e; lon += TILE_DEGREES) cols.add(col(lon))
  cols.add(col(e))
  for (const x of cols) for (let y = row(north); y <= row(south); y++) tiles.push([x, y])
  return tiles
}

const ALL_TILES: [number, number][] = Array.from({ length: COLS * ROWS }, (_, i) => [
  i % COLS,
  Math.floor(i / COLS),
])

/**
 * Fetches GBIF's record grid for one taxon, with the same record filters as
 * the range counts. With `country`, only records GBIF attributes to that
 * country, which for marine records includes its offshore waters (EEZ), so
 * each dot can carry GBIF's own answer to "whose waters is this in?".
 */
export async function fetchGrid(
  taxonKey: number,
  filters: [string, string | number][],
  get: (url: URL) => Promise<ArrayBuffer>,
  { country, tiles = ALL_TILES }: { country?: string; tiles?: [number, number][] } = {},
): Promise<GridPoint[]> {
  const points: GridPoint[] = []
  for (const [x, y] of tiles) {
    const url = new URL(`https://api.gbif.org/v2/map/occurrence/density/${ZOOM}/${x}/${y}.mvt`)
    url.searchParams.set('srs', 'EPSG:4326')
    url.searchParams.set('bin', 'square')
    url.searchParams.set('squareSize', String(SQUARE))
    url.searchParams.set('taxonKey', String(taxonKey))
    if (country) url.searchParams.set('country', country)
    for (const [k, v] of filters) url.searchParams.append(k, String(v))
    const layer = new VectorTile(new PbfReader(new Uint8Array(await get(url)))).layers.occurrence
    if (!layer) continue
    const cells: Cell[] = []
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i)
      cells.push({ ring: f.loadGeometry()[0], total: Number(f.properties.total) })
    }
    points.push(...cellsToPoints(x, y, layer.extent, cells))
  }
  return points.sort((a, b) => a[0] - b[0] || a[1] - b[1])
}
