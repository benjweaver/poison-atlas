// npm run images            — find a photo for every species that lacks one
// npm run images -- --all   — re-fetch every photo (e.g. to pick up a changed lead image)
// npm run images -- <slug>  — re-fetch one species
//
// Uses the lead image of the species' Wikipedia article, then looks the file
// up on Wikimedia Commons for its author and licence. Only freely licensed
// Commons files are accepted; an article whose lead image is a local fair-use
// upload is skipped with a message, and you can point `wikipedia:` in the
// species file at a different article.
//
// Results go to data/images.json, which is committed: builds never hit the
// network, and the credits shown on the site are reviewable in a diff.
import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'

import { parse } from 'yaml'

import { speciesSchema, type SpeciesImage } from '../src/data/schema.ts'
import { IMAGES_FILE, readImages, speciesFiles } from './species-loader.ts'

// Wikimedia asks API clients to identify themselves:
// https://meta.wikimedia.org/wiki/User-Agent_policy
const HEADERS = { 'User-Agent': 'poison-atlas/0.1 (image credit sync; build-time only)' }
// Commons serves a fixed set of thumbnail widths from cache; 960 is one of them.
const WIDTH = 960

// Titles per request. The API allows 50; Commons is kept lower because each
// file also asks for a thumbnail.
const BATCH = { wikipedia: 50, commons: 25 }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// The slice of the MediaWiki query response this script reads.
interface ApiResponse {
  query?: {
    search?: { title: string }[]
    normalized?: { from: string; to: string }[]
    redirects?: { from: string; to: string }[]
    pages?: {
      title: string
      missing?: boolean
      pageimage?: string
      imageinfo?: {
        url: string
        thumburl?: string
        descriptionurl: string
        extmetadata?: Record<string, { value: string } | undefined>
      }[]
    }[]
  }
}

// Requests go one at a time with a pause between them, and a 429 is retried
// after the delay the server asks for, since Wikimedia rate-limits bursts hard.
// Titles are batched, so a full run is a handful of requests, not hundreds.
async function api(host: string, params: Record<string, string>): Promise<ApiResponse> {
  const url = new URL(`https://${host}/w/api.php`)
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString()
  for (let attempt = 1; ; attempt++) {
    await sleep(1000)
    const res = await fetch(url, { headers: HEADERS })
    if (res.ok) return (await res.json()) as ApiResponse
    if (res.status !== 429 || attempt === 5) throw new Error(`${url}: HTTP ${res.status}`)
    const wait = Number(res.headers.get('retry-after')) || 5 * attempt
    console.log(`  rate limited, waiting ${wait}s`)
    await sleep(wait * 1000)
  }
}

const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  )

// The API answers under the page's final title, so follow its normalisation
// ("crotalus atrox" → "Crotalus atrox") and redirects back to what was asked.
function finalTitles(query: NonNullable<ApiResponse['query']>): (title: string) => string {
  const step = (list?: { from: string; to: string }[]) =>
    new Map((list ?? []).map((r) => [r.from, r.to]))
  const normalized = step(query.normalized)
  const redirects = step(query.redirects)
  return (title) => {
    const n = normalized.get(title) ?? title
    return redirects.get(n) ?? n
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Article title → file name of its lead image. */
async function leadImages(titles: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>()
  for (const batch of chunks(titles, BATCH.wikipedia)) {
    const { query } = await api('en.wikipedia.org', {
      action: 'query',
      prop: 'pageimages',
      piprop: 'name',
      redirects: '1',
      titles: batch.join('|'),
    })
    if (!query) continue
    const resolve = finalTitles(query)
    const byTitle = new Map((query.pages ?? []).map((p) => [p.title, p.pageimage]))
    for (const title of batch) {
      const image = byTitle.get(resolve(title))
      if (image) found.set(title, image)
    }
  }
  return found
}

/**
 * Fallback for articles without a lead image: a Commons file whose title
 * contains the exact scientific name. Requiring the name in the title keeps
 * this from picking a photo of some other species.
 */
async function commonsSearch(scientificName: string): Promise<string | undefined> {
  const { query } = await api('commons.wikimedia.org', {
    action: 'query',
    list: 'search',
    srnamespace: '6',
    srlimit: '10',
    srsearch: `intitle:"${scientificName}" filetype:bitmap`,
  })
  return query?.search
    ?.map((r) => r.title.replace(/^File:/, ''))
    .find((t) => t.toLowerCase().includes(scientificName.toLowerCase()))
}

/** Commons file name → credited image, for freely licensed files only. */
async function commonsInfo(files: string[]): Promise<Map<string, SpeciesImage>> {
  const found = new Map<string, SpeciesImage>()
  for (const batch of chunks(files, BATCH.commons)) {
    const { query } = await api('commons.wikimedia.org', {
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: String(WIDTH),
      titles: batch.map((f) => `File:${f}`).join('|'),
    })
    if (!query) continue
    const resolve = finalTitles(query)
    const byTitle = new Map((query.pages ?? []).map((p) => [p.title, p]))
    for (const file of batch) {
      const page = byTitle.get(resolve(`File:${file}`))
      const info = page?.imageinfo?.[0]
      const meta = info?.extmetadata ?? {}
      const license = meta.LicenseShortName?.value
      if (!info || page?.missing || !license) continue
      found.set(file, {
        src: info.thumburl ?? info.url,
        page: info.descriptionurl,
        artist: stripHtml(meta.Artist?.value ?? 'Unknown'),
        license: stripHtml(license),
        ...(meta.LicenseUrl?.value ? { licenseUrl: meta.LicenseUrl.value } : {}),
      })
    }
  }
  return found
}

// Drops credits for species that no longer exist, and sorts so diffs stay small.
function save() {
  const slugs = new Set(speciesFiles().map((f) => basename(f, '.yaml')))
  const sorted = Object.fromEntries(
    Object.entries(images)
      .filter(([slug]) => slugs.has(slug))
      .sort(([a], [b]) => a.localeCompare(b)),
  )
  writeFileSync(IMAGES_FILE, JSON.stringify(sorted, null, 2) + '\n')
}

const args = process.argv.slice(2)
const all = args.includes('--all')
const only = args.filter((a) => !a.startsWith('--'))
const images = readImages()
let failures = 0

const wanted: { slug: string; title: string; scientificName: string; photo?: string }[] = []
for (const file of speciesFiles()) {
  const slug = basename(file, '.yaml')
  if (only.length ? !only.includes(slug) : !all && images[slug]) continue
  const species = speciesSchema.safeParse(parse(readFileSync(file, 'utf8')))
  if (!species.success) {
    console.warn(`✗ ${slug}: invalid file — run: npm run validate`)
    failures++
    continue
  }
  if (species.data.photo === 'none') continue
  wanted.push({
    slug,
    title: species.data.wikipedia ?? species.data.scientificName,
    scientificName: species.data.scientificName,
    photo: species.data.photo,
  })
}

// Which file each species uses: the one named in its file, else its article's
// lead image, else a Commons search on its scientific name.
const leads = await leadImages(wanted.filter((w) => !w.photo).map((w) => w.title))
const chosen = new Map<string, string>()
for (const w of wanted) {
  const file = w.photo ?? leads.get(w.title) ?? (await commonsSearch(w.scientificName))
  if (file) chosen.set(w.slug, file)
}
const credits = await commonsInfo([...new Set(chosen.values())])

for (const { slug, title } of wanted) {
  const name = chosen.get(slug)
  const image = name && credits.get(name)
  if (!image) {
    console.warn(
      name
        ? `✗ ${slug}: lead image of "${title}" (${name}) is not a free Commons file — set wikipedia: to another article`
        : `✗ ${slug}: no photo found for "${title}" — set photo: to a Commons file, or photo: none`,
    )
    failures++
    continue
  }
  images[slug] = image
  console.log(`✓ ${slug}: ${name} (${image.license}, ${image.artist})`)
}

save()
if (failures) process.exit(1)
