import { numberSources, sourceLink } from './sources'

describe('sourceLink', () => {
  it('labels a bare URL with its site', () => {
    expect(sourceLink('https://www.ncbi.nlm.nih.gov/books/NBK441906/')).toEqual({
      label: 'ncbi.nlm.nih.gov',
      url: 'https://www.ncbi.nlm.nih.gov/books/NBK441906/',
    })
  })

  it('labels a citation with its URL by the citation', () => {
    expect(
      sourceLink('StatPearls: Mushroom Toxicity. https://www.ncbi.nlm.nih.gov/books/NBK441906/'),
    ).toEqual({
      label: 'StatPearls: Mushroom Toxicity.',
      url: 'https://www.ncbi.nlm.nih.gov/books/NBK441906/',
    })
  })

  it('keeps a citation without a URL as text', () => {
    expect(sourceLink('Nelson et al. 2007, Handbook of Poisonous and Injurious Plants')).toEqual({
      label: 'Nelson et al. 2007, Handbook of Poisonous and Injurious Plants',
    })
  })
})

describe('numberSources', () => {
  it('numbers each source once, in order of first use', () => {
    const numbers = numberSources([['a', 'b'], undefined, ['b', 'c']])
    expect([...numbers]).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
  })
})
