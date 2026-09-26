import { cellsToPoints, tilesFor } from './occurrence-grid.ts'

const square = (x: number, y: number, size: number) => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
  { x, y },
]

describe('cellsToPoints', () => {
  it('places a cell at its centre in degrees', () => {
    // Tile (3, 1) covers 90°E–180°E, 0°–90°S. The middle of it is 135°E, 45°S.
    expect(cellsToPoints(3, 1, 4096, [{ ring: square(2040, 2040, 16), total: 7 }])).toEqual([
      [135, -45, 7],
    ])
  })

  it('maps the top-left tile to the north-west of the world', () => {
    const [[lon, lat]] = cellsToPoints(0, 0, 4096, [{ ring: square(0, 0, 16), total: 1 }])
    expect(lon).toBeCloseTo(-179.82, 2)
    expect(lat).toBeCloseTo(89.82, 2)
  })

  it("drops cells from a neighbouring tile's buffer", () => {
    const cells = [
      { ring: square(-16, 100, 16), total: 1 },
      { ring: square(4096, 100, 16), total: 1 },
    ]
    expect(cellsToPoints(0, 0, 4096, cells)).toEqual([])
  })
})

describe('tilesFor', () => {
  it('finds the tiles a box touches', () => {
    // Northern Australia to the Philippines: east half of the world, both rows.
    expect(tilesFor([110, -25, 130, 20])).toEqual([
      [3, 0],
      [3, 1],
    ])
  })

  it('wraps boxes that cross 180°', () => {
    expect(tilesFor([170, -20, 190, -10]).sort()).toEqual([
      [0, 1],
      [3, 1],
    ])
  })
})
