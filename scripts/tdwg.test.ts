import type { Ring, Shape } from './polygons.ts'
import {
  definitePlaces,
  interiorPoint,
  lineUp,
  placeStatus,
  samples,
  type TdwgMap,
} from './tdwg.ts'

// A rectangle as a one-polygon shape.
function rect(code: string, w: number, s: number, e: number, n: number): Shape {
  const ring: Ring = [
    [w, s],
    [e, s],
    [e, n],
    [w, n],
    [w, s],
  ]
  return { code, polygons: [[ring]], box: [w, s, e, n] }
}

describe('samples', () => {
  it('covers a shape evenly, weighted by area', () => {
    const points = samples(rect('A', 0, 0, 4, 2))
    const total = points.reduce((sum, p) => sum + p.weight, 0)
    // 8 square degrees near the equator, to within the grid's spacing.
    expect(total).toBeGreaterThan(8 * 0.95)
    expect(total).toBeLessThan(8 * 1.01)
  })

  it('gives a polygon smaller than the grid one point of its own', () => {
    const tiny = rect('T', 10, 10, 10.001, 10.001)
    expect(samples(tiny).length).toBeGreaterThan(0)
  })
})

describe('interiorPoint', () => {
  it('finds a point inside a C-shaped polygon, not in its gap', () => {
    const c: Ring = [
      [0, 0],
      [3, 0],
      [3, 1],
      [1, 1],
      [1, 2],
      [3, 2],
      [3, 3],
      [0, 3],
      [0, 0],
    ]
    const [x, y] = interiorPoint([c])!
    // The C's spine is x < 1; its arms are y < 1 and y > 2.
    expect(x < 1 || y < 1 || y > 2).toBe(true)
  })
})

describe('lineUp', () => {
  // Botanical countries: "North" covers two states, "South" matches a third,
  // and "Enclave" is a tiny country wholly inside "North".
  const regions = [rect('NOR', 0, 5, 10, 10), rect('SOU', 0, 0, 10, 5)]
  const places = [
    rect('XX-A', 0, 5, 5, 10),
    rect('XX-B', 5, 5, 9.9, 10),
    rect('EN', 9.9, 5, 10, 10),
    rect('XX-C', 0, 0, 10, 5),
  ]
  const map = lineUp(regions, { NOR: 'North', SOU: 'South' }, places)

  it('links each unit to the places it overlaps, however small a part they are', () => {
    expect(map.regions.NOR).toEqual({ name: 'North', places: ['EN', 'XX-A', 'XX-B'] })
    expect(map.places.EN).toEqual(['NOR'])
  })

  it('names the main place of a unit that one place holds nearly all of', () => {
    expect(map.regions.SOU).toEqual({ name: 'South', places: ['XX-C'], main: 'XX-C' })
  })
})

describe('status', () => {
  const map: TdwgMap = {
    regions: {
      ALA: { name: 'Alabama', places: ['US-AL'], main: 'US-AL' },
      MXN: { name: 'Mexico Northwest', places: ['MX-BCN', 'MX-SON'] },
      GRB: { name: 'Great Britain', places: ['GB'], main: 'GB' },
      IRE: { name: 'Ireland', places: ['GB', 'IE'] },
    },
    places: {
      'US-AL': ['ALA'],
      'MX-BCN': ['MXN'],
      'MX-SON': ['MXN'],
      GB: ['GRB', 'IRE'],
      IE: ['IRE'],
    },
  }

  it("gives a place its unit's status, and native wins where units disagree", () => {
    const wcvp = { MXN: 'introduced', GRB: 'introduced', IRE: 'native' } as const
    expect(placeStatus('MX-SON', wcvp, map)).toBe('introduced')
    expect(placeStatus('GB', wcvp, map)).toBe('native')
    expect(placeStatus('US-AL', wcvp, map)).toBeUndefined()
  })

  it("reads a whole country's status from its states", () => {
    expect(placeStatus('MX', { MXN: 'native' }, map)).toBe('native')
  })

  it('establishes only the places that stand for a whole unit', () => {
    const wcvp = { ALA: 'native', MXN: 'introduced', IRE: 'native' } as const
    // Mexico Northwest and Ireland each span several places: records decide.
    expect(definitePlaces(wcvp, map)).toEqual({ 'US-AL': 'native' })
  })
})
