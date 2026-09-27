// How a source string is shown. Sources are written as a bare URL, a citation,
// or a citation followed by its URL ("StatPearls: Mushroom Toxicity.
// https://www.ncbi.nlm.nih.gov/books/NBK441906/"); the link is the URL, and
// its label the citation, or the site's name when there's only a URL.

export interface SourceLink {
  label: string
  url?: string
}

export function sourceLink(source: string): SourceLink {
  const url = source.match(/https?:\/\/\S+/)?.[0]?.replace(/[.,;)]+$/, '')
  if (!url) return { label: source.trim() }
  const label = source
    .replace(url, '')
    .replace(/[\s:–—-]+$/, '')
    .trim()
  return { label: label || hostOf(url), url }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Numbers every distinct source across a species' claims, in the order they
 * first appear, so each claim can point to its entries in one list.
 */
export function numberSources(lists: (string[] | undefined)[]): Map<string, number> {
  const numbers = new Map<string, number>()
  for (const list of lists) {
    for (const source of list ?? []) if (!numbers.has(source)) numbers.set(source, numbers.size + 1)
  }
  return numbers
}
