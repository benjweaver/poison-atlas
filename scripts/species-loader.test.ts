import type { SpeciesFile } from '../src/data/schema.ts'
import { evidenceFor, type GbifEntry } from './species-loader.ts'

const species = (regions: string[], gbif?: SpeciesFile['gbif']): SpeciesFile => ({
  name: 'Test',
  scientificName: 'Testus testus',
  group: 'snake',
  danger: 3,
  summary: '',
  venom: '',
  habitat: '',
  regions,
  gbif,
})

const entry: GbifEntry = {
  key: 1,
  countries: { ZA: 40, KE: 3 },
  subdivisions: { 'ZA-LP': 40 },
  checklist: { KE: ['Catalogue of Life'], SO: ['Catalogue of Life'] },
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

  it('leaves a place with nothing behind it empty, which validation rejects', () => {
    expect(evidenceFor(species(['NG']), entry)).toEqual({ NG: [] })
  })
})
