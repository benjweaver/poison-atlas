import type { Feature, Geometry } from 'geojson'

import { bbox, frameBox } from './geo'

const poly = (coords: [number, number][]): Feature<Geometry> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [coords] },
})

describe('bbox', () => {
  it('bounds an ordinary shape', () => {
    expect(
      bbox([
        poly([
          [10, 0],
          [20, 5],
          [15, 10],
        ]),
      ]),
    ).toEqual([10, 0, 20, 10])
  })

  it('keeps a shape that straddles 180° narrow instead of wrapping the globe', () => {
    // Two islands either side of the antimeridian, like Fiji.
    const box = bbox([
      poly([
        [177, -18],
        [179, -17],
        [178, -16],
      ]),
      poly([
        [-179.9, -17],
        [-179, -16],
        [-179.5, -15],
      ]),
    ])
    expect(box).toEqual([177, -18, 181, -15])
  })

  it('returns null for nothing', () => {
    expect(bbox([])).toBeNull()
  })
})

const multi = (...parts: [number, number][][]): Feature<Geometry> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'MultiPolygon', coordinates: parts.map((ring) => [ring]) },
})

const square = (x: number, y: number, size: number): [number, number][] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
]

describe('frameBox', () => {
  it('drops a small, distant territory', () => {
    // A "France" with an overseas department far to the south-west.
    const france = multi(square(-5, 42, 10), square(-54, 2, 2))
    expect(frameBox(france)).toEqual([-5, 42, 5, 52])
  })

  it('keeps a small island close to the mainland', () => {
    // A "Tasmania" just off the mainland's southern edge.
    const australia = multi(square(113, -39, 40), square(144, -44, 4))
    expect(frameBox(australia)).toEqual([113, -44, 153, 1])
  })

  it('keeps a large part even when it is far away', () => {
    const country = multi(square(0, 0, 10), square(60, 0, 8))
    expect(frameBox(country)).toEqual([0, 0, 68, 10])
  })
})
