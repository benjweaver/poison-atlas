// The page's title, description and canonical address, kept in step with what's
// open. Search engines run the app's JavaScript and read these, so each
// species and place can be found (and shown) as a page of its own.
export const SITE = 'https://poison-atlas.benjweaver.dev'

function tag<T extends HTMLElement>(selector: string, create: () => T): T {
  return (document.head.querySelector<T>(selector) ?? document.head.appendChild(create())) as T
}

export function setHead({
  title,
  description,
  path,
}: {
  title: string
  description: string
  path: string
}) {
  document.title = title
  tag<HTMLMetaElement>('meta[name="description"]', () => {
    const m = document.createElement('meta')
    m.name = 'description'
    return m
  }).content = description
  tag<HTMLLinkElement>('link[rel="canonical"]', () => {
    const l = document.createElement('link')
    l.rel = 'canonical'
    return l
  }).href = SITE + path
}
