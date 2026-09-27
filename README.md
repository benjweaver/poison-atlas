# Poison Atlas

An interactive world map of poisonous plants, fungi, and animals: species that
can seriously harm people who eat, touch, or breathe them. Click a country to
see what grows or lives there, click a state or province to narrow it down,
and click a species to see what makes it dangerous, what it's mistaken for,
and where it's native or introduced.

> **Not an identification or foraging guide, and not medical advice.** Never
> eat a wild plant or mushroom because of anything here, and don't take a
> species' absence to mean it's safe. If someone may have been poisoned, call
> poison control now (in the US, 1-800-222-1222) or your local emergency
> number, even before symptoms start.

It's the sibling of [Venom Atlas](https://venom-atlas.benjweaver.dev), which
maps animals that bite or sting, and it started from that site's code.

**Vue 3 · TypeScript · MapLibre GL · Tailwind · Vite.** It's a static site with
no server, database, or API keys, and it deploys anywhere that serves files.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # everything CI runs: validate, lint, typecheck, test, build
```

## What's in scope

**Species that can seriously harm a person** who eats, touches, or breathes
them: the plants, mushrooms, and animals behind real poisonings, not every
mildly irritating plant. Houseplants are in only when they meet the same bar.
Danger to pets and livestock is shown as a cited flag on species that are
already in scope; species that only harm animals are left out. Venomous
animals, which inject their toxins, are in Venom Atlas instead.

## Adding or editing a species

All content lives in `data/species/`, one YAML file per species. That's the
only place to edit.

```bash
npm run new -- "Conium maculatum"          # 1. creates data/species/conium-maculatum.yaml
#                                            2. fill in the claims, each with its sources
npm run images -- conium-maculatum         # 3. photo + credits from Wikimedia Commons
npm run ranges -- conium-maculatum         # 4. native and introduced places, as a diff: review it
npm run ranges -- conium-maculatum --write # 5. accept it
npm run validate
```

A species file, shortened:

```yaml
name: Death cap
scientificName: Amanita phalloides
group: fungus # plant · fungus · amphibian · fish · reptile · insect · other
danger: 5 # 1 harmful · 2 medically significant · 3 serious · 4 potentially fatal · 5 extremely dangerous
summary: >-
  One or two sentences for the card.
exposure:
  routes: [eaten] # eaten · skin · inhaled · eyes · sunlight
  sources: ['https://…']
toxicParts: { text: …, sources: [...] }
toxins: { text: …, sources: [...] }
symptoms: { text: …, sources: [...] }
onset: # optional: only where a source gives the timing
  text: Delayed: no symptoms for 6 to 24 hours, …
  delayed: true # puts "don't wait for symptoms" on the page
  sources: [...]
atRisk: { text: …, sources: [...] }
processing: { text: Toxic raw. …, sources: [...] } # optional; never the method
lookalikes: # optional; linked when the lookalike is in the atlas too
  - name: Paddy straw mushroom
    scientificName: Volvariella volvacea
    note: Who mixes them up, and when.
    sources: [...]
animals: { who: [dogs, cats, horses, livestock], sources: [...] } # optional flag
cultivated: { text: Grown in gardens …, sources: [...] } # optional
habitat: >-
  Where it grows or lives.
regions: [FR, DE] # native, written by npm run ranges
introduced: [US-CA] # naturalised or invasive, written by npm run ranges
gbif: # optional corrections, each with a source you have read
  include: [{ code: AU-NSW, introduced: true, reason: …, source: 'https://…' }]
  exclude: [{ code: FO, reason: …, source: 'https://…' }]
```

**Every claim has a source**, and the schema rejects one without: poison
centres, clinical references, government health agencies, peer-reviewed case
reports, and authoritative checklists. Sources are written as a citation
followed by its URL. **Never** write preparation, extraction, or dosage
information; for something eaten after traditional processing, say it's toxic
raw and cite the source, without the method.

## Ranges: native and introduced

`npm run ranges` asks [GBIF](https://www.gbif.org) where each species has been
recorded, and checklists whether it's native or introduced there. Nothing
changes until you add `--write`.

- **Wild records only.** No zoo, garden, or fossil specimens, nothing flagged
  with a location problem, only records from 1950 on, and records GBIF marks as
  cultivated, captive, released, or casual are subtracted.
- **Enough records.** A place needs a minimum number (2 to 5, scaling with how
  well recorded the species is) and a tiny share of all its records. Where a
  checklist already names the place as native range, the share is waived, so a
  thinly recorded native range isn't drowned out by an invaded one.
- **Plants: the World Checklist of Vascular Plants decides.** WCVP, served
  through GBIF, gives native or introduced status by "botanical country"
  (TDWG level 3). `data/tdwg.json` (`npm run tdwg`) lines those up with the
  map's places by overlapping their shapes. A plant is listed only where WCVP
  knows it: records elsewhere are usually garden plants. A botanical country
  that one place holds nearly all of (Alabama, Great Britain) is listed even
  without records; one that spans several (Mexico Northwest) needs records to
  say which states.
- **Animals and fungi:** native-range checklists (Catalogue of Life, WoRMS)
  add native countries; registers of introduced species (GRIIS, WRiMS) mark a
  recorded place introduced but never list one on their own. Fungi need more
  records, and more again when every record is an iNaturalist photo, and
  `npm run ranges` warns when Species Fungorum has renamed one.
- **Corrections** go in `gbif.include` (add a place, or settle its status with
  `introduced: true`) and `gbif.exclude`, each with a source you have read.

On the map, native places are filled and introduced ones hatched orange, with
record dots coloured to match. Places known only from a checklist are faint
and dashed. Places where a species is only grown or kept aren't shown; a
`cultivated` note says so instead.

## Poison centres

`data/poison-centres.yaml` holds a public poison line per country, each checked
on the service's own site and dated. The site shows the one for the country on
the map, or the region the browser's languages name, always with the country
named. A centre that only takes calls from health professionals doesn't
belong there; the public route does (NHS 111 in the UK).

## Theme, offline and icons

- **Light and dark.** The button by the title cycles System → Light → Dark.
  `src/lib/theme.ts` writes the result to `<html data-theme>`, `style.css`
  keys the dark palette off it, and the map re-reads its colours when it
  changes. The choice is remembered in the browser. `index.html` repeats the
  logic inline so the right theme is there before the first paint.
- **Installable and offline** (`vite-plugin-pwa`, configured in
  `vite.config.ts`). The first visit caches the app and the world map. Each
  country's states, the record dots and the photos are cached as they're
  viewed, so anything you've looked at works offline. New deploys replace the
  cache automatically.
- **Icons.** `public/favicon.svg` is the nightshade-purple mark (`#7b3f9e`), a
  sibling of Venom Atlas's.
  The PNGs in `public/icons/` (app icons and the Apple touch icon) are
  rendered from `favicon.svg` and `public/icons/app.svg`. To regenerate them,
  use any SVG-to-PNG tool at 192, 512 (and 512 maskable, from `app.svg`) and
  180 px, for example with [sharp](https://sharp.pixelplumbing.com/).

## Search engines

- `index.html` has the title, description, canonical address, link-preview
  tags (image: `public/og.png`), and schema.org data for the site.
- `src/lib/head.ts` sets the title, description and canonical address for
  whatever is open, such as "Poisonous species in South Carolina", so search
  engines (which run the app's JavaScript) can list each species and place.
- The build writes `sitemap.xml` from the species data: every species and every
  place with one (`scripts/vite-plugin-species.ts`). `public/robots.txt` points
  to it.
- Preview builds on `*.workers.dev` add `noindex`, so only the real address is
  indexed.

## Deploying

`npm run build` produces `dist/`, a folder of static files.

**Cloudflare (planned for https://poison-atlas.benjweaver.dev).** Cloudflare
Workers serves `dist/` as static files, configured in `wrangler.jsonc`.
Cloudflare builds straight from the repo: every push to `main` runs
`npm run build` then `npx wrangler deploy`, and other branches get preview
URLs. GitHub Actions (`.github/workflows/ci.yml`) only checks pushes and pull
requests; it doesn't deploy.

**Anywhere else.** Any static host works (Netlify, Vercel, S3): build command
`npm run build`, output directory `dist`. The site must be served from the root
of a domain or subdomain.

There are no client-side routes, because view state lives in the query string
(`?r=US-AZ&s=crotalus-atrox`). No host needs rewrite rules, and every view is a
shareable link.

## How it fits together

```
data/species/*.yaml ──┐
data/images.json ─────┼─► scripts/species-loader.ts ─► validate ─► virtual:species ─► App.vue
public/geo/*.json ────┘       (zod schema + region-code checks)          (Vite plugin)
      ▲
      └── npm run boundaries  (Natural Earth → simplified GeoJSON, committed)
```

| Path                             | What it is                                                                |
| -------------------------------- | ------------------------------------------------------------------------- |
| `scripts/tdwg.ts`                | Lines up WCVP's botanical countries with the map's places                 |
| `src/data/schema.ts`             | The species schema: one definition for validation and for the app's types |
| `src/lib/regions.ts`             | Which species are in which place (pure, unit-tested)                      |
| `src/lib/geo.ts`                 | Loads boundaries on demand; works out where to point the camera           |
| `src/components/AtlasMap.vue`    | MapLibre map. Draws GeoJSON on a plain background, with no tile server    |
| `scripts/vite-plugin-species.ts` | Validates the data as part of the build; reloads dev on YAML edits        |
| `scripts/build-boundaries.ts`    | Regenerates `public/geo/` from Natural Earth                              |
| `public/geo/countries.json`      | Every country (≈380 kB), loaded up front                                  |
| `public/geo/admin1/<CC>.json`    | One country's states/provinces, loaded when it's opened                   |

**Boundaries** come from [Natural Earth](https://www.naturalearthdata.com/)
(public domain): 1:50m countries and 1:10m states/provinces, simplified.
`npm run boundaries` rebuilds them (it downloads about 45 MB once, into
`.cache/`). France's overseas departments are split out into their own regions
so that "FR" means metropolitan France.

## Known limits

- Ranges are simplified to whole countries or states, and they're only as good
  as GBIF's records, the checklists, and human review (see above). A big
  country listed whole (Russia) is shaded whole, however small its part of the
  range.
- Marine species are assigned to the coastal countries/states where they're
  encountered.
- Not an identification or foraging guide, and not medical advice. The site
  says so on every page, and it should stay that way.

## Licence

Copyright © 2026 Ben Weaver.

The code is free software under the [GNU General Public License v3.0 or
later](LICENSE): you can use, change and share it, but copies and modified
versions must stay under the GPL, with their source available and this notice
kept. The species data is under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); photos, GBIF
data and Natural Earth boundaries keep their own terms (see
[data/LICENSE.md](data/LICENSE.md)). Contributions are welcome under the terms
in [CONTRIBUTING.md](CONTRIBUTING.md).
