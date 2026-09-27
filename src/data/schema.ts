// The shape of one species file in data/species/*.yaml.
//
// This is the only definition. The build validates every file against it
// (scripts/species-loader.ts), and the app takes its types from it, so a field
// can't be added to the data without the UI's types knowing about it.
import { z } from 'zod'

import { ANIMALS, GROUPS, ROUTES } from './taxonomy.ts'

// "US" is a whole country; "US-AZ" is a state/province. Whether a code
// actually exists on the map is checked by the loader, which knows the
// boundary files — the schema only checks the format.
export const regionCode = z
  .string()
  .regex(/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/, 'expected an ISO code like "AU" or "US-AZ"')

// Where a claim comes from: a URL, or a full citation, of something actually
// read. Every toxicity claim carries at least one, as every place does.
const sources = z.array(z.string().min(1)).min(1, 'every claim needs a source')

/** A statement about the species and what supports it. */
export const claim = z.object({ text: z.string().min(1), sources }).strict()

export type Claim = z.infer<typeof claim>

// A hand-made change to a species' places. Every one carries its source, so
// the site can show why a place is (or isn't) listed and anyone can check it.
export const citedRegion = z
  .object({
    code: regionCode,
    // A checklist, paper or web page that supports the change (a URL or a
    // citation), not an opinion.
    source: z.string().min(1, 'every hand-made change needs a source'),
    // What was wrong, for exclusions: "only cultivated", "misidentified A. ocreata".
    reason: z.string().optional(),
  })
  .strict()

export type CitedRegion = z.infer<typeof citedRegion>

// An addition can also say the place is introduced (naturalised or invasive)
// rather than native. It then decides the place's status either way.
const citedInclude = citedRegion.extend({ introduced: z.literal(true).optional() }).strict()

export type CitedInclude = z.infer<typeof citedInclude>

/** A species it's mistaken for, and who mixes them up. */
export const lookalike = z
  .object({
    name: z.string().min(1),
    scientificName: z.string().min(1),
    note: z.string().min(1),
    sources,
  })
  .strict()

export type Lookalike = z.infer<typeof lookalike>

const noRepeats = <T>(list: T[]) => new Set(list).size === list.length

export const speciesSchema = z
  .object({
    name: z.string().min(1),
    scientificName: z.string().min(1),
    group: z.enum(GROUPS),
    danger: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    summary: z.string().min(1).max(400),
    // How it poisons: eaten, touched, breathed in (including smoke), in the
    // eyes, or on the skin followed by sunlight.
    exposure: z
      .object({
        routes: z.array(z.enum(ROUTES)).min(1).refine(noRepeats, 'a route is listed twice'),
        text: z.string().min(1).optional(),
        sources,
      })
      .strict(),
    toxicParts: claim,
    toxins: claim,
    symptoms: claim,
    // How soon symptoms start, where a source says. `delayed` marks a species
    // whose symptoms can start hours or days after exposure, when treatment is
    // already late: the site then says to call poison control without waiting
    // for symptoms. Left out, rather than guessed, when no source gives it.
    onset: claim
      .extend({ delayed: z.literal(true).optional() })
      .strict()
      .optional(),
    atRisk: claim,
    // Eaten after traditional processing (cassava, ackee): says that it's
    // toxic raw or unripe, with the source. Never the method.
    processing: claim.optional(),
    // Species it's mistaken for. Linked on the site when they're in the atlas.
    lookalikes: z.array(lookalike).optional(),
    // Also dangerous to pets or livestock, as a cited flag.
    animals: z
      .object({
        who: z.array(z.enum(ANIMALS)).min(1).refine(noRepeats, 'an animal is listed twice'),
        text: z.string().min(1).optional(),
        sources,
      })
      .strict()
      .optional(),
    // Grown in gardens, homes or fields far beyond its wild range. Those
    // places aren't mapped, so this says so.
    cultivated: claim.optional(),
    habitat: z.string().min(1),
    size: z.string().optional(),
    // Wikipedia article title used to find a photo. Defaults to scientificName.
    wikipedia: z.string().optional(),
    // A specific Wikimedia Commons file to use instead, or "none" when no
    // freely licensed photo exists.
    photo: z.string().optional(),
    // Where it's native. Written by `npm run ranges`, like `introduced`.
    regions: z.array(regionCode).min(1),
    // Where it's been introduced and established (naturalised or invasive).
    // Places where it's only cultivated or kept aren't listed.
    introduced: z.array(regionCode).optional(),
    // A cited note on how the species is defined, shown with the summary: a
    // recent split, or an entry that covers several species.
    taxonomy: z
      .object({ note: z.string().min(1), source: z.string().min(1) })
      .strict()
      .optional(),
    // Lives in the water. Its places are then the territories whose waters it
    // has been recorded in (see scripts/gbif-range.ts).
    aquatic: z.enum(['marine', 'freshwater']).optional(),
    // How `npm run ranges` treats this species. See scripts/gbif-range.ts.
    gbif: z
      .object({
        // Name to look up on GBIF, when scientificName doesn't match there.
        name: z.string().optional(),
        // Places the data wrongly includes: cultivated plants, captive animals,
        // misidentifications. A country code excludes all of its states.
        exclude: z.array(citedRegion).optional(),
        // Places to list even though the data misses them, and places whose
        // status the data gets wrong (with `introduced: true` or without).
        include: z.array(citedInclude).optional(),
        // Don't propose ranges for this species at all; the lists are kept by hand...
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

/**
 * Where to call about a poisoning, per country, in data/poison-centres.yaml.
 * Every entry is checked on the centre's (or health service's) own site.
 */
export const poisonCentreSchema = z
  .object({
    // Who answers: "Poison Help", "NHS 111".
    name: z.string().min(1),
    // The number as people there write it...
    phone: z.string().min(1),
    // ...and as dialled from a phone there, for tel: links.
    tel: z.string().regex(/^\+?[0-9]+$/, 'digits only, optionally starting with +'),
    // Hours, cost, or who the line is for.
    note: z.string().min(1).optional(),
    // The page the number was checked on, and when.
    source: z.url(),
    checked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'a date like 2026-09-26'),
  })
  .strict()

export type PoisonCentre = z.infer<typeof poisonCentreSchema>

/** Why a place is listed, as shown on the site. */
export type Evidence =
  | { kind: 'records'; count: number }
  | { kind: 'checklist'; source: string }
  | { kind: 'cited'; source: string }

/** A lookalike, with its page when it's in the atlas too. */
export interface ResolvedLookalike extends Lookalike {
  slug?: string
}

export interface Species extends Omit<SpeciesFile, 'lookalikes'> {
  slug: string
  image?: SpeciesImage
  lookalikes?: ResolvedLookalike[]
  /** Atlas species that list this one as their lookalike, when it doesn't
   *  list them back: shown so the link works both ways. */
  resembledBy?: { slug: string; name: string }[]
  /** GBIF taxon the range came from, for the "range data" link. */
  gbifKey?: number
  /** Has a record grid (dots on the map) at public/occurrence/<slug>.json. */
  records?: boolean
  /** Listed places with no records: known from checklists or review only. */
  unrecorded?: string[]
  /** For each listed place, native or introduced, what supports it. */
  evidence?: Record<string, Evidence[]>
}
