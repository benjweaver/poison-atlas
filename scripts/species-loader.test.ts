import type { SpeciesFile } from '../src/data/schema.ts'
import { evidenceFor, WCVP_NAME, type GbifEntry } from './species-loader.ts'
import type { TdwgMap } from './tdwg.ts'

const claim = { text: 'Test.', sources: ['https://example.org'] }
const species = (
  regions: string[],
  gbif?: SpeciesFile['gbif'],
  introduced?: string[],
): SpeciesFile => ({
  name: 'Test',
  scientificName: 'Testus testus',
  group: 'amphibian',
  danger: 3,
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
  gbif,
})

const entry: GbifEntry = {
  key: 1,
  countries: { ZA: 40, KE: 3, AU: 900 },
  subdivisions: { 'ZA-LP': 40, 'AU-QLD': 900 },
  checklist: { KE: ['Catalogue of Life'], SO: ['Catalogue of Life'] },
  introduced: { AU: ['Global Register of Introduced and Invasive Species - Australia'] },
}

describe('evidenceFor', () => {
  it('cites records, checklists and hand-made additions per place', () => {
    const data = species(['ZA-LP', 'KE', 'SO', 'ET'], {
      include: [{ code: 'ET', source: 'https://example.org/paper' }],
    })
    expect(evidenceFor(data, entry)).toEqual({
      'ZA-LP': [{ kind: 'records', count: 40 }],
      KE: [
        { kind: 'records', count: 3 },
        { kind: 'checklist', source: 'Catalogue of Life' },
      ],
      SO: [{ kind: 'checklist', source: 'Catalogue of Life' }],
      ET: [{ kind: 'cited', source: 'https://example.org/paper' }],
    })
  })

  it('cites the registers behind an introduced place, not native checklists', () => {
    const data = species(['KE'], undefined, ['AU-QLD'])
    expect(evidenceFor(data, entry)['AU-QLD']).toEqual([
      { kind: 'records', count: 900 },
      {
        kind: 'checklist',
        source: 'Global Register of Introduced and Invasive Species - Australia',
      },
    ])
    const whole = species(['KE'], undefined, ['AU'])
    expect(evidenceFor(whole, entry).AU).toEqual([
      { kind: 'records', count: 900 },
      {
        kind: 'checklist',
        source: 'Global Register of Introduced and Invasive Species - Australia',
      },
    ])
  })

  it("cites WCVP where a plant's status there matches it", () => {
    const tdwg: TdwgMap = {
      regions: { GRB: { name: 'Great Britain', places: ['GB'], main: 'GB' } },
      places: { GB: ['GRB'] },
    }
    const plant = { ...entry, wcvp: { GRB: 'introduced' as const } }
    expect(evidenceFor(species(['GB']), plant, undefined, tdwg).GB).toEqual([])
    expect(evidenceFor(species([], undefined, ['GB']), plant, undefined, tdwg).GB).toEqual([
      { kind: 'checklist', source: WCVP_NAME },
    ])
  })

  it('leaves a place with nothing behind it empty, which validation rejects', () => {
    expect(evidenceFor(species(['NG']), entry)).toEqual({ NG: [] })
  })
})
