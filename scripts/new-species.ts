// npm run new -- "Scientific name"
//
// Writes data/species/<scientific-name>.yaml with every field stubbed, ready to
// fill in. Named after the scientific name because common names collide
// ("black widow" is several species) and scientific names don't.
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { GROUPS } from '../src/data/taxonomy.ts'
import { SPECIES_DIR } from './species-loader.ts'

const scientificName = process.argv.slice(2).join(' ').trim()
if (!scientificName) {
  console.error('usage: npm run new -- "Crotalus atrox"')
  process.exit(1)
}

const slug = scientificName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
const file = join(SPECIES_DIR, `${slug}.yaml`)
if (existsSync(file)) {
  console.error(`${file} already exists`)
  process.exit(1)
}

writeFileSync(
  file,
  `name: TODO common name
scientificName: ${scientificName}
group: TODO # one of: ${GROUPS.join(', ')}
danger: 3 # 1 painful · 2 medically significant · 3 serious · 4 potentially fatal · 5 extremely dangerous
summary: >-
  TODO one or two sentences shown on the card.
venom: >-
  TODO what the venom does to a person.
habitat: >-
  TODO where it lives.
size: TODO optional — delete this line if unknown
# Uncomment if the Wikipedia article isn't titled with the scientific name.
# wikipedia: Article title
# ISO 3166 codes. A country ("MX") or its states/provinces ("US-AZ"), not both.
regions:
  - TODO
`,
)
console.log(`created ${file}\nnext: fill it in, then run: npm run images -- ${slug}`)
