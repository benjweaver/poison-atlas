# Project rules

## Warnings are errors

This project builds with warnings escalated to errors. A clean build emits
nothing, and it stays that way.

Configured in: `eslint --max-warnings 0` in `package.json`; `vite build`'s chunk
size warning is kept meaningful by `build.chunkSizeWarningLimit` in
`vite.config.ts` (set just above MapLibre, the one chunk that can't be split).

Check everything CI checks:

```bash
npm run check
```

**Fix the cause, don't silence it.** Suppressing a warning — a blanket ignore, a
downgraded diagnostic group, a disabled rule — is a last resort. If it is
genuinely unavoidable, scope it as narrowly as possible, say why in a comment,
and say how to undo it.

**Text contrast is at least 4.5:1** in both themes. `scripts/contrast.test.ts`
checks every text colour token in `src/style.css` against every surface, and
fails if a component colours text with a token it doesn't check.

## Safety

This is not an identification or foraging guide, and the site says so. Every
species page must keep that framing.

- **Never** write preparation, extraction or dosage information, or how to make
  something safe to eat. Where a species is eaten after traditional processing
  (cassava, ackee, false morels), say that it's toxic raw or unripe and cite an
  authoritative source, without the method.
- Being missing from the atlas never means safe; don't write copy that implies
  it.
- The safety note points to poison control, not just emergency numbers. Every
  poison centre number shown is checked on the centre's own site and cited.
- Say when symptoms are delayed (`onset.delayed`): with amatoxins or
  orellanine, the dangerous window has passed by the time people feel ill.

## Data

- One species per file in `data/species/`, named after the scientific name.
  The schema is `src/data/schema.ts`; the loader (`scripts/species-loader.ts`)
  is the only thing that reads the YAML, and both the build and
  `npm run validate` go through it.
- **Every toxicity claim has a source**, just as every place does: toxic
  parts, toxins, symptoms, onset, who's at risk, lookalikes, processing, and
  the pets flag. The schema rejects a claim without one. Sources are pages
  you have actually read: poison centres, clinical references (StatPearls,
  peer-reviewed case series), government health agencies and authoritative
  checklists. Not foraging blogs, pest-control sites or AI summaries.
- `data/images.json`, `data/gbif.json`, `data/gadm-iso.json` and `public/geo/`
  are generated (`npm run images`, `npm run ranges`, `npm run boundaries`) and
  committed. Don't hand-edit them; fix the script.
- `regions` (native) and `introduced` are normally written by
  `npm run ranges --write`. To correct them, use `gbif.exclude` /
  `gbif.include` in the species file rather than editing the lists directly,
  or the next `--write` undoes the fix.
- **Nothing is added or removed by hand without a verifiable source.**
  `gbif.include` / `gbif.exclude` entries carry a `source`, which must be a URL
  or citation you have actually checked, never an opinion. Validation rejects
  any listed place with no records, checklist or citation behind it.
- Native and introduced places are kept apart and shown differently.
  Introduced means naturalised or invasive. Places where a plant is only
  cultivated are left out, and records GBIF marks as cultivated, captive or
  living collections don't count.
- Watch for the errors that bit Venom Atlas: taxonomic splits that leave old
  records on the wrong species, ranges spread by misidentification, captive
  and cultivated records, and misinformation from foraging or pest-control
  sites.
- Scope: species that can seriously harm a person who eats, touches or
  breathes them, not every mildly irritating plant. Houseplants only when they
  meet the same bar. Danger to pets and livestock is a cited flag on species
  already in scope; species that only harm animals are out.
- Region codes are ISO 3166 as they appear in `public/geo/`. A species lists a
  country or that country's states, never both.
- Accuracy matters more than coverage: leave a region out rather than guess.

## Workflow

- UI changes go to a branch first. Cloudflare builds a preview at
  `<branch>-poison-atlas.benjweaver.workers.dev`, which gets checked on a phone
  before merging.
- For iOS Safari behaviour, test in the iOS Simulator, taking screenshots with
  `xcrun simctl io <device> screenshot` (tool screenshots can lag).
- Commit messages carry no AI attribution (no Co-Authored-By or similar lines).
- Site copy and docs use the serial comma ("a, b, and c").
