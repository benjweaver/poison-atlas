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

## Species data and ranges

The species schema and the GBIF range pipeline are being adapted from Venom
Atlas for poisoning: routes of exposure, toxins, symptoms and onset,
lookalikes, and native versus introduced ranges. See `src/data/schema.ts` and
`scripts/`; this section will describe them once they land.

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
  as GBIF's records plus human review (see above).
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
