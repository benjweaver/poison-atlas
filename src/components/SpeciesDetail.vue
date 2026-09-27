<script setup lang="ts">
import { computed } from 'vue'

import type { Claim, Species } from '@/data/schema'
import { ANIMAL_LABELS, GROUP_LABELS, ROUTE_LABELS } from '@/data/taxonomy'
import type { Help } from '@/lib/poison-help'
import { countryOf, isSubdivision } from '@/lib/regions'
import { numberSources, sourceLink } from '@/lib/sources'

import AppIcon from './AppIcon.vue'
import DangerBadge from './DangerBadge.vue'
import InfoTip from './InfoTip.vue'
import PoisonHelp from './PoisonHelp.vue'

const props = defineProps<{
  species: Species
  regionName: (code: string) => string
  /** Where to call, for the country being viewed, if the atlas knows. */
  help: Help | null
}>()
defineEmits<{ region: [code: string]; species: [slug: string] }>()

// The claims, in the order the page shows them. Their sources are numbered
// together, so each claim points to entries in the one list at the bottom.
const claims = computed(() => {
  const s = props.species
  const rows: { label: string; claim: Claim | undefined }[] = [
    { label: 'Toxic parts', claim: s.toxicParts },
    { label: 'Toxins', claim: s.toxins },
    { label: 'Symptoms', claim: s.symptoms },
    { label: 'Onset', claim: s.onset },
    { label: 'Most at risk', claim: s.atRisk },
    { label: 'Eaten after processing', claim: s.processing },
    { label: 'In gardens and homes', claim: s.cultivated },
  ]
  return rows.filter((r): r is { label: string; claim: Claim } => !!r.claim)
})
const numbers = computed(() =>
  numberSources([
    props.species.exposure.sources,
    ...claims.value.map((r) => r.claim.sources),
    props.species.animals?.sources,
    ...(props.species.lookalikes ?? []).map((l) => l.sources),
  ]),
)
const refs = (sources: string[] | undefined) =>
  (sources ?? []).map((s) => numbers.value.get(s)!).sort((a, b) => a - b)

// "Dogs, cats, and horses".
const animals = computed(() => {
  const who = props.species.animals?.who.map((a) => ANIMAL_LABELS[a]) ?? []
  const list =
    who.length < 3 ? who.join(' and ') : `${who.slice(0, -1).join(', ')}, and ${who.at(-1)}`
  return list.charAt(0).toUpperCase() + list.slice(1)
})

// "United States: Arizona, New Mexico · Mexico" — states grouped under their
// country so a long range stays scannable. Native and introduced apart.
function byCountry(codes: string[]) {
  const grouped = new Map<string, string[]>()
  for (const code of codes) {
    const country = countryOf(code)
    const list = grouped.get(country) ?? []
    if (isSubdivision(code)) list.push(code)
    grouped.set(country, list)
  }
  return [...grouped]
    .map(([country, subs]) => ({ country, subs }))
    .sort((a, b) => props.regionName(a.country).localeCompare(props.regionName(b.country)))
}
const where = computed(() => [
  { label: 'Native', places: byCountry(props.species.regions) },
  { label: 'Introduced', places: byCountry(props.species.introduced ?? []) },
])

const unrecorded = computed(() => new Set(props.species.unrecorded ?? []))

// What supports each place, for its tooltip: "213 GBIF records · WCVP".
function evidenceText(code: string): string {
  return (props.species.evidence?.[code] ?? [])
    .map((e) =>
      e.kind === 'records'
        ? `${e.count.toLocaleString()} GBIF ${e.count === 1 ? 'record' : 'records'}`
        : sourceLink(e.source).label,
    )
    .join(' · ')
}

// The range sources: each one, and the places it supports.
const rangeSources = computed(() => {
  const bySource = new Map<string, string[]>()
  let recordPlaces = 0
  let recordCount = 0
  for (const [code, list] of Object.entries(props.species.evidence ?? {})) {
    for (const e of list) {
      if (e.kind === 'records') {
        recordPlaces++
        recordCount += e.count
      } else bySource.set(e.source, [...(bySource.get(e.source) ?? []), code])
    }
  }
  return {
    recordPlaces,
    recordCount,
    others: [...bySource].map(([source, codes]) => ({ source, codes, url: rangeUrl(source) })),
  }
})

const scientific = computed(() => encodeURIComponent(props.species.scientificName))
function rangeUrl(source: string): string | undefined {
  const link = sourceLink(source)
  if (link.url) return link.url
  if (/World Checklist of Vascular Plants/i.test(source))
    return `https://powo.science.kew.org/results?q=${scientific.value}`
  if (/Catalogue of Life/i.test(source))
    return `https://www.catalogueoflife.org/data/search?q=${scientific.value}`
  if (/World Register of Marine Species|WRiMS/i.test(source))
    return `https://www.marinespecies.org/aphia.php?p=taxlist&tName=${scientific.value}`
  if (props.species.gbifKey) return `https://www.gbif.org/species/${props.species.gbifKey}`
  return undefined
}

const wikipedia = computed(
  () =>
    `https://en.wikipedia.org/wiki/${encodeURIComponent(
      (props.species.wikipedia ?? props.species.scientificName).replace(/ /g, '_'),
    )}`,
)
</script>

<template>
  <article>
    <figure v-if="species.image" class="-mx-4 mb-4">
      <img
        :src="species.image.src"
        :alt="species.name"
        class="aspect-[4/3] w-full bg-(--surface-2) object-cover"
      />
      <figcaption class="px-4 pt-1 text-[11px] text-(--muted)">
        Photo:
        <a :href="species.image.page" target="_blank" rel="noopener" class="underline">
          {{ species.image.artist }}
        </a>
        ·
        <a
          v-if="species.image.licenseUrl"
          :href="species.image.licenseUrl"
          target="_blank"
          rel="noopener"
          class="underline"
          >{{ species.image.license }}</a
        >
        <template v-else>{{ species.image.license }}</template>
      </figcaption>
    </figure>

    <p class="text-xs tracking-wide text-(--muted) uppercase">{{ GROUP_LABELS[species.group] }}</p>
    <h2 class="text-2xl leading-tight font-bold">{{ species.name }}</h2>
    <p class="text-sm text-(--muted) italic">{{ species.scientificName }}</p>
    <DangerBadge :level="species.danger" explain class="mt-2" />

    <!-- Every page says what the site isn't, and what to do instead. -->
    <aside
      class="mt-3 rounded-md border border-(--line) bg-(--surface-2) px-3 py-2 text-sm"
      aria-label="Safety"
    >
      <p v-if="species.onset.delayed" class="font-semibold">
        <AppIcon name="clock" class="mr-1 inline align-[-2px]" />Symptoms can be delayed by hours or
        days, past the point where treatment works best. If someone may have been exposed, call
        poison control now; don't wait for symptoms.
      </p>
      <p :class="{ 'mt-1': species.onset.delayed }">
        <AppIcon
          v-if="!species.onset.delayed"
          name="warning"
          class="mr-1 inline align-[-2px]"
        />Don't use this page to identify anything or to decide whether it's safe.
      </p>
      <PoisonHelp :help="help" class="mt-1" />
    </aside>

    <p class="mt-4">{{ species.summary }}</p>
    <p
      v-if="species.taxonomy"
      class="mt-2 rounded-md bg-(--surface-2) px-3 py-2 text-xs text-(--muted)"
    >
      <span class="font-semibold text-(--ink)">Taxonomy:</span> {{ species.taxonomy.note }}
      <a
        v-if="sourceLink(species.taxonomy.source).url"
        :href="sourceLink(species.taxonomy.source).url"
        target="_blank"
        rel="noopener"
        class="underline"
        >Source</a
      ><template v-else>({{ species.taxonomy.source }})</template>
    </p>

    <dl class="mt-4 space-y-3 text-sm">
      <div>
        <dt class="font-semibold">How it harms</dt>
        <dd class="mt-1 flex flex-wrap gap-1.5">
          <span
            v-for="route in species.exposure.routes"
            :key="route"
            class="rounded-full px-2 py-0.5 text-xs text-(--ink) ring-1 ring-(--line)"
            >{{ ROUTE_LABELS[route] }}</span
          >
        </dd>
        <dd v-if="species.exposure.text" class="mt-1 text-(--muted)">
          {{ species.exposure.text
          }}<sup class="ml-0.5 text-(--accent)"
            ><a
              v-for="(n, i) in refs(species.exposure.sources)"
              :key="n"
              :href="`#source-${species.slug}-${n}`"
              >{{ i ? ',' : '' }}{{ n }}</a
            ></sup
          >
        </dd>
      </div>
      <div v-for="row in claims" :key="row.label">
        <dt class="font-semibold">{{ row.label }}</dt>
        <dd class="text-(--muted)">
          {{ row.claim.text
          }}<sup class="ml-0.5 text-(--accent)"
            ><a
              v-for="(n, i) in refs(row.claim.sources)"
              :key="n"
              :href="`#source-${species.slug}-${n}`"
              >{{ i ? ',' : '' }}{{ n }}</a
            ></sup
          >
        </dd>
      </div>
      <div v-if="species.animals">
        <dt class="font-semibold">Also dangerous to</dt>
        <dd class="text-(--muted)">
          {{ animals }}<template v-if="species.animals.text">. {{ species.animals.text }}</template
          ><sup class="ml-0.5 text-(--accent)"
            ><a
              v-for="(n, i) in refs(species.animals.sources)"
              :key="n"
              :href="`#source-${species.slug}-${n}`"
              >{{ i ? ',' : '' }}{{ n }}</a
            ></sup
          >
        </dd>
      </div>
      <div>
        <dt class="font-semibold">Habitat</dt>
        <dd class="text-(--muted)">{{ species.habitat }}</dd>
      </div>
      <div v-if="species.size">
        <dt class="font-semibold">Size</dt>
        <dd class="text-(--muted)">{{ species.size }}</dd>
      </div>
      <div>
        <dt class="font-semibold">Where it's found</dt>
        <dd v-if="species.records" class="mt-1 text-(--muted)">
          {{
            species.aquatic === 'marine'
              ? 'Lives in the sea. The dots on the map show where it has been recorded; the places below are the coasts it is found off.'
              : species.aquatic === 'freshwater'
                ? 'Lives in fresh water. The dots on the map show the rivers and lakes where it has been recorded.'
                : 'The dots on the map show where it has been recorded in the wild within these places.'
          }}
        </dd>
        <template v-for="group in where" :key="group.label">
          <dd v-if="group.places.length" class="mt-2">
            <p
              class="text-[11px] font-semibold tracking-wide uppercase"
              :class="group.label === 'Native' ? 'text-(--muted)' : 'text-(--introduced-ink)'"
            >
              {{ group.label }}
              <InfoTip
                v-if="group.label === 'Introduced'"
                text="Brought by people and now established in the wild (naturalised or invasive). Places where it's only grown or kept aren't listed."
                class="ml-0.5 align-[-1px] font-normal normal-case"
                ><span class="sr-only">About introduced places</span><AppIcon name="info" small
              /></InfoTip>
            </p>
            <div v-for="{ country, subs } in group.places" :key="country">
              <InfoTip :text="evidenceText(country)" :tap="false"
                ><button
                  type="button"
                  class="text-(--accent) hover:underline"
                  :class="{ italic: unrecorded.has(country) }"
                  @click="$emit('region', country)"
                >
                  {{ regionName(country) }}
                </button></InfoTip
              ><template v-if="subs.length">
                <span class="text-(--muted)">: </span>
                <template v-for="(code, i) in subs" :key="code">
                  <InfoTip :text="evidenceText(code)" :tap="false"
                    ><button
                      type="button"
                      class="text-(--ink) hover:text-(--accent) hover:underline"
                      :class="{ 'text-(--muted) italic': unrecorded.has(code) }"
                      @click="$emit('region', code)"
                    >
                      {{ regionName(code) }}
                    </button></InfoTip
                  ><span v-if="i < subs.length - 1" class="text-(--muted)">, </span>
                </template>
              </template>
            </div>
          </dd>
        </template>
        <dd v-if="unrecorded.size" class="mt-2 text-[11px] text-(--muted)">
          <em>Italic</em>: known from checklists, with no records yet.
        </dd>
        <dd class="mt-2 text-[11px] text-(--muted)">
          Not being listed somewhere doesn't mean it's absent, or that anything else there is safe.
        </dd>
      </div>
    </dl>

    <section
      v-if="species.lookalikes?.length || species.resembledBy?.length"
      class="mt-5"
      aria-labelledby="lookalikes-heading"
    >
      <h3 id="lookalikes-heading" class="text-sm font-semibold">Mistaken for</h3>
      <ul class="mt-1 space-y-2 text-sm">
        <li v-for="l in species.lookalikes ?? []" :key="l.scientificName">
          <button
            v-if="l.slug"
            type="button"
            class="font-medium text-(--accent) hover:underline"
            @click="$emit('species', l.slug)"
          >
            {{ l.name }}
          </button>
          <span v-else class="font-medium">{{ l.name }}</span>
          <span class="text-(--muted) italic"> {{ l.scientificName }}</span>
          <span v-if="l.slug" class="text-[11px] text-(--muted)"> · in the atlas</span>
          <p class="text-(--muted)">
            {{ l.note
            }}<sup class="ml-0.5 text-(--accent)"
              ><a v-for="(n, i) in refs(l.sources)" :key="n" :href="`#source-${species.slug}-${n}`"
                >{{ i ? ',' : '' }}{{ n }}</a
              ></sup
            >
          </p>
        </li>
        <li v-if="species.resembledBy?.length" class="text-(--muted)">
          Also listed as a lookalike of
          <template v-for="(r, i) in species.resembledBy" :key="r.slug"
            ><button
              type="button"
              class="text-(--accent) hover:underline"
              @click="$emit('species', r.slug)"
            >
              {{ r.name }}</button
            >{{ i < species.resembledBy.length - 1 ? ', ' : '' }}</template
          >.
        </li>
      </ul>
    </section>

    <section
      class="mt-5 text-[11px] leading-relaxed text-(--muted)"
      aria-labelledby="sources-heading"
    >
      <h3 id="sources-heading" class="mb-1 text-xs font-semibold text-(--ink)">Sources</h3>
      <ol class="list-decimal space-y-1 pl-5">
        <li
          v-for="[source, n] in numbers"
          :id="`source-${species.slug}-${n}`"
          :key="source"
          class="scroll-mt-16"
        >
          <a
            v-if="sourceLink(source).url"
            :href="sourceLink(source).url"
            target="_blank"
            rel="noopener"
            class="underline"
            >{{ sourceLink(source).label }}</a
          >
          <template v-else>{{ sourceLink(source).label }}</template>
        </li>
      </ol>
      <h4 class="mt-3 mb-1 text-xs font-semibold text-(--ink)">Where it's found</h4>
      <ul class="space-y-1">
        <li v-if="rangeSources.recordPlaces && species.gbifKey">
          <a
            :href="`https://www.gbif.org/species/${species.gbifKey}`"
            target="_blank"
            rel="noopener"
            class="underline"
            >GBIF occurrence records</a
          >: {{ rangeSources.recordCount.toLocaleString() }} records in
          {{ rangeSources.recordPlaces }}
          {{ rangeSources.recordPlaces === 1 ? 'place' : 'places' }}.
        </li>
        <li v-for="{ source, codes, url } in rangeSources.others" :key="source">
          <a v-if="url" :href="url" target="_blank" rel="noopener" class="underline">{{
            sourceLink(source).label
          }}</a>
          <template v-else>{{ source }}</template
          >: {{ codes.map(regionName).join(', ') }}.
        </li>
        <li v-for="e in species.gbif?.exclude ?? []" :key="`x-${e.code}`">
          Not listed: {{ regionName(e.code) }}<template v-if="e.reason"> ({{ e.reason }})</template>
          —
          <a
            v-if="sourceLink(e.source).url"
            :href="sourceLink(e.source).url"
            target="_blank"
            rel="noopener"
            class="underline"
            >source</a
          ><template v-else>{{ e.source }}</template
          >.
        </li>
      </ul>
      <!-- Only where there's a mouse: on touch, a tap on a place opens it. -->
      <p class="mt-1 [@media(hover:none)]:hidden">Hover over a place to see what supports it.</p>
      <p class="mt-1 [@media(hover:hover)]:hidden">Tap a place above to open it on the map.</p>
    </section>

    <a
      :href="wikipedia"
      target="_blank"
      rel="noopener"
      class="mt-5 inline-block text-sm text-(--accent) hover:underline"
    >
      Read more on Wikipedia →
    </a>
  </article>
</template>
