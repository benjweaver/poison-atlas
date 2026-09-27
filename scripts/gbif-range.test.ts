import {
  diffRegions,
  FUNGUS_RULES,
  minRecords,
  propose,
  recordedPlaces,
  regionsFromCells,
  type GbifCounts,
} from './gbif-range.ts'
import type { TdwgMap } from './tdwg.ts'

// Shaped like real rattlesnake data: thousands of records in the US and
// Mexico, two stray ones in Canada.
const rattler: GbifCounts = {
  total: 28_000,
  countries: { US: 25_000, MX: 2_998, CA: 2 },
  subdivisions: { 'US-TX': 11_000, 'US-AZ': 9_000, 'US-AR': 38, 'US-FL': 4, 'MX-SON': 600 },
}

describe('minRecords', () => {
  it('scales with how well recorded a species is, between 2 and 5', () => {
    expect(minRecords(40)).toBe(2)
    expect(minRecords(300)).toBe(3)
    expect(minRecords(100_000)).toBe(5)
  })
})

describe('recordedPlaces', () => {
  it('lists subdivided countries by state and drops sparse records', () => {
    // CA has 2 and US-FL 4 records, below the minimum of 5.
    expect(recordedPlaces(rattler)).toEqual(['MX-SON', 'US-AR', 'US-AZ', 'US-TX'])
  })

  it('keeps a well-sampled species in a thinly recorded country', () => {
    // 120,000 records from Britain and the Netherlands; Belarus is a tiny
    // share of them, but real.
    const counts: GbifCounts = {
      total: 120_000,
      countries: { GB: 80_000, NL: 39_900, BY: 90, IE: 3 },
      subdivisions: {},
    }
    expect(recordedPlaces(counts)).toEqual(['BY', 'GB', 'NL'])
  })

  it('falls back to the country when no state has enough records', () => {
    const counts: GbifCounts = { total: 50, countries: { US: 50 }, subdivisions: { 'US-TX': 1 } }
    expect(recordedPlaces(counts)).toEqual(['US'])
  })

  it("doesn't list a big country whole on a few scattered records", () => {
    const counts: GbifCounts = {
      total: 2178,
      countries: { US: 8, MX: 443 },
      subdivisions: { 'US-CA': 2, 'MX-SIN': 120 },
    }
    expect(recordedPlaces(counts)).toEqual(['MX-SIN'])
  })

  it('applies exclusions, including a whole country', () => {
    expect(recordedPlaces(rattler, { exclude: ['US-AR', 'MX'] })).toEqual(['US-AZ', 'US-TX'])
  })

  it('asks more of fungus places known only from iNaturalist photos', () => {
    const counts: GbifCounts = {
      total: 20_000,
      countries: { GB: 12_000, US: 7_000, MX: 9, CL: 40 },
      subdivisions: { 'US-CA': 6_900, 'MX-JAL': 9 },
    }
    // Mexico's 9 records are all iNaturalist photos; Chile's 40 include specimens.
    const inat: GbifCounts = {
      total: 9_000,
      countries: { GB: 6_000, US: 3_000, MX: 9, CL: 5 },
      subdivisions: { 'US-CA': 2_950, 'MX-JAL': 9 },
    }
    expect(recordedPlaces(counts, {}, FUNGUS_RULES, inat)).toEqual(['CL', 'GB', 'US-CA'])
  })
})

describe('diffRegions', () => {
  it('reports what a proposal would change', () => {
    expect(diffRegions(['GB', 'IE'], ['FR', 'GB'])).toEqual({
      added: ['FR'],
      removed: ['IE'],
      kept: ['GB'],
    })
  })
})

describe('regionsFromCells', () => {
  const cell = (code: string | null, n: number) => ({ code, n })

  it('lists every territory with a dot, once, however few records', () => {
    const cells = [cell('AU-QLD', 60), cell('AU-QLD', 30), cell('ID', 1), cell(null, 9)]
    expect(regionsFromCells(cells)).toEqual(['AU-QLD', 'ID'])
  })

  it('drops excluded territories, and a country exclude covers its states', () => {
    const cells = [cell('AU-QLD', 50), cell('PH', 50), cell('US-CA', 50)]
    expect(regionsFromCells(cells, { exclude: ['US', 'PH'] })).toEqual(['AU-QLD'])
  })
})

describe('propose', () => {
  const none = { native: {}, introduced: {}, wcvp: {} }

  describe('for animals and fungi', () => {
    it('makes a place introduced where a register says so and no native checklist disagrees', () => {
      const checklists = {
        ...none,
        native: { BR: ['Catalogue of Life'], GY: ['Catalogue of Life'] },
        introduced: { AU: ['GRIIS Australia'], BR: ['Some alien list'] },
      }
      expect(propose(['AU-QLD', 'BR-AM', 'CO'], checklists, {})).toEqual({
        // GY is from its checklist alone; BR-AM's native checklist outranks the register.
        native: ['BR-AM', 'CO', 'GY'],
        introduced: ['AU-QLD'],
        unlisted: [],
      })
    })

    it('never adds a place from a register alone, or a big country from any checklist', () => {
      const checklists = {
        ...none,
        native: { US: ['Catalogue of Life'] },
        introduced: { NZ: ['GRIIS'] },
      }
      expect(propose(['MX-SON'], checklists, {})).toEqual({
        native: ['MX-SON'],
        introduced: [],
        unlisted: [],
      })
    })

    it('lets a cited include add a place or settle its status, and exclusions win over data', () => {
      const result = propose(['US-FL', 'US-TX', 'JP-47'], none, {
        overrides: {
          exclude: ['JP'],
          include: [
            { code: 'US-FL', introduced: true },
            { code: 'PR', introduced: true },
          ],
        },
      })
      expect(result).toEqual({ native: ['US-TX'], introduced: ['PR', 'US-FL'], unlisted: [] })
    })
  })

  describe('for plants', () => {
    const tdwg: TdwgMap = {
      regions: {
        GRB: { name: 'Great Britain', places: ['GB'], main: 'GB' },
        FRA: { name: 'France', places: ['FR'], main: 'FR' },
        ALA: { name: 'Alabama', places: ['US-AL'], main: 'US-AL' },
        MXN: { name: 'Mexico Northwest', places: ['MX-BCN', 'MX-SON'] },
      },
      places: { GB: ['GRB'], FR: ['FRA'], 'US-AL': ['ALA'], 'MX-BCN': ['MXN'], 'MX-SON': ['MXN'] },
    }
    const wcvp = { GRB: 'native', FRA: 'native', ALA: 'introduced', MXN: 'introduced' } as const

    it("takes WCVP's status, adds the places it establishes, and leaves out the rest", () => {
      expect(
        propose(['GB', 'MX-SON', 'US-GA', 'US'], { ...none, wcvp }, { plant: true, tdwg }),
      ).toEqual({
        native: ['FR', 'GB'],
        // Mexico Northwest is several states: only the one with records is listed.
        introduced: ['MX-SON', 'US-AL'],
        unlisted: [
          { code: 'US-GA', why: 'not in WCVP here: garden plants or casual escapes?' },
          { code: 'US', why: 'records not tied to a state' },
        ],
      })
    })

    it('needs the botanical-country map', () => {
      expect(() => propose([], none, { plant: true })).toThrow(/tdwg/)
    })
  })
})
