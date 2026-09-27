import { normalizeName, parseCountries, readChecklists } from './checklist.ts'

const names = Object.fromEntries(
  Object.entries({
    Angola: 'AO',
    'Democratic Republic of the Congo': 'CD',
    Eswatini: 'SZ',
    Cameroon: 'CM',
    Guinea: 'GN',
    Namibia: 'NA',
    'South Africa': 'ZA',
    'United States of America': 'US',
    'Central African Republic': 'CF',
    'Western Sahara': 'EH',
  }).map(([name, code]) => [normalizeName(name), code]),
)

describe('parseCountries', () => {
  it('reads a Catalogue of Life country list', () => {
    const text =
      'Angola, Cameroon (Adamaoua [HR 35: 191]), N/S Democratic Republic of the Congo (Zaire), Eswatini (Swaziland), Guinea (Conakry), Republic of South Africa (Eastern Cape etc.)'
    expect(parseCountries(text, names)).toEqual({
      codes: ['AO', 'CD', 'CM', 'GN', 'SZ', 'ZA'],
      unmatched: [],
    })
  })

  it('ignores direction words and keeps bracketed detail together', () => {
    expect(
      parseCountries('USA (SE California, S Nevada, Arizona), N Namibia', names).codes,
    ).toEqual(['NA', 'US'])
  })

  it('matches names that start with a direction word', () => {
    expect(
      parseCountries('South Africa, Central African Republic, Western Sahara', names).codes,
    ).toEqual(['CF', 'EH', 'ZA'])
  })

  it('copes with truncated entries and subspecies prefixes', () => {
    expect(parseCountries('tergeminus: USA (Iowa, Texas, Oklahoma', names).codes).toEqual(['US'])
  })

  it('stops at "Introduced": those countries are not native range', () => {
    expect(parseCountries('Angola, Namibia. Introduced to Guinea, Cameroon', names).codes).toEqual([
      'AO',
      'NA',
    ])
  })

  it('reports what it could not match', () => {
    expect(parseCountries('Angola, Atlantis', names).unmatched).toEqual(['Atlantis'])
  })
})

describe('readChecklists', () => {
  it('reads native range from trusted checklists, and introductions from registers', () => {
    const entries = [
      { source: 'Catalogue of Life', locality: 'Angola, N Namibia' },
      {
        source: 'South African National Species Checklist (Catalogue of Life in South Africa)',
        country: 'ZA',
      },
      { source: 'Checklist of alien herpetofauna of Belgium', country: 'BE' },
      { source: 'Global Register of Introduced and Invasive Species - Australia', country: 'AU' },
      { source: 'WRiMS', country: 'GR', establishmentMeans: 'INTRODUCED' },
      { source: 'Integrated Taxonomic Information System (ITIS)', locality: 'Africa' },
    ]
    const result = readChecklists(entries, names)
    // Each country keeps its source, for citing on the site.
    expect(result.native).toEqual({
      AO: ['Catalogue of Life'],
      NA: ['Catalogue of Life'],
      ZA: ['South African National Species Checklist'],
    })
    expect(result.introduced).toEqual({
      AU: ['Global Register of Introduced and Invasive Species - Australia'],
      BE: ['Checklist of alien herpetofauna of Belgium'],
      GR: ['WRiMS'],
    })
  })

  it('ignores name registers, taxonomy databases, and kept or passing populations', () => {
    const entries = [
      { country: 'NO' }, // no source: a species-name register
      { source: 'Dyntaxa. Svensk taxonomisk databas', country: 'SE' },
      { source: 'Catalogue of Life', locality: 'Angola' },
      { source: 'Flora e Funga do Brasil', country: 'BR', establishmentMeans: 'MANAGED' },
      { source: 'Catalogue of Life', country: 'CM', status: 'DOUBTFUL' },
    ]
    const result = readChecklists(entries, names)
    expect(result.native).toEqual({ AO: ['Catalogue of Life'] })
    expect(result.introduced).toEqual({})
  })

  it('reads plants from WCVP alone, by botanical country', () => {
    const wcvp = 'The World Checklist of Vascular Plants (WCVP)'
    const entries = [
      { source: wcvp, locationId: 'TDWG:GRB', locality: 'Great Britain' },
      {
        source: wcvp,
        locationId: 'TDWG:ALA',
        locality: 'Alabama',
        establishmentMeans: 'INTRODUCED',
      },
      { source: 'Catalogue of Life', locality: 'Angola' },
      { source: 'Global Register of Introduced and Invasive Species - Belgium', country: 'BE' },
    ]
    const result = readChecklists(entries, names, { plant: true })
    expect(result.wcvp).toEqual({ GRB: 'native', ALA: 'introduced' })
    expect(result.native).toEqual({})
    expect(result.introduced).toEqual({})
  })
})
