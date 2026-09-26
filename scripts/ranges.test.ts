import { replaceRegions } from './ranges.ts'

describe('replaceRegions', () => {
  const file = `name: Adder
summary: >-
  A snake.
regions:
  - GB
  - FR
`

  it('replaces only the regions list', () => {
    expect(replaceRegions(file, ['DE', 'GB'])).toBe(`name: Adder
summary: >-
  A snake.
regions:
  - DE
  - GB
`)
  })

  it('leaves fields after the list alone', () => {
    const withTrailer = file + 'gbif:\n  exclude:\n    - IE\n'
    expect(replaceRegions(withTrailer, ['GB'])).toContain(
      'regions:\n  - GB\ngbif:\n  exclude:\n    - IE\n',
    )
  })
})
