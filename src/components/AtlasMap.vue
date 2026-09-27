<script setup lang="ts">
// The map. It draws GeoJSON sources on a plain background — no tile server,
// no API key, nothing to pay for or rotate:
//
//   countries      every country, shaded by how many species live there
//   subdivisions   the selected country's states/provinces, shaded the same way
//   lakes, rivers  major fresh water, for context
//   range          where the selected species lives, drawn over both: native
//                  places filled, introduced ones hatched
//   records        dots where it has actually been recorded, coloured by
//                  whether it's native or introduced there
//
// Everything it shows comes in through props, and clicks go out as a `select`
// event. It holds no app state of its own, so App.vue stays the one place that
// decides what is selected.
import {
  Map as MapLibre,
  NavigationControl,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapMouseEvent,
} from 'maplibre-gl'
// MapLibre 6 starts its worker from a URL computed at runtime, which no bundler
// can follow — so the build never emits the file and the map stays blank.
// `?worker&url` makes Vite bundle the worker (and the chunk it shares with the
// main library) and hands back its URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { bbox, frameBox, loadWater, type BBox, type RecordPoints, type Regions } from '@/lib/geo'
import { HEAT_STEPS } from '@/lib/heat'
import { isSubdivision } from '@/lib/regions'
import { theme } from '@/lib/theme'

import AppIcon from './AppIcon.vue'

const props = defineProps<{
  countries: Regions
  countryCounts: Map<string, number>
  subdivisions: Regions | null
  subdivisionCounts: Map<string, number>
  selected: string | null
  range: Regions | null
  /** Record grid of the selected species. */
  records: RecordPoints | null
  aquatic: boolean
  /** What a tap on open sea would do ("Close Terciopelo"), or null if nothing. */
  stepOut: string | null
}>()

const emit = defineEmits<{ select: [code: string | null] }>()

const container = ref<HTMLDivElement>()
const tooltip = ref<{ x: number; y: number; name: string; detail: string } | null>(null)
// On touch screens there's no hover, so a tap shows a card instead: what's
// there, and (where a tap would do something) a button that does it. Nothing
// changes until the card is tapped, so a stray tap never loses what's open.
type Card = { x: number; y: number } & (
  | { kind: 'place'; code: string; name: string; detail: string; current: boolean }
  | { kind: 'dot'; name: string; detail: string }
  | { kind: 'out' }
)
const card = ref<Card | null>(null)
const cardClass =
  'absolute z-10 flex -translate-x-1/2 -translate-y-[calc(100%+10px)] items-center gap-1.5 rounded-full bg-(--surface) px-3 py-2 text-sm whitespace-nowrap text-(--ink) shadow-lg ring-1 ring-(--line)'

function actOn(c: Card) {
  card.value = null
  if (c.kind === 'place') emit('select', c.code)
  else if (c.kind === 'out') emit('select', null)
}
let map: MapLibre | undefined
// Set once the style has loaded. Until then MapLibre rejects changes, and the
// 'load' handler applies the current props anyway, so updates just wait.
let ready = false
const WORLD: [number, number, number, number] = [-160, -50, 175, 72]
const EMPTY: Regions = { type: 'FeatureCollection', features: [] }
setWorkerUrl(workerUrl)

// Colours come from CSS custom properties so light/dark lives in one place
// (style.css). MapLibre paints on a canvas and can't read CSS itself, so they
// are read here and re-applied when the theme changes.
function palette() {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return {
    ocean: v('--map-ocean'),
    land: v('--map-land'),
    border: v('--map-border'),
    heat: [1, 2, 3, 4, 5].map((i) => v(`--heat-${i}`)),
    // Water species keep the blues; land species get the greens. Introduced
    // places and their dots are orange either way.
    range: v(props.aquatic ? '--map-range' : '--map-range-land'),
    introduced: v('--map-introduced'),
    selected: v('--map-selected'),
    water: v('--map-water'),
    records: v(props.aquatic ? '--map-records' : '--map-records-land'),
  }
}

// Introduced places are hatched, so they differ from native ones by pattern as
// well as colour (orange and green look alike to many colour-blind people).
// MapLibre patterns are images; this one is drawn here, in the theme's colour.
const HATCH = 'introduced-hatch'
function hatch(color: string): { width: number; height: number; data: Uint8Array } {
  const size = 12 // at pixelRatio 2: a 6px repeat
  const data = new Uint8Array(size * size * 4)
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // A diagonal stripe, 3 of every 12 pixels wide.
      if ((x + y) % size < 3) data.set([r, g, b, 255], (y * size + x) * 4)
    }
  }
  return { width: size, height: size, data }
}

function heatPaint(c: ReturnType<typeof palette>, dimmed: boolean) {
  if (dimmed) return c.land
  return [
    'step',
    ['coalesce', ['get', 'count'], 0],
    c.land,
    ...HEAT_STEPS.flatMap((step, i) => [step, c.heat[i]]),
  ] as unknown as string
}

function withCounts(regions: Regions, counts: Map<string, number>): Regions {
  return {
    ...regions,
    features: regions.features.map((f) => ({
      ...f,
      properties: { ...f.properties, count: counts.get(f.properties.code) ?? 0 },
    })),
  }
}

function source(id: string): GeoJSONSource | undefined {
  return map?.getSource<GeoJSONSource>(id)
}

function applyPalette() {
  if (!map || !ready) return
  const c = palette()
  const dimmed = !!props.range
  map.setPaintProperty('background', 'background-color', c.ocean)
  map.setPaintProperty('countries-fill', 'fill-color', heatPaint(c, dimmed))
  map.setPaintProperty('subdivisions-fill', 'fill-color', heatPaint(c, dimmed))
  map.setPaintProperty('countries-line', 'line-color', c.border)
  map.setPaintProperty('subdivisions-line', 'line-color', c.border)
  map.setPaintProperty('range-fill', 'fill-color', c.range)
  // With dots, they carry the detail and the range fades back: faint for a
  // water species (the land isn't where it lives), lighter for a land one.
  const opacity = !props.records ? 0.55 : props.aquatic ? 0.12 : 0.28
  // Places known without records (checklists, review) are fainter and dashed.
  const fillOpacity: ExpressionSpecification = [
    'case',
    ['==', ['get', 'recorded'], false],
    opacity * 0.5,
    opacity,
  ]
  map.setPaintProperty('range-fill', 'fill-opacity', fillOpacity)
  if (map.hasImage(HATCH)) map.updateImage(HATCH, hatch(c.introduced))
  else map.addImage(HATCH, hatch(c.introduced), { pixelRatio: 2 })
  // The hatching is sparser than a fill, so it stays stronger to read as much.
  map.setPaintProperty('range-introduced-fill', 'fill-opacity', [
    'case',
    ['==', ['get', 'recorded'], false],
    Math.min(1, opacity * 1.6),
    Math.min(1, opacity * 2.4),
  ])
  map.setPaintProperty('range-introduced-line', 'line-color', c.introduced)
  map.setPaintProperty('range-unrecorded-line', 'line-color', [
    'case',
    ['==', ['get', 'introduced'], true],
    c.introduced,
    c.range,
  ])
  map.setPaintProperty('lakes-fill', 'fill-color', c.water)
  map.setPaintProperty('rivers-line', 'line-color', c.water)
  map.setPaintProperty('records-circle', 'circle-color', [
    'case',
    ['==', ['get', 'introduced'], true],
    c.introduced,
    c.records,
  ])
  map.setPaintProperty('records-circle', 'circle-stroke-color', c.ocean)
  map.setPaintProperty('range-line', 'line-color', c.range)
  map.setPaintProperty('selected-line', 'line-color', c.selected)
  map.setPaintProperty('selected-sub-line', 'line-color', c.selected)
}

function flyTo(box: BBox | null) {
  if (!ready) return
  map?.fitBounds(box ?? WORLD, { padding: 32, maxZoom: 6, duration: 700 })
}

function frameSelection() {
  const code = props.selected
  if (!code) return flyTo(bbox(props.range?.features ?? []))
  const source = isSubdivision(code) ? props.subdivisions : props.countries
  const feature = source?.features.find((f) => f.properties.code === code)
  // A state whose outline hasn't loaded yet is framed when it arrives.
  if (feature) flyTo(frameBox(feature))
}

function updateSelectedOutline() {
  if (!ready) return
  map?.setFilter('selected-line', ['==', ['get', 'code'], props.selected ?? ''])
}

onMounted(() => {
  const c = palette()
  map = new MapLibre({
    container: container.value!,
    bounds: WORLD,
    fitBoundsOptions: { padding: 16 },
    attributionControl: { compact: true, customAttribution: 'Boundaries: Natural Earth' },
    dragRotate: false,
    pitchWithRotate: false,
    style: {
      version: 8,
      sources: {
        countries: {
          type: 'geojson',
          data: withCounts(props.countries, props.countryCounts),
          promoteId: 'code',
        },
        subdivisions: { type: 'geojson', data: EMPTY, promoteId: 'code' },
        range: { type: 'geojson', data: EMPTY },
        lakes: { type: 'geojson', data: EMPTY },
        rivers: { type: 'geojson', data: EMPTY },
        records: { type: 'geojson', data: EMPTY },
      },
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': c.ocean } },
        {
          id: 'countries-fill',
          type: 'fill',
          source: 'countries',
          paint: {
            'fill-color': heatPaint(c, false),
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.75, 1],
          },
        },
        {
          id: 'subdivisions-fill',
          type: 'fill',
          source: 'subdivisions',
          paint: {
            'fill-color': heatPaint(c, false),
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.75, 1],
          },
        },
        {
          id: 'lakes-fill',
          type: 'fill',
          source: 'lakes',
          paint: { 'fill-color': c.water },
        },
        {
          id: 'rivers-line',
          type: 'line',
          source: 'rivers',
          // Only the biggest rivers when zoomed out (lower rank = bigger).
          filter: [
            'step',
            ['zoom'],
            ['<=', ['get', 'rank'], 3],
            3,
            ['<=', ['get', 'rank'], 6],
            5,
            true,
          ],
          paint: {
            'line-color': c.water,
            'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 6, 1.6],
          },
        },
        {
          id: 'range-fill',
          type: 'fill',
          source: 'range',
          filter: ['!=', ['get', 'introduced'], true],
          paint: { 'fill-color': c.range, 'fill-opacity': 0.55 },
        },
        {
          id: 'range-introduced-fill',
          type: 'fill',
          source: 'range',
          filter: ['==', ['get', 'introduced'], true],
          paint: { 'fill-pattern': HATCH, 'fill-opacity': 0.9 },
        },
        {
          id: 'countries-line',
          type: 'line',
          source: 'countries',
          paint: { 'line-color': c.border, 'line-width': 0.6 },
        },
        {
          id: 'subdivisions-line',
          type: 'line',
          source: 'subdivisions',
          paint: { 'line-color': c.border, 'line-width': 0.5 },
        },
        {
          id: 'range-line',
          type: 'line',
          source: 'range',
          filter: ['all', ['!=', ['get', 'recorded'], false], ['!=', ['get', 'introduced'], true]],
          paint: { 'line-color': c.range, 'line-width': 1.2 },
        },
        {
          id: 'range-introduced-line',
          type: 'line',
          source: 'range',
          filter: ['all', ['!=', ['get', 'recorded'], false], ['==', ['get', 'introduced'], true]],
          paint: { 'line-color': c.introduced, 'line-width': 1.2 },
        },
        {
          id: 'range-unrecorded-line',
          type: 'line',
          source: 'range',
          filter: ['==', ['get', 'recorded'], false],
          paint: { 'line-color': c.range, 'line-width': 1.2, 'line-dasharray': [2, 2] },
        },
        {
          id: 'records-circle',
          type: 'circle',
          source: 'records',
          paint: {
            'circle-color': ['case', ['==', ['get', 'introduced'], true], c.introduced, c.records],
            // Faint for a single record, solid where records pile up, so a
            // state full of dots still shows where the hotspots are.
            'circle-opacity': [
              'interpolate',
              ['linear'],
              ['ln', ['get', 'n']],
              0,
              0.3,
              2.3,
              0.65,
              4.6,
              0.95,
            ],
            'circle-stroke-color': c.ocean,
            'circle-stroke-width': 0.5,
            // Grows with zoom, and a little with how many records a cell has.
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              1,
              ['interpolate', ['linear'], ['ln', ['get', 'n']], 0, 1.8, 6, 3.5],
              6,
              ['interpolate', ['linear'], ['ln', ['get', 'n']], 0, 5, 6, 9],
            ],
          },
        },
        {
          id: 'selected-line',
          type: 'line',
          source: 'countries',
          filter: ['==', ['get', 'code'], ''],
          paint: { 'line-color': c.selected, 'line-width': 2.5 },
        },
        {
          id: 'selected-sub-line',
          type: 'line',
          source: 'subdivisions',
          filter: ['==', ['get', 'code'], ''],
          paint: { 'line-color': c.selected, 'line-width': 2.5 },
        },
      ],
    },
  })
  map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
  // The introduced-places pattern is drawn on demand, the first time a layer
  // asks for it; applyPalette() redraws it when the theme changes.
  map.on('styleimagemissing', (e: { id: string }) => {
    if (e.id === HATCH && !map!.hasImage(HATCH)) {
      map!.addImage(HATCH, hatch(palette().introduced), { pixelRatio: 2 })
    }
  })

  map.on('load', () => {
    ready = true
    source('countries')?.setData(withCounts(props.countries, props.countryCounts))
    loadWater().then((water) => {
      source('lakes')?.setData(water?.lakes ?? EMPTY)
      source('rivers')?.setData(water?.rivers ?? EMPTY)
    })
    syncSubdivisions()
    syncRange()
    updateSelectedOutline()
    if (props.selected) frameSelection()
  })

  // Hover: highlight the region under the pointer and show its name and count.
  // States take priority over the country they sit in.
  let hovered: { source: string; id: string } | null = null
  const setHover = (next: typeof hovered) => {
    if (hovered) map!.setFeatureState(hovered, { hover: false })
    hovered = next
    if (hovered) map!.setFeatureState(hovered, { hover: true })
  }

  // A record dot's count, on hover.
  const showDot = (n: number, point: { x: number; y: number }) => {
    tooltip.value = {
      x: point.x,
      y: point.y,
      name: `${n} ${n === 1 ? 'record' : 'records'}`,
      detail: 'within about 20 km',
    }
  }

  // The kind of pointer in use. Tracked from pointer events, because Safari
  // reports a finger tap's click (and the mouse events it fakes) as a mouse.
  let pointer = 'mouse'
  const track = (e: PointerEvent) => (pointer = e.pointerType)
  map.getCanvas().addEventListener('pointerdown', track)
  map.getCanvas().addEventListener('pointermove', track)

  map.on('mousemove', (e: MapMouseEvent) => {
    if (pointer !== 'mouse') return
    const [dot] = map!.queryRenderedFeatures(e.point, { layers: ['records-circle'] })
    if (dot) {
      setHover(null)
      showDot(dot.properties.n as number, e.point)
      map!.getCanvas().style.cursor = ''
      return
    }
    const [hit] = map!.queryRenderedFeatures(e.point, {
      layers: ['subdivisions-fill', 'countries-fill'],
    })
    if (!hit) {
      setHover(null)
      tooltip.value = null
      map!.getCanvas().style.cursor = ''
      return
    }
    const code = hit.properties.code as string
    if (hovered?.id !== code) setHover({ source: hit.source, id: code })
    tooltip.value = {
      x: e.point.x,
      y: e.point.y,
      name: hit.properties.name as string,
      detail: `${(hit.properties.count as number) ?? 0} species`,
    }
    map!.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseout', () => {
    setHover(null)
    tooltip.value = null
  })

  const records = (n: number) => `${n} ${n === 1 ? 'record' : 'records'}`
  // Cards sit centred above the tap, kept clear of the map's edges.
  const at = (point: { x: number; y: number }) => {
    const width = container.value!.clientWidth
    const half = Math.min(150, width / 2)
    return { x: Math.min(Math.max(point.x, half), width - half), y: Math.max(point.y, 56) }
  }

  // A mouse click acts straight away: hovering has already shown what's there.
  // A place opens, a record dot does nothing more, and empty sea steps out
  // (App.vue decides what that means).
  //
  // A tap shows a card (see `card`). A fingertip covers far more than a pixel,
  // so a tap just beside a record dot shows that dot, and one just off a coast
  // shows nothing rather than counting as the open sea.
  map.on('click', (e: MapMouseEvent) => {
    const regions = ['subdivisions-fill', 'countries-fill']
    const [hit] = map!.queryRenderedFeatures(e.point, { layers: regions })

    if (pointer === 'mouse') {
      if (hit) return emit('select', hit.properties.code as string)
      const [dot] = map!.queryRenderedFeatures(e.point, { layers: ['records-circle'] })
      if (!dot) emit('select', null)
      return
    }

    const had = card.value
    card.value = null
    tooltip.value = null
    if (hit) {
      const code = hit.properties.code as string
      card.value = {
        ...at(e.point),
        kind: 'place',
        code,
        name: hit.properties.name as string,
        detail: `${(hit.properties.count as number) ?? 0} species`,
        current: code === props.selected,
      }
      return
    }

    const r = 16
    const box: [[number, number], [number, number]] = [
      [e.point.x - r, e.point.y - r],
      [e.point.x + r, e.point.y + r],
    ]
    const dots = map!.queryRenderedFeatures(box, { layers: ['records-circle'] })
    if (dots.length) {
      // The dot nearest the tap.
      const distance = (f: (typeof dots)[number]) => {
        const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates as [number, number]
        const p = map!.project([lng, lat])
        return Math.hypot(p.x - e.point.x, p.y - e.point.y)
      }
      const dot = dots.reduce((a, b) => (distance(b) < distance(a) ? b : a))
      card.value = {
        ...at(e.point),
        kind: 'dot',
        name: records(dot.properties.n as number),
        detail: 'within about 20 km',
      }
      return
    }
    if (map!.queryRenderedFeatures(box, { layers: regions }).length) return

    // Open sea. With a card up, the tap just puts it away.
    if (!had && props.stepOut) card.value = { ...at(e.point), kind: 'out' }
  })
  // A card is about the map as it was; once the map moves, it goes.
  map.on('movestart', () => {
    tooltip.value = null
    card.value = null
  })
})

onBeforeUnmount(() => {
  map?.remove()
})

function syncSubdivisions() {
  if (!ready) return
  const subs = props.subdivisions
  source('subdivisions')?.setData(subs ? withCounts(subs, props.subdivisionCounts) : EMPTY)
  map?.setFilter('selected-sub-line', ['==', ['get', 'code'], props.selected ?? ''])
}

function syncRange() {
  if (!ready) return
  source('range')?.setData(props.range ?? EMPTY)
  source('records')?.setData(props.records ?? EMPTY)
  applyPalette()
}

watch(
  () => props.countryCounts,
  (counts) => ready && source('countries')?.setData(withCounts(props.countries, counts)),
)
watch(() => [props.subdivisions, props.subdivisionCounts], syncSubdivisions)
watch(() => props.records, syncRange)
// Once something opens or closes, a card about the old view no longer applies.
watch(
  () => [props.stepOut, props.selected],
  () => (card.value = null),
)
// Water and land species are coloured differently (blue and green).
watch(() => props.aquatic, applyPalette)
// Light/dark: the tokens in style.css have already switched by the time this
// runs (watchers run after theme.ts has set <html data-theme>).
watch(() => theme.resolved, applyPalette)
watch(
  () => props.range,
  () => {
    syncRange()
    // Opening a species with no place selected frames its range. Closing one
    // leaves the map where it is, so stepping out doesn't lose your zoom.
    if (!props.selected && props.range) flyTo(bbox(props.range.features))
  },
)
watch(
  () => [props.selected, props.subdivisions] as const,
  ([code, subs], [prevCode, prevSubs]) => {
    updateSelectedOutline()
    syncSubdivisions()
    // Re-frame when the selection changes, and again when a state's outline
    // arrives after its country was already chosen.
    if (code !== prevCode || (subs !== prevSubs && code && isSubdivision(code))) {
      if (code || !props.range) frameSelection()
    }
  },
)
</script>

<template>
  <div class="relative h-full w-full">
    <div ref="container" class="h-full w-full" />
    <div
      v-if="tooltip"
      class="pointer-events-none absolute z-10 rounded-md bg-(--surface) px-2 py-1 text-xs whitespace-nowrap text-(--ink) shadow-md ring-1 ring-(--line)"
      :style="{ left: `${tooltip.x + 12}px`, top: `${tooltip.y + 12}px` }"
    >
      <span class="font-semibold">{{ tooltip.name }}</span>
      <span class="text-(--muted)"> · {{ tooltip.detail }}</span>
    </div>
    <template v-if="card">
      <!-- Tap cards: a button where tapping it does something, else plain info. -->
      <button
        v-if="card.kind === 'out' || (card.kind === 'place' && !card.current)"
        type="button"
        :class="cardClass"
        :style="{ left: `${card.x}px`, top: `${card.y}px` }"
        @click="actOn(card)"
      >
        <template v-if="card.kind === 'out'"><AppIcon name="close" />{{ stepOut }}</template>
        <template v-else>
          <span class="font-semibold">{{ card.name }}</span>
          <span class="text-(--muted)">· {{ card.detail }}</span>
          <span class="ml-1 text-(--accent)">Open ›</span>
        </template>
      </button>
      <div v-else :class="cardClass" :style="{ left: `${card.x}px`, top: `${card.y}px` }">
        <span class="font-semibold">{{ card.name }}</span>
        <span class="text-(--muted)">· {{ card.detail }}</span>
      </div>
    </template>
  </div>
</template>
