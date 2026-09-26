import { checklistCountries, normalizeName, parseCountries } from './checklist.ts'

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

describe('checklistCountries', () => {
  it('uses native checklists and ignores alien-species registers', () => {
    const entries = [
      { source: 'Catalogue of Life', locality: 'Angola, N Namibia' },
      {
        source: 'South African National Species Checklist (Catalogue of Life in South Africa)',
        country: 'ZA',
      },
      { source: 'Checklist of alien herpetofauna of Belgium', country: 'BE' },
      { source: 'Some national checklist', country: 'CM', establishmentMeans: 'INTRODUCED' },
      { source: 'Integrated Taxonomic Information System (ITIS)', locality: 'Africa' },
    ]
    const result = checklistCountries(entries, names)
    expect(result.codes).toEqual(['AO', 'NA', 'ZA'])
    // Each country keeps its source, for citing on the site.
    expect(result.sources).toEqual({
      AO: ['Catalogue of Life'],
      NA: ['Catalogue of Life'],
      ZA: ['South African National Species Checklist'],
    })
  })

  it('ignores name registers and taxonomy databases', () => {
    const entries = [
      { country: 'NO' }, // no source: a species-name register
      { source: 'Dyntaxa. Svensk taxonomisk databas', country: 'SE' },
      {
        source: 'Catálogo Taxonômico da Fauna do Brasil',
        country: 'GB',
        establishmentMeans: 'NATIVE',
      },
      { source: 'Catalogue of Life', locality: 'Angola' },
      {
        source: 'World Register of Marine Species',
        country: 'GR',
        establishmentMeans: 'INTRODUCED',
      },
    ]
    expect(checklistCountries(entries, names).codes).toEqual(['AO'])
  })
})
