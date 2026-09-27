// npm run validate — checks every species file without building the site.
// Stricter than the build: a species without a credited photo, or whose range
// was never checked against GBIF, fails here. So CI catches a forgotten
// `npm run images` or `npm run ranges` while local dev keeps working.
import { DataError, loadPoisonCentres, loadSpecies } from './species-loader.ts'

try {
  const species = loadSpecies()
  const problems = [
    ...species
      .filter((s) => !s.image && s.photo !== 'none')
      .map((s) => `${s.slug}: no photo — run: npm run images (or set photo: none)`),
    ...species
      .filter((s) => !s.gbifKey && !s.gbif?.manual)
      .map((s) => `${s.slug}: range not checked — run: npm run ranges (or set gbif.manual)`),
    ...species
      .filter((s) => !s.records && !s.gbif?.manual)
      .map((s) => `${s.slug}: no record grid — run: npm run ranges`),
  ]
  if (problems.length) throw new DataError(problems)
  const centres = loadPoisonCentres()
  console.log(`✓ ${species.length} species and ${Object.keys(centres).length} poison centres valid`)
} catch (e) {
  console.error(e instanceof DataError ? e.message : e)
  process.exit(1)
}
