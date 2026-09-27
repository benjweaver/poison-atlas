// A fungus name's current form in Species Fungorum, the authority for fungal
// names. Fungi are renamed and split often (the North American "destroying
// angels" were long filed as the European Amanita virosa), and GBIF's records
// follow the names they were identified under, so `npm run ranges` flags a
// fungus whose name Species Fungorum has moved on from.
//
// Index Fungorum's web service answers name searches with one XML record per
// name, including the name it's currently filed under.

const SERVICE = 'https://www.indexfungorum.org/ixfwebservice/fungus.asmx/NameSearch'

export interface FungorumRecord {
  name: string
  rank: string
  status: string
  current?: string
  currentRecord?: number
}

const decode = (text: string) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')

/** The records in a NameSearch reply. */
export function parseRecords(xml: string): FungorumRecord[] {
  return xml
    .split('<IndexFungorum>')
    .slice(1)
    .map((chunk) => {
      const field = (tag: string) => {
        const m = chunk.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
        return m ? decode(m[1]) : undefined
      }
      const currentRecord = field('CURRENT_x0020_NAME_x0020_RECORD_x0020_NUMBER')
      return {
        name: field('NAME_x0020_OF_x0020_FUNGUS') ?? '',
        rank: field('INFRASPECIFIC_x0020_RANK') ?? '',
        status: field('NAME_x0020_STATUS') ?? '',
        current: field('CURRENT_x0020_NAME'),
        currentRecord: currentRecord ? Number(currentRecord) : undefined,
      }
    })
}

/**
 * The name a species is currently filed under: from the species-rank record
 * with exactly this name that Species Fungorum has placed. Invalid and
 * unplaced records (homonyms, misapplications) have no current name.
 */
export function currentName(
  name: string,
  records: FungorumRecord[],
): { name: string; record: number } | undefined {
  const placed = records.filter(
    (r) => r.name === name && r.rank === 'sp.' && r.current && r.currentRecord,
  )
  const best = placed.find((r) => r.status === 'Legitimate') ?? placed[0]
  return best ? { name: best.current!, record: best.currentRecord! } : undefined
}

export async function currentFungusName(
  name: string,
): Promise<{ name: string; record: number } | undefined> {
  const url = new URL(SERVICE)
  url.searchParams.set('SearchText', name)
  url.searchParams.set('AnywhereInText', 'false')
  url.searchParams.set('MaxNumber', '20')
  const res = await fetch(url, { headers: { 'User-Agent': 'poison-atlas name check' } })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return currentName(name, parseRecords(await res.text()))
}
