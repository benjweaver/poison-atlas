import type { Species } from '@/data/schema'

import { countsByCountry, countsBySubdivision, presenceIn, speciesIn } from './regions'

function species(slug: string, regions: string[], danger: Species['danger'] = 3): Species {
  return {
    slug,
    name: slug,
    scientificName: slug,
    group: 'snake',
    danger,
    summary: '',
    venom: '',
    habitat: '',
    regions,
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
