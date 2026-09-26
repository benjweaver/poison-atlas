<script setup lang="ts">
import { computed } from 'vue'

import type { Species } from '@/data/schema'
import { GROUP_LABELS } from '@/data/taxonomy'
import { countryOf, isSubdivision } from '@/lib/regions'

import DangerBadge from './DangerBadge.vue'
import InfoTip from './InfoTip.vue'

const props = defineProps<{ species: Species; regionName: (code: string) => string }>()
defineEmits<{ region: [code: string] }>()

// "United States: Arizona, New Mexico · Mexico" — states grouped under their
// country so a long range stays scannable.
const where = computed(() => {
  const byCountry = new Map<string, string[]>()
  for (const code of props.species.regions) {
    const country = countryOf(code)
    const list = byCountry.get(country) ?? []
    if (isSubdivision(code)) list.push(code)
    byCountry.set(country, list)
  }
  return [...byCountry]
    .map(([country, subs]) => ({ country, subs }))
    .sort((a, b) => props.regionName(a.country).localeCompare(props.regionName(b.country)))
})

const unrecorded = computed(() => new Set(props.species.unrecorded ?? []))

// What supports each place, for its tooltip: "213 GBIF records · Catalogue of Life".
function evidenceText(code: string): string {
  return (props.species.evidence?.[code] ?? [])
    .map((e) =>
      e.kind === 'records'
        ? `${e.count.toLocaleString()} GBIF ${e.count === 1 ? 'record' : 'records'}`
        : e.source,
    )
    .join(' · ')
}

// The Sources section: each source, and the places it supports.
const sources = computed(() => {
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
    others: [...bySource].map(([source, codes]) => ({ source, codes, url: sourceUrl(source) })),
  }
})

const scientific = computed(() => encodeURIComponent(props.species.scientificName))
function sourceUrl(source: string): string | undefined {
  if (/^https?:\/\//.test(source)) return source
  if (/Catalogue of Life/i.test(source))
    return `https://www.catalogueoflife.org/data/search?q=${scientific.value}`
  if (/World Register of Marine Species/i.test(source))
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

    <p class="mt-4">{{ species.summary }}</p>
    <p
      v-if="species.taxonomy"
      class="mt-2 rounded-md bg-(--surface-2) px-3 py-2 text-xs text-(--muted)"
    >
      <span class="font-semibold text-(--ink)">Taxonomy:</span> {{ species.taxonomy.note }}
      <a
        v-if="/^https?:\/\//.test(species.taxonomy.source)"
        :href="species.taxonomy.source"
        target="_blank"
        rel="noopener"
        class="underline"
        >Source</a
      ><template v-else>({{ species.taxonomy.source }})</template>
    </p>

    <dl class="mt-4 space-y-3 text-sm">
      <div>
        <dt class="font-semibold">Venom</dt>
        <dd class="text-(--muted)">{{ species.venom }}</dd>
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
                : 'The dots on the map show where it has been recorded within these places.'
          }}
        </dd>
        <dd class="mt-1 space-y-1">
          <div v-for="{ country, subs } in where" :key="country">
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
          <p v-if="unrecorded.size" class="mt-2 text-[11px] text-(--muted)">
            <em>Italic</em>: known range from checklists, with no records yet.
          </p>
        </dd>
      </div>
    </dl>

    <section v-if="species.evidence" class="mt-4 text-[11px] leading-relaxed text-(--muted)">
      <h3 class="mb-1 text-xs font-semibold text-(--ink)">Sources</h3>
      <ul class="space-y-1">
        <li v-if="sources.recordPlaces && species.gbifKey">
          <a
            :href="`https://www.gbif.org/species/${species.gbifKey}`"
            target="_blank"
            rel="noopener"
            class="underline"
            >GBIF occurrence records</a
          >: {{ sources.recordCount.toLocaleString() }} records in {{ sources.recordPlaces }}
          {{ sources.recordPlaces === 1 ? 'place' : 'places' }}.
        </li>
        <li v-for="{ source, codes, url } in sources.others" :key="source">
          <a v-if="url" :href="url" target="_blank" rel="noopener" class="underline">{{
            source
          }}</a>
          <template v-else>{{ source }}</template
          >: {{ codes.map(regionName).join(', ') }}.
        </li>
        <li v-for="e in species.gbif?.exclude ?? []" :key="`x-${e.code}`">
          Not listed: {{ regionName(e.code) }}<template v-if="e.reason"> ({{ e.reason }})</template>
          —
          <a
            v-if="/^https?:\/\//.test(e.source)"
            :href="e.source"
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
