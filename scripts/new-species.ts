// npm run new -- "Scientific name"
//
// Writes data/species/<scientific-name>.yaml with every field stubbed, ready to
// fill in. Named after the scientific name because common names collide
// ("hemlock" is several plants) and scientific names don't.
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { GROUPS, ROUTES } from '../src/data/taxonomy.ts'
import { SPECIES_DIR } from './species-loader.ts'

const scientificName = process.argv.slice(2).join(' ').trim()
if (!scientificName) {
  console.error('usage: npm run new -- "Conium maculatum"')
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
danger: 3 # 1 harmful · 2 medically significant · 3 serious · 4 potentially fatal · 5 extremely dangerous
summary: >-
  TODO one or two sentences shown on the card.
# Every claim below needs at least one source you have actually read: a URL,
# or a citation followed by its URL. Never preparation, extraction or dosage.
exposure:
  routes: [eaten] # any of: ${ROUTES.join(', ')}
  sources:
    - TODO
toxicParts:
  text: TODO which parts are toxic, and whether cooking or drying changes that.
  sources:
    - TODO
toxins:
  text: TODO the main toxins and what they do.
  sources:
    - TODO
symptoms:
  text: TODO what poisoning looks like.
  sources:
    - TODO
onset:
  text: TODO how soon symptoms start.
  # delayed: true # when symptoms can start hours or days later
  sources:
    - TODO
atRisk:
  text: TODO who is poisoned, and how (mix-ups, children, foragers).
  sources:
    - TODO
# lookalikes:
#   - name: Wild garlic
#     scientificName: Allium ursinum
#     note: Who mixes them up, and when.
#     sources:
#       - TODO
habitat: >-
  TODO where it grows or lives.
# ISO 3166 codes, written by npm run ranges. A country ("MX") or its
# states/provinces ("US-AZ"), not both.
regions:
  - TODO
`,
)
console.log(`created ${file}\nnext: fill it in, then run: npm run images -- ${slug}`)
