import type { PoisonCentre } from '@/data/schema'

import { helpFor, languageRegion } from './poison-help'

describe('languageRegion', () => {
  it('takes the first region the languages name', () => {
    expect(languageRegion(['en-GB', 'en'])).toBe('GB')
    expect(languageRegion(['fr', 'en-AU'])).toBe('AU')
  })

  it("doesn't guess a region from a bare language", () => {
    expect(languageRegion(['en', 'es'])).toBeNull()
    expect(languageRegion(['es-419'])).toBeNull() // Latin America, not a country
    expect(languageRegion(['not a tag'])).toBeNull()
  })
})

describe('helpFor', () => {
  const us: PoisonCentre = {
    name: 'Poison Help',
    phone: '1-800-222-1222',
    tel: '18002221222',
    source: 'https://example.org',
    checked: '2026-09-26',
  }

  it("names the country with its centre, and knows when it hasn't one", () => {
    const name = (code: string) => (code === 'US' ? 'United States' : code)
    expect(helpFor('US', { US: us }, name)).toEqual({
      country: 'US',
      place: 'United States',
      centre: us,
    })
    expect(helpFor('FR', { US: us }, name)).toBeNull()
    expect(helpFor(null, { US: us }, name)).toBeNull()
  })
})
