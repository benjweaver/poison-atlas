// The shape of one species file in data/species/*.yaml.
//
// This is the only definition. The build validates every file against it
// (scripts/species-loader.ts), and the app takes its types from it, so a field
// can't be added to the data without the UI's types knowing about it.
import { z } from 'zod'

import { GROUPS } from './taxonomy.ts'

// "US" is a whole country; "US-AZ" is a state/province. Whether a code
// actually exists on the map is checked by the loader, which knows the
// boundary files — the schema only checks the format.
export const regionCode = z
  .string()
  .regex(/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/, 'expected an ISO code like "AU" or "US-AZ"')

// A hand-made change to a species' places. Every one carries its source, so
// the site can show why a place is (or isn't) listed and anyone can check it.
export const citedRegion = z
  .object({
    code: regionCode,
    // A checklist, paper or web page that supports the change (a URL or a
    // citation), not an opinion.
    source: z.string().min(1, 'every hand-made change needs a source'),
    // What was wrong, for exclusions: "introduced", "misidentified P. miles".
    reason: z.string().optional(),
  })
  .strict()

export type CitedRegion = z.infer<typeof citedRegion>

export const speciesSchema = z
  .object({
    name: z.string().min(1),
    scientificName: z.string().min(1),
    group: z.enum(GROUPS),
    danger: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    summary: z.string().min(1).max(400),
    venom: z.string().min(1),
    habitat: z.string().min(1),
    size: z.string().optional(),
    // Wikipedia article title used to find a photo. Defaults to scientificName.
    wikipedia: z.string().optional(),
    // A specific Wikimedia Commons file to use instead ("Crotalus atrox 1.jpg"),
    // or "none" when no freely licensed photo exists.
    photo: z.string().optional(),
    regions: z.array(regionCode).min(1),
    // A cited note on how the species is defined, shown with the summary: a
    // recent split, or an entry that covers several species.
    taxonomy: z
      .object({ note: z.string().min(1), source: z.string().min(1) })
      .strict()
      .optional(),
    // Lives in the water. Its places are then exactly the territories whose
    // waters it has been recorded in (see scripts/gbif-range.ts).
    aquatic: z.enum(['marine', 'freshwater']).optional(),
    // How `npm run ranges` treats this species. See scripts/gbif-range.ts.
    gbif: z
      .object({
        // Name to look up on GBIF, when scientificName doesn't match there.
        name: z.string().optional(),
        // Places GBIF has records for that aren't real range: captive animals,
        // misidentifications. A country code excludes all of its states.
        exclude: z.array(citedRegion).optional(),
        // Places to keep even though the data has too few records there.
        include: z.array(citedRegion).optional(),
        // Don't propose ranges for this species at all; `regions` is maintained by hand...
        manual: z.literal(true).optional(),
        // ...from this source, which the site cites for every place listed.
        source: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export type SpeciesFile = z.infer<typeof speciesSchema>

// Written by `npm run images` into data/images.json. Every photo must carry its
// author and licence — Wikimedia's free licences require attribution.
export const imageSchema = z
  .object({
    src: z.url(),
    page: z.url(),
    artist: z.string(),
    license: z.string(),
    licenseUrl: z.url().optional(),
  })
  .strict()

export type SpeciesImage = z.infer<typeof imageSchema>

/** Why a place is listed, as shown on the site. */
export type Evidence =
  | { kind: 'records'; count: number }
  | { kind: 'checklist'; source: string }
  | { kind: 'cited'; source: string }

export interface Species extends SpeciesFile {
  slug: string
  image?: SpeciesImage
  /** GBIF taxon the range came from, for the "range data" link. */
  gbifKey?: number
  /** Has a record grid (dots on the map) at public/occurrence/<slug>.json. */
  records?: boolean
  /** Listed places with no records: known from checklists or review only. */
  unrecorded?: string[]
  /** For each listed place, what supports it. */
  evidence?: Record<string, Evidence[]>
}
