import { makeInlandTest, makeStateResolver, type Outline } from './assign-cells.ts'

const square = (code: string, x: number, y: number, size: number): Outline => ({
  properties: { code },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [x, y],
        [x + size, y],
        [x + size, y + size],
        [x, y + size],
        [x, y],
      ],
    ],
  },
})

// "BB" is split into two states down the middle.
const states = { BB: [square('BB-W', 20, 0, 5), square('BB-E', 25, 0, 5)] }
const stateOf = makeStateResolver((cc) => states[cc as keyof typeof states] ?? [])

describe('makeStateResolver', () => {
  it('picks the state a dot lies in', () => {
    expect(stateOf([27, 2], 'BB')).toBe('BB-E')
  })

  it('picks the nearest state for a dot at sea', () => {
    expect(stateOf([19, 2], 'BB')).toBe('BB-W')
    expect(stateOf([33, 2], 'BB')).toBe('BB-E')
  })

  it('falls back to the country when no state is near', () => {
    expect(stateOf([60, 2], 'BB')).toBe('BB')
  })
})

describe('makeInlandTest', () => {
  // A 10° square continent.
  const inland = makeInlandTest([square('LAND', 0, 0, 10)])

  it('flags dots deep inland', () => {
    expect(inland([5, 5])).toBe(true)
  })

  it('keeps dots at sea and on or near the coast', () => {
    expect(inland([12, 5])).toBe(false)
    expect(inland([9.9, 5])).toBe(false)
  })
})
