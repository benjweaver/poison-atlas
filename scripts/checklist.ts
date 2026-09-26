// Reads the country lists in GBIF checklist distributions.
//
// Occurrence records follow people: Papua New Guinea, much of Africa and parts
// of South Asia are thinly recorded, so a species can be missing from a place
// it certainly lives. Checklists fill that gap. They are published statements
// of "this species occurs in this country", from expert databases (the
// Catalogue of Life carries the Reptile Database's ranges; WoRMS covers marine
// species). GBIF serves them as text, e.g.
//
//   "Angola, Botswana, Cameroon (Adamaoua [HR 35: 191]), N/S Democratic
//    Republic of the Congo (Zaire), Eswatini (Swaziland), ..."
//
// which this turns into country codes.

/**
 * The only checklists trusted for native range. An allowlist, because GBIF
 * mixes range statements with things that aren't: species-name registers
 * (Norway's lists every species with a Norwegian name, cone snails included),
 * taxonomy databases (Sweden's Dyntaxa) and catalogues that are careless about
 * ranges outside their own country.
 */
const TRUSTED_SOURCES = [
  /Catalogue of Life/i, // including national editions (South Africa's)
  /^World Register of Marine Species/i, // not WRiMS, its introduced-species register
  /Reptile Database/i,
  /herpetofauna/i, // national reptile and amphibian lists (Mexico's)
]
/** Alien and invasive-species registers list where a species was introduced
 *  or turned up, not where it lives (they're why a rattlesnake would otherwise
 *  be "in Belgium"). Checked first, so "alien herpetofauna of Belgium" is out. */
const ALIEN_SOURCES = /alien|introduced|invasive|non-native|exotic/i
const NOT_NATIVE = new Set(['INTRODUCED', 'INVASIVE', 'NATURALISED', 'MANAGED', 'VAGRANT'])
const NOT_PRESENT = new Set(['ABSENT', 'EXCLUDED', 'DOUBTFUL', 'IRREGULAR'])

/** One entry from GBIF's /species/{key}/distributions. */
export interface Distribution {
  source?: string
  country?: string
  locality?: string
  status?: string
  establishmentMeans?: string
}

/**
 * Countries where trusted checklists say a species is native, from either
 * ISO-coded entries or free-text country lists.
 */
export interface ChecklistCountries extends ParsedCountries {
  /** Country → the checklist(s) that list it, for citing on the site. */
  sources: Record<string, string[]>
}

/** "South African National Species Checklist (Catalogue of Life in …)" → the part before the bracket. */
export function sourceName(source: string): string {
  return source.replace(/\s*\(.*$/, '').trim()
}

export function checklistCountries(
  entries: Distribution[],
  names: Record<string, string>,
): ChecklistCountries {
  const sources: Record<string, Set<string>> = {}
  const unmatched: string[] = []
  const add = (code: string, source: string) =>
    (sources[code] ??= new Set()).add(sourceName(source))
  for (const e of entries) {
    const source = e.source ?? ''
    if (ALIEN_SOURCES.test(source) || !TRUSTED_SOURCES.some((re) => re.test(source))) continue
    if (e.status && NOT_PRESENT.has(e.status)) continue
    if (e.establishmentMeans && NOT_NATIVE.has(e.establishmentMeans)) continue
    if (e.country && /^[A-Z]{2}$/.test(e.country)) {
      add(e.country, source)
    } else if (e.locality) {
      const parsed = parseCountries(e.locality, names)
      parsed.codes.forEach((c) => add(c, source))
      unmatched.push(...parsed.unmatched)
    }
  }
  const codes = Object.keys(sources).sort()
  return {
    codes,
    unmatched,
    sources: Object.fromEntries(codes.map((c) => [c, [...sources[c]].sort()])),
  }
}

// Names checklists use that Natural Earth doesn't (older or regional names).
// Islands and regions belonging to one country map to it; ones shared between
// countries (Borneo, New Guinea) are left out rather than guessed.
const ALIASES: Record<string, string> = {
  usa: 'US',
  'united states': 'US',
  zaire: 'CD',
  'dr congo': 'CD',
  'congo kinshasa': 'CD',
  'congo brazzaville': 'CG',
  burma: 'MM',
  swaziland: 'SZ',
  rsa: 'ZA',
  'ivory coast': 'CI',
  'cote divoire': 'CI',
  'guinea conakry': 'GN',
  'east timor': 'TL',
  'timor leste': 'TL',
  'west papua': 'ID',
  'irian jaya': 'ID',
  papua: 'ID',
  sumatra: 'ID',
  java: 'ID',
  sulawesi: 'ID',
  celebes: 'ID',
  bali: 'ID',
  lombok: 'ID',
  flores: 'ID',
  moluccas: 'ID',
  maluku: 'ID',
  kalimantan: 'ID',
  sabah: 'MY',
  sarawak: 'MY',
  'peninsular malaysia': 'MY',
  'west malaysia': 'MY',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'great britain': 'GB',
  britain: 'GB',
  sicily: 'IT',
  sardinia: 'IT',
  corsica: 'FR',
  crete: 'GR',
  'canary islands': 'ES',
  'balearic islands': 'ES',
  madeira: 'PT',
  azores: 'PT',
  zanzibar: 'TZ',
  pemba: 'TZ',
  socotra: 'YE',
  'sri lanka ceylon': 'LK',
  ceylon: 'LK',
  persia: 'IR',
  'viet nam': 'VN',
  'lao pdr': 'LA',
  'south korea': 'KR',
  'north korea': 'KP',
  korea: 'KR',
  'hong kong': 'HK',
  macau: 'MO',
  macao: 'MO',
  'solomon islands': 'SB',
  'new britain': 'PG',
  'new ireland': 'PG',
  bougainville: 'PG',
  'bismarck archipelago': 'PG',
  trinidad: 'TT',
  tobago: 'TT',
  'cape verde': 'CV',
  'sao tome': 'ST',
  'republic of south sudan': 'SS',
  'south sudan': 'SS',
  rss: 'SS',
  'guinea bissau': 'GW',
  gambia: 'GM',
  'the gambia': 'GM',
  somaliland: 'SO',
  'western sahara': 'EH',
  russia: 'RU',
  'russian federation': 'RU',
  syria: 'SY',
  iran: 'IR',
  czechia: 'CZ',
  'czech republic': 'CZ',
  macedonia: 'MK',
  'north macedonia': 'MK',
  moldova: 'MD',
  'the netherlands': 'NL',
  holland: 'NL',
  surinam: 'SR',
  'st helena': 'SH',
  'saint helena': 'SH',
  jeju: 'KR',
  'jeju island': 'KR',
  'st thomas': 'VI',
  hawaii: 'US',
}

// Words that qualify a place without changing which country it is:
// "N Namibia", "extreme SE Arizona", "coastal Kenya".
const QUALIFIERS = new Set(
  'n s e w ne nw se sw nne nnw sse ssw ene ese wnw wsw c central north south east west northern southern eastern western northeastern northwestern southeastern southwestern northeast northwest southeast southwest extreme far coastal lowland highland upper lower mainland probably possibly'.split(
    ' ',
  ),
)

/** Lowercase, no accents or punctuation, single spaces, no leading "the". */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[''`.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '')
}

/** Splits on commas and semicolons that aren't inside brackets. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
    if ((ch === ',' || ch === ';') && depth === 0) {
      parts.push(current)
      current = ''
    } else current += ch
  }
  parts.push(current)
  return parts
}

/**
 * A country for a normalised name. Tries the name as written first, then with
 * direction words peeled off one at a time, so "South Africa" and "Central
 * African Republic" match as themselves while "N Namibia" still finds Namibia.
 */
function lookup(name: string, names: Record<string, string>): string | undefined {
  const words = name.split(' ')
  while (words.length) {
    const key = words.join(' ')
    // "Republic of South Africa", "Kingdom of Tonga", "State of Eritrea".
    const bare = key.replace(/^(republic|kingdom|state|commonwealth|union) of /, '')
    const found = ALIASES[key] ?? names[key] ?? ALIASES[bare] ?? names[bare]
    if (found) return found
    if (!QUALIFIERS.has(words[0])) return undefined
    words.shift()
  }
  return undefined
}

export interface ParsedCountries {
  codes: string[]
  /** Pieces that named no known country, for spotting gaps in the aliases. */
  unmatched: string[]
}

export function parseCountries(text: string, names: Record<string, string>): ParsedCountries {
  const codes = new Set<string>()
  const unmatched: string[] = []
  // "Canada, USA, Mexico. Introduced to Israel, Korea": only the native part.
  const native = text.split(/\bintroduced\b/i)[0]
  for (const piece of splitTopLevel(native)) {
    // "tergeminus: USA (Iowa, Texas)": subspecies-by-subspecies lists.
    const raw = piece.replace(/^\s*[a-z]+:\s*/, '')
    // "Guinea (Conakry)" → "Guinea"; also try what's in the brackets, which is
    // sometimes the better-known name ("Eswatini (Swaziland)"). GBIF truncates
    // long entries, so a bracket left open runs to the end.
    const inside = [...raw.matchAll(/\(([^()]*)\)/g)].map((m) => m[1])
    const outside = raw.replace(/\([^()]*\)|\[[^\]]*\]/g, ' ').replace(/[([].*$/, ' ')
    let found: string | undefined
    for (const candidate of [outside, ...inside]) {
      for (const part of candidate.split(/\s+and\s+|\//)) {
        found = lookup(normalizeName(part), names)
        if (found) break
      }
      if (found) break
    }
    if (found) codes.add(found)
    else if (normalizeName(outside)) unmatched.push(raw.trim())
  }
  return { codes: [...codes].sort(), unmatched }
}
