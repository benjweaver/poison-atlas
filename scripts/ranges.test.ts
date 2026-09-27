import { replaceRegions } from './ranges.ts'

describe('replaceRegions', () => {
  const file = `name: Hemlock
summary: >-
  A plant.
regions:
  - GB
  - FR
gbif:
  exclude:
    - code: IE
`

  it('replaces only the regions list', () => {
    expect(replaceRegions(file, ['DE', 'GB'])).toBe(
      file.replace('  - GB\n  - FR\n', '  - DE\n  - GB\n'),
    )
  })

  it('writes an introduced list after the native one, and updates it in place', () => {
    const once = replaceRegions(file, ['GB'], ['US-CA', 'NZ'])
    expect(once).toContain('regions:\n  - GB\nintroduced:\n  - US-CA\n  - NZ\ngbif:\n')
    expect(replaceRegions(once, ['GB'], ['AU'])).toContain(
      'regions:\n  - GB\nintroduced:\n  - AU\ngbif:\n',
    )
  })

  it('removes the introduced list when there is nothing introduced', () => {
    const once = replaceRegions(file, ['GB'], ['NZ'])
    expect(replaceRegions(once, ['GB'], [])).toBe(file.replace('  - GB\n  - FR\n', '  - GB\n'))
  })
})
