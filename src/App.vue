<script setup lang="ts">
import poisonCentres from 'virtual:poison-centres'
import allSpecies from 'virtual:species'
import { computed, defineAsyncComponent, reactive, ref, shallowRef, watch, watchEffect } from 'vue'

import FilterBar from '@/components/FilterBar.vue'
import InfoTip from '@/components/InfoTip.vue'
import MapLegend from '@/components/MapLegend.vue'
import PlaceNav from '@/components/PlaceNav.vue'
import SpeciesCard from '@/components/SpeciesCard.vue'
import SpeciesDetail from '@/components/SpeciesDetail.vue'
import AppIcon from '@/components/AppIcon.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import type { Species } from '@/data/schema'
import { GROUPS, type Group } from '@/data/taxonomy'
import {
  loadCountries,
  loadRecords,
  loadSubdivisions,
  wikipediaUrl,
  type RecordPoints,
  type Regions,
} from '@/lib/geo'
import { helpFor, languageRegion } from '@/lib/poison-help'
import {
  countryOf,
  countsByCountry,
  countsBySubdivision,
  isSubdivision,
  placesOf,
  speciesIn,
  type Match,
} from '@/lib/regions'
import { setHead } from '@/lib/head'
import { useUrlState } from '@/lib/url-state'

// MapLibre is most of the JavaScript. Loading it separately lets the species
// list render straight away while the map is still downloading.
const AtlasMap = defineAsyncComponent(() => import('@/components/AtlasMap.vue'))

const view = useUrlState()

// Region code → display name and Wikidata id, filled in as boundary files load.
const names = reactive(new Map<string, string>())
const wikidata = new Map<string, string>()
function remember(regions: Regions | null) {
  for (const f of regions?.features ?? []) {
    names.set(f.properties.code, f.properties.name)
    if (f.properties.wikidata) wikidata.set(f.properties.code, f.properties.wikidata)
  }
}
const regionName = (code: string) => names.get(code) ?? code
const regionLink = (code: string) => wikipediaUrl(regionName(code), wikidata.get(code))

const countries = shallowRef<Regions | null>(null)
const loadError = ref<string | null>(null)
loadCountries()
  .then((c) => {
    remember(c)
    countries.value = c
  })
  .catch((e: Error) => (loadError.value = e.message))

// ── Filtering ─────────────────────────────────────────────────────────────
const available = GROUPS.filter((g) => allSpecies.some((s) => s.group === g))

// Names, and also what a species is mistaken for and its toxins: searching
// "wild garlic" finds the plants people pick instead of it.
function matchesQuery(s: Species, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  return [
    s.name,
    s.scientificName,
    s.toxins.text,
    ...(s.lookalikes ?? []).flatMap((l) => [l.name, l.scientificName]),
  ].some((text) => text.toLowerCase().includes(needle))
}

const filtering = computed(() => !!(view.groups.length || view.query || view.minDanger > 1))

const filtered = computed(() =>
  allSpecies.filter(
    (s) =>
      (!view.groups.length || view.groups.includes(s.group)) &&
      s.danger >= view.minDanger &&
      matchesQuery(s, view.query),
  ),
)

// ── Selected place ────────────────────────────────────────────────────────
const country = computed(() => (view.region ? countryOf(view.region) : null))
const subdivisions = shallowRef<Regions | null>(null)

watch(
  country,
  async (cc) => {
    if (!cc) return (subdivisions.value = null)
    const subs = await loadSubdivisions(cc)
    if (country.value !== cc) return // the user moved on while it loaded
    remember(subs)
    subdivisions.value = subs
  },
  { immediate: true },
)

const countryCounts = computed(() => countsByCountry(filtered.value))
const subdivisionCounts = computed(() =>
  subdivisions.value
    ? countsBySubdivision(
        filtered.value,
        subdivisions.value.features.map((f) => f.properties.code),
      )
    : new Map<string, number>(),
)

const listed = computed<Match[]>(() =>
  view.region
    ? speciesIn(filtered.value, view.region)
    : [...filtered.value]
        .sort((a, b) => b.danger - a.danger || a.name.localeCompare(b.name))
        .map((species) => ({ species, countryWide: false, introduced: false })),
)

// ── Selected species ──────────────────────────────────────────────────────
const selectedSpecies = computed(() => allSpecies.find((s) => s.slug === view.species) ?? null)
const range = shallowRef<Regions | null>(null)

// A species' range can mix whole countries with states from several
// countries, so its shape is assembled from whichever boundary files it needs.
watch(
  [selectedSpecies, countries],
  async ([species, all]) => {
    if (!species || !all) return (range.value = null)
    const codes = new Set(placesOf(species))
    const needed = [...new Set([...codes].filter(isSubdivision).map(countryOf))]
    const subs = await Promise.all(needed.map(loadSubdivisions))
    if (selectedSpecies.value !== species) return
    subs.forEach(remember)
    const unrecorded = new Set(species.unrecorded ?? [])
    const introduced = new Set(species.introduced ?? [])
    range.value = {
      type: 'FeatureCollection',
      features: [all, ...subs].flatMap(
        (r) =>
          r?.features
            .filter((f) => codes.has(f.properties.code))
            .map((f) => ({
              ...f,
              properties: {
                ...f.properties,
                recorded: !unrecorded.has(f.properties.code),
                introduced: introduced.has(f.properties.code),
              },
            })) ?? [],
      ),
    }
  },
  { immediate: true },
)

// The species' record grid: dots where it has actually been recorded.
const records = shallowRef<RecordPoints | null>(null)
watch(
  selectedSpecies,
  async (species) => {
    records.value = null
    if (!species?.records) return
    const grid = await loadRecords(species.slug)
    if (selectedSpecies.value !== species || !grid) return
    // A dot is drawn only if its territory is in the species' lists (or it's
    // on the high seas), so the dots and the places listed always agree. A
    // country listed whole covers dots tagged with any of its states. Dots
    // where it was introduced are coloured as such.
    const listed = new Set(placesOf(species))
    const introduced = new Set(species.introduced ?? [])
    const has = (set: Set<string>, code: string) => set.has(code) || set.has(countryOf(code))
    records.value = {
      ...grid,
      features: grid.features
        .filter((f) => !f.properties.code || has(listed, f.properties.code))
        .map((f) => ({
          ...f,
          properties: {
            ...f.properties,
            introduced: !!f.properties.code && has(introduced, f.properties.code),
          },
        })),
    }
  },
  { immediate: true },
)

// ── Navigation ────────────────────────────────────────────────────────────
function selectRegion(code: string | null) {
  view.region = code
  view.species = null
}

// A map click. Clicking a place opens it; clicking empty sea steps out one
// level, like Escape: a species closes back to its place, and a place back to
// the world. (Clicks on a sea species' record dots don't count as empty sea;
// see AtlasMap.vue.)
function onMapSelect(code: string | null) {
  if (code) selectRegion(code)
  else stepOut()
}

function stepOut() {
  if (view.species) view.species = null
  else if (view.region) selectRegion(null)
}

const breadcrumb = computed(() => {
  const crumbs: { code: string | null; label: string }[] = [{ code: null, label: 'World' }]
  if (country.value) crumbs.push({ code: country.value, label: regionName(country.value) })
  if (view.region && isSubdivision(view.region)) {
    crumbs.push({ code: view.region, label: regionName(view.region) })
  }
  return crumbs
})

// ── Page title and description ────────────────────────────────────────────
// Each species and place gets its own, so search engines can list them.
// Counts use every species, not the current filters.
const TITLE = 'Poison Atlas · Poisonous plants, fungi, and animals by country and state'
const DESCRIPTION =
  'An interactive world map of poisonous plants, mushrooms, and animals that can seriously ' +
  'harm people who eat, touch, or breathe them, by country and state, with a source for ' +
  'every claim. Not an identification or foraging guide.'
const NOUNS: Record<Group, [string, string] | null> = {
  plant: ['plant', 'plants'],
  fungus: ['fungus', 'fungi'],
  amphibian: ['amphibian', 'amphibians'],
  fish: ['fish', 'fish'],
  reptile: ['reptile', 'reptiles'],
  insect: ['insect', 'insects'],
  other: null,
}
// "12 plants, 5 fungi, and 3 amphibians": the three biggest groups.
function breakdown(species: Species[]): string {
  const counts = new Map<Group, number>()
  for (const s of species) counts.set(s.group, (counts.get(s.group) ?? 0) + 1)
  const parts = [...counts]
    .filter(([group]) => NOUNS[group])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([group, n]) => `${n} ${NOUNS[group]![n === 1 ? 0 : 1]}`)
  if (parts.length < 2) return parts.join('')
  return `${parts.slice(0, -1).join(', ')}${parts.length > 2 ? ',' : ''} and ${parts.at(-1)}`
}
watchEffect(() => {
  const species = selectedSpecies.value
  if (species) {
    return setHead({
      title: `${species.name} (${species.scientificName}) · Poison Atlas`,
      description: `${species.summary} See where it lives, by country and state, with sources.`,
      path: `/?s=${species.slug}`,
    })
  }
  // A place's name arrives with its boundary file; until then, the general
  // title, rather than a bare code like "US-SC".
  const place = view.region ? names.get(view.region) : undefined
  if (view.region && place) {
    const found = speciesIn(allSpecies, view.region).map((m) => m.species)
    const n = found.length
    return setHead({
      title: `Poisonous species in ${place} · Poison Atlas`,
      description:
        `${n} poisonous species recorded in ${place}` +
        (n > 1 ? `, including ${breakdown(found)}` : '') +
        '. See where each one lives, how dangerous it is, and the sources.',
      path: `/?r=${view.region}`,
    })
  }
  setHead({ title: TITLE, description: DESCRIPTION, path: '/' })
})

// What tapping open sea on the map does, as the map offers it on touch screens.
const stepOutLabel = computed(() => {
  if (selectedSpecies.value) return `Close ${selectedSpecies.value.name}`
  if (view.region) return 'Back to World'
  return null
})

const countryTotal = countsByCountry(allSpecies).size

// Where to call: the poison centre for the country open on the map, or else
// for the region the browser's languages name.
const help = computed(() =>
  helpFor(country.value ?? languageRegion(navigator.languages), poisonCentres, regionName),
)

// Optional support payments (a Stripe Payment Link, pay what you want). The
// support links stay hidden until Poison Atlas has a link of its own.
const SUPPORT_URL: string | undefined = undefined
const SOURCE_URL = 'https://github.com/benjweaver/poison-atlas'
const SAFETY_NOTE =
  'Not an identification or foraging guide, and not medical advice. If someone may have been ' +
  "poisoned, contact poison control. A species not listed here isn't necessarily safe."

// Opening or leaving a species starts the panel at the top. On a phone the
// panel sits below the map, so scroll the page down to the navigation bar,
// which then sticks to the top of the screen.
const navBar = ref<HTMLElement>()
const content = ref<HTMLElement>()
const isPhone = () => !matchMedia('(min-width: 768px)').matches
watch(
  () => view.species,
  (slug) => {
    content.value?.scrollTo({ top: 0 })
    if (slug && isPhone()) navBar.value?.scrollIntoView({ behavior: 'smooth' })
  },
)
function showMap() {
  scrollTo({ top: 0, behavior: 'smooth' })
}

addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.target instanceof HTMLInputElement) return
  stepOut()
})
</script>

<template>
  <!-- Phones: map on top, then the panel, and the whole page scrolls.
       Wider screens: map and panel side by side, the panel scrolling on its own. -->
  <div class="md:flex md:h-full">
    <main class="relative h-[45svh] min-h-48 md:h-full md:min-h-0 md:flex-1">
      <AtlasMap
        v-if="countries"
        :countries="countries"
        :country-counts="countryCounts"
        :subdivisions="subdivisions"
        :subdivision-counts="subdivisionCounts"
        :selected="view.region"
        :range="range"
        :records="records"
        :aquatic="!!selectedSpecies?.aquatic"
        :step-out="stepOutLabel"
        @select="onMapSelect"
      />
      <p v-else-if="loadError" class="p-6 text-sm text-(--accent)">{{ loadError }}</p>
      <MapLegend
        v-if="countries"
        :range="!!range"
        :records="!!records"
        :unrecorded="!!selectedSpecies?.unrecorded?.length"
        :introduced="!!selectedSpecies?.introduced?.length"
        :aquatic="selectedSpecies?.aquatic"
        class="absolute top-3 left-3 max-w-[calc(100%-4.5rem)] md:top-auto md:bottom-8 md:max-w-none"
      />
    </main>

    <aside class="bg-(--surface) md:flex md:w-[420px] md:flex-col md:border-l md:border-(--line)">
      <header class="space-y-2.5 border-b border-(--line) px-4 py-3 md:space-y-3 md:py-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h1 class="text-xl font-bold tracking-tight">
              <button type="button" @click="selectRegion(null)">
                Poison<span class="text-(--accent)">Atlas</span>
              </button>
            </h1>
            <p class="text-xs text-(--muted)">
              {{ allSpecies.length }} poisonous species across {{ countryTotal }} countries
            </p>
            <p class="mt-0.5 text-xs font-medium">
              <AppIcon name="warning" small class="mr-1 inline align-[-1px]" />Not an identification
              or foraging guide
            </p>
          </div>
          <ThemeToggle />
        </div>
        <FilterBar
          v-model:groups="view.groups"
          v-model:query="view.query"
          v-model:min-danger="view.minDanger"
          :available="available"
        />
      </header>

      <!-- Sticks to the top of the screen on phones as the page scrolls. -->
      <div ref="navBar" class="sticky top-0 z-20 md:static">
        <PlaceNav
          :crumbs="breadcrumb"
          :species="selectedSpecies?.name"
          @go="selectRegion"
          @close="view.species = null"
          @map="showMap"
        />
      </div>

      <div ref="content" class="p-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
        <SpeciesDetail
          v-if="selectedSpecies"
          :species="selectedSpecies"
          :region-name="regionName"
          :help="help"
          @region="selectRegion"
          @species="view.species = $event"
        />

        <template v-else>
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-lg font-semibold">
              {{ view.region ? regionName(view.region) : 'All species' }}
            </h2>
            <a
              v-if="view.region"
              :href="regionLink(view.region)"
              target="_blank"
              rel="noopener"
              class="shrink-0 text-xs text-(--accent) hover:underline"
            >
              Wikipedia →
            </a>
          </div>
          <p class="mb-3 text-sm text-(--muted)">
            <template v-if="!view.region && !listed.length">No species match.</template>
            <template v-else-if="!view.region"
              ><template v-if="filtering"
                >Showing {{ listed.length }} of {{ allSpecies.length }} species. </template
              >Select a country on the map to narrow it down.</template
            >
            <template v-else-if="listed.length">
              {{ listed.length }} species recorded{{
                subdivisions && !isSubdivision(view.region) ? ' · click a state or province' : ''
              }}
            </template>
            <template v-else>No species recorded here yet.</template>
          </p>

          <ul class="-mx-2 space-y-1">
            <li v-for="{ species, countryWide, introduced } in listed" :key="species.slug">
              <SpeciesCard
                :species="species"
                :country-wide="countryWide"
                :introduced="introduced"
                @open="view.species = species.slug"
              />
            </li>
          </ul>
        </template>
        <!-- Phones pin a one-line version of this; here's the whole note. -->
        <p class="mt-6 text-[11px] leading-snug text-(--muted) md:hidden">{{ SAFETY_NOTE }}</p>
      </div>

      <!-- Phones: one line pinned to the bottom of the screen, so the safety note
           and the credit stay in view down the long list without eating it; the
           full note is a tap away and at the end of the list. Wider screens: the
           whole note, as the panel's last row. -->
      <footer
        class="sticky bottom-0 z-20 border-t border-(--line) bg-(--surface) px-4 py-1.5 text-[11px] leading-snug text-(--muted) md:static md:py-2"
      >
        <p class="max-md:hidden">{{ SAFETY_NOTE }}</p>
        <div class="flex flex-wrap items-center justify-between gap-x-3 md:mt-1">
          <InfoTip :text="SAFETY_NOTE" class="md:hidden">
            <span class="inline-flex items-center gap-1 whitespace-nowrap"
              ><AppIcon name="info" small />Not a foraging guide</span
            >
          </InfoTip>
          <span class="whitespace-nowrap"
            ><span class="max-[360px]:hidden">Made by </span
            ><a
              href="https://benjweaver.dev"
              target="_blank"
              rel="noopener"
              class="text-(--ink) hover:underline"
              >Ben Weaver</a
            >
            ·
            <a
              :href="SOURCE_URL"
              target="_blank"
              rel="noopener"
              class="text-(--ink) hover:underline"
              >Source</a
            ><span v-if="SUPPORT_URL" class="md:hidden">
              ·
              <a
                :href="SUPPORT_URL"
                target="_blank"
                rel="noopener"
                class="text-(--accent) hover:underline"
                ><AppIcon
                  name="heart"
                  small
                  class="mr-0.5 inline fill-current align-[-1px]"
                />Support</a
              ></span
            ></span
          >
          <a
            v-if="SUPPORT_URL"
            :href="SUPPORT_URL"
            target="_blank"
            rel="noopener"
            class="text-(--accent) hover:underline max-md:hidden"
            ><AppIcon name="heart" small class="mr-1 inline fill-current align-[-1px]" />Support
            this project</a
          >
        </div>
      </footer>
    </aside>
  </div>
</template>
