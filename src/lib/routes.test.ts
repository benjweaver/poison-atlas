import { harmfulIf } from './routes'

describe('harmfulIf', () => {
  it('says how a species harms, with a serial comma for three or more', () => {
    expect(harmfulIf(['eaten'])).toBe('Harmful if eaten')
    expect(harmfulIf(['eaten', 'skin'])).toBe('Harmful if eaten or touched')
    expect(harmfulIf(['skin', 'inhaled', 'eyes'])).toBe(
      'Harmful if touched, breathed in, or in the eyes',
    )
  })
})
