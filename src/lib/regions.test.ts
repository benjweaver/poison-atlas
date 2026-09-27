import type { Species } from '@/data/schema'

import {
  countsByCountry,
  countsBySubdivision,
  introducedIn,
  presenceIn,
  speciesIn,
} from './regions'

const claim = { text: '', sources: ['https://example.org'] }
function species(
  slug: string,
  regions: string[],
  danger: Species['danger'] = 3,
  introduced?: string[],
): Species {
  return {
    slug,
    name: slug,
    scientificName: slug,
    group: 'plant',
    danger,
    summary: '',
    exposure: { routes: ['eaten'], sources: ['https://example.org'] },
    toxicParts: claim,
    toxins: claim,
    symptoms: claim,
    onset: claim,
    atRisk: claim,
    habitat: '',
    regions,
    introduced,
  }
}

const rattler = species('rattler', ['US-AZ', 'US-NM', 'MX'], 4)
const adder = species('adder', ['GB', 'FR'], 2)
const all = [rattler, adder]

describe('presenceIn', () => {
  it('finds a species in a country through any of its states', () => {
    expect(presenceIn(rattler, 'US')).toBe('listed')
  })

  it('finds a species in a listed state only', () => {
    expect(presenceIn(rattler, 'US-AZ')).toBe('listed')
    expect(presenceIn(rattler, 'US-FL')).toBeUndefined()
  })

  it('flags a whole-country listing as country-wide inside a state', () => {
    expect(presenceIn(rattler, 'MX-SON')).toBe('countryWide')
  })
})

describe('speciesIn', () => {
  it('orders most dangerous first', () => {
    const both = [adder, rattler].map((s) => ({ ...s, regions: ['FR'] }))
    expect(speciesIn(both, 'FR').map((m) => m.species.slug)).toEqual(['rattler', 'adder'])
  })
})

describe('counts', () => {
  it('counts a species once per country however many states it lists', () => {
    const counts = countsByCountry(all)
    expect(counts.get('US')).toBe(1)
    expect(counts.get('MX')).toBe(1)
    expect(counts.get('GB')).toBe(1)
    expect(counts.get('DE')).toBeUndefined()
  })

  it('counts country-wide species in every state', () => {
    const counts = countsBySubdivision(all, ['MX-SON', 'MX-CHH'])
    expect(counts.get('MX-SON')).toBe(1)
    expect(counts.get('MX-CHH')).toBe(1)
  })
})

describe('introduced places', () => {
  // Native in Guyana; introduced in Queensland and Florida, and across Puerto Rico.
  const toad = species('toad', ['GY'], 3, ['AU-QLD', 'US-FL', 'PR'])

  it('finds a species where it was introduced, and says so', () => {
    expect(presenceIn(toad, 'AU-QLD')).toBe('listed')
    expect(speciesIn([toad], 'US-FL')[0]).toMatchObject({ introduced: true })
    expect(speciesIn([toad], 'GY')[0]).toMatchObject({ introduced: false })
  })

  it('calls a country introduced only when every part of it listed is', () => {
    expect(introducedIn(toad, 'AU')).toBe(true)
    const mixed = species('mixed', ['US-TX'], 3, ['US-FL'])
    expect(introducedIn(mixed, 'US')).toBe(false)
    expect(introducedIn(mixed, 'US-FL')).toBe(true)
  })

  it('counts introduced places on the map too', () => {
    expect(countsByCountry([toad]).get('US')).toBe(1)
    expect(countsBySubdivision([toad], ['AU-QLD', 'AU-NSW']).get('AU-QLD')).toBe(1)
  })
})
