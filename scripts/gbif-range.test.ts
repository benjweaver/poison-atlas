import {
  diffRegions,
  minRecords,
  proposeRegions,
  regionsFromCells,
  withChecklist,
  type GbifCounts,
} from './gbif-range.ts'

// Shaped like the real western diamondback data: thousands of records in the
// US and Mexico, two stray ones in Canada.
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

describe('proposeRegions', () => {
  it('lists subdivided countries by state and drops sparse records', () => {
    // CA has 2 and US-FL 4 records, below the minimum of 5.
    expect(proposeRegions(rattler)).toEqual(['MX-SON', 'US-AR', 'US-AZ', 'US-TX'])
  })

  it('keeps a well-sampled species in a thinly recorded country', () => {
    // The adder problem: Belarus is a tiny share of the records, but real.
    const adder: GbifCounts = {
      total: 120_000,
      countries: { GB: 80_000, NL: 39_900, BY: 90, IE: 3 },
      subdivisions: {},
    }
    expect(proposeRegions(adder)).toEqual(['BY', 'GB', 'NL'])
  })

  it('lists other countries whole', () => {
    const adder: GbifCounts = { total: 1000, countries: { GB: 600, FR: 400 }, subdivisions: {} }
    expect(proposeRegions(adder)).toEqual(['FR', 'GB'])
  })

  it('falls back to the country when no state has enough records', () => {
    const counts: GbifCounts = { total: 50, countries: { US: 50 }, subdivisions: { 'US-TX': 1 } }
    expect(proposeRegions(counts)).toEqual(['US'])
  })

  it("doesn't list a big country whole on a few scattered records", () => {
    // The yellow-bellied sea snake: 8 US records, 2 in California, none in a
    // state with enough to count. Listing "US" would put it in South Carolina.
    const counts: GbifCounts = {
      total: 2178,
      countries: { US: 8, MX: 443 },
      subdivisions: { 'US-CA': 2, 'MX-SIN': 120 },
    }
    expect(proposeRegions(counts)).toEqual(['MX-SIN'])
  })

  it('applies manual excludes, including a whole country', () => {
    expect(proposeRegions(rattler, { exclude: ['US-AR', 'MX'] })).toEqual(['US-AZ', 'US-TX'])
  })

  it('applies manual includes, and a country include replaces its states', () => {
    expect(proposeRegions(rattler, { include: ['US-NM'] })).toContain('US-NM')
    expect(proposeRegions(rattler, { include: ['MX'] })).toEqual(['MX', 'US-AR', 'US-AZ', 'US-TX'])
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

describe('withChecklist', () => {
  it('adds checklist countries GBIF has no records for', () => {
    // The box jellyfish: records in Queensland and Indonesia; a checklist adds PNG.
    expect(withChecklist(['AU-QLD', 'ID'], ['PG', 'ID'])).toEqual(['AU-QLD', 'ID', 'PG'])
  })

  it('never lists a big country whole, and respects exclusions', () => {
    expect(withChecklist(['MX-SON'], ['US', 'MX', 'BE'], { exclude: ['BE'] })).toEqual(['MX-SON'])
  })
})
