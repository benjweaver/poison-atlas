// How species map onto places.
//
// A species lists places where it's native (`regions`) and places where it
// was introduced and has established (`introduced`). Each place is either a
// whole country ("MX") or a state/province ("US-AZ"), never both for one
// country across the two lists (the loader enforces that). So:
//
//   - A country contains a species if any of its codes belong to that country.
//   - A state contains a species if it's listed by name, OR the species is
//     listed for the whole country. The second case is flagged `countryWide`
//     so the UI can say the data isn't broken down further, rather than
//     implying it's been confirmed in that state.
//   - Where it's there, it's native or introduced, as listed. A country whose
//     states differ counts as native if any of them is.
import type { Species } from '@/data/schema'

export const countryOf = (code: string): string => code.slice(0, 2)
export const isSubdivision = (code: string): boolean => code.length > 2

/** Every place a species is listed in, native or introduced. */
export const placesOf = (species: Species): string[] => [
  ...species.regions,
  ...(species.introduced ?? []),
]

export function inCountry(species: Species, country: string): boolean {
  return placesOf(species).some((code) => countryOf(code) === country)
}

export type Presence = 'listed' | 'countryWide' | undefined

export function presenceIn(species: Species, code: string): Presence {
  if (!isSubdivision(code)) return inCountry(species, code) ? 'listed' : undefined
  const places = placesOf(species)
  if (places.includes(code)) return 'listed'
  if (places.includes(countryOf(code))) return 'countryWide'
  return undefined
}

/**
 * Whether a species is introduced in a place rather than native: listed as
 * introduced there, or for a country, introduced in every part listed.
 */
export function introducedIn(species: Species, code: string): boolean {
  const introduced = species.introduced ?? []
  if (introduced.includes(code) || introduced.includes(countryOf(code))) return true
  if (isSubdivision(code)) return false
  const here = placesOf(species).filter((c) => countryOf(c) === code)
  return here.length > 0 && here.every((c) => introduced.includes(c))
}

export interface Match {
  species: Species
  countryWide: boolean
  introduced: boolean
}

/** Species found in a country or state, most dangerous first. */
export function speciesIn(all: Species[], code: string): Match[] {
  const matches: Match[] = []
  for (const species of all) {
    const presence = presenceIn(species, code)
    if (presence) {
      matches.push({
        species,
        countryWide: presence === 'countryWide',
        introduced: introducedIn(species, code),
      })
    }
  }
  return matches.sort(
    (a, b) => b.species.danger - a.species.danger || a.species.name.localeCompare(b.species.name),
  )
}

/** Number of species per country — drives the world map shading. */
export function countsByCountry(all: Species[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const species of all) {
    for (const country of new Set(placesOf(species).map(countryOf))) {
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
