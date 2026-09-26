// How species map onto places.
//
// A species lists either whole countries ("MX") or individual states/provinces
// ("US-AZ"), never both for one country (the loader enforces that). So:
//
//   - A country contains a species if any of its codes belong to that country.
//   - A state contains a species if it's listed by name, OR the species is
//     listed for the whole country. The second case is flagged `countryWide`
//     so the UI can say the data isn't broken down further, rather than
//     implying it's been confirmed in that state.
import type { Species } from '@/data/schema'

export const countryOf = (code: string): string => code.slice(0, 2)
export const isSubdivision = (code: string): boolean => code.length > 2

export function inCountry(species: Species, country: string): boolean {
  return species.regions.some((code) => countryOf(code) === country)
}

export type Presence = 'listed' | 'countryWide' | undefined

export function presenceIn(species: Species, code: string): Presence {
  if (!isSubdivision(code)) return inCountry(species, code) ? 'listed' : undefined
  if (species.regions.includes(code)) return 'listed'
  if (species.regions.includes(countryOf(code))) return 'countryWide'
  return undefined
}

export interface Match {
  species: Species
  countryWide: boolean
}

/** Species found in a country or state, most dangerous first. */
export function speciesIn(all: Species[], code: string): Match[] {
  const matches: Match[] = []
  for (const species of all) {
    const presence = presenceIn(species, code)
    if (presence) matches.push({ species, countryWide: presence === 'countryWide' })
  }
  return matches.sort(
    (a, b) => b.species.danger - a.species.danger || a.species.name.localeCompare(b.species.name),
  )
}

/** Number of species per country — drives the world map shading. */
export function countsByCountry(all: Species[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const species of all) {
    for (const country of new Set(species.regions.map(countryOf))) {
      counts.set(country, (counts.get(country) ?? 0) + 1)
    }
  }
  return counts
}

/** Number of species per state within one country, counting country-wide species in every state. */
export function countsBySubdivision(all: Species[], subdivisions: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const code of subdivisions) {
    counts.set(code, all.filter((s) => presenceIn(s, code)).length)
  }
  return counts
}

/** Every code a species should light up on the map when selected. */
export function highlightCodes(species: Species): { countries: string[]; subdivisions: string[] } {
  return {
    countries: species.regions.filter((c) => !isSubdivision(c)),
    subdivisions: species.regions.filter(isSubdivision),
  }
}
