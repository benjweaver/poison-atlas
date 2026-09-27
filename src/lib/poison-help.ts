// Where to call about a poisoning. The atlas shows the poison centre for the
// country being viewed; with no country open, the one for the region the
// browser's language settings name ("en-GB"). That's a hint, not where the
// visitor is, so the country is always named alongside the number.
import type { PoisonCentre } from '@/data/schema'

export interface Help {
  /** Country code, and its name as shown. */
  country: string
  place: string
  centre: PoisonCentre
}

/** The first region named in the browser's languages ("en-GB" → "GB"), if any. */
export function languageRegion(languages: readonly string[]): string | null {
  for (const tag of languages) {
    try {
      const region = new Intl.Locale(tag).region
      if (region && /^[A-Z]{2}$/.test(region)) return region
    } catch {
      // Not a valid language tag; try the next.
    }
  }
  return null
}

export function helpFor(
  country: string | null,
  centres: Record<string, PoisonCentre>,
  name: (code: string) => string,
): Help | null {
  const centre = country ? centres[country] : undefined
  return country && centre ? { country, place: name(country), centre } : null
}
