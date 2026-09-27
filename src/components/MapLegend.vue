<script setup lang="ts">
import { computed } from 'vue'

import { HEAT_STEPS, heatLabel } from '@/lib/heat'

import InfoTip from './InfoTip.vue'

const props = defineProps<{
  range: boolean
  records: boolean
  /** The species has places listed without any records. */
  unrecorded?: boolean
  /** The species has introduced places, drawn hatched in orange. */
  introduced?: boolean
  aquatic?: 'marine' | 'freshwater'
}>()

// Blue for species that live in the water, green for land ones (as on the map).
const dot = computed(() => (props.aquatic ? 'var(--map-records)' : 'var(--map-records-land)'))
const fill = computed(() => (props.aquatic ? 'var(--map-range)' : 'var(--map-range-land)'))
// The map's hatching, as a swatch.
const hatch = 'repeating-linear-gradient(-45deg, var(--map-introduced) 0 2px, transparent 2px 5px)'

// One row per status, its dot beside its shading, so the legend stays short
// enough not to cover the range on a phone. What the dots are is a tap away.
const nativeHelp = computed(() => {
  const where =
    props.aquatic === 'marine'
      ? 'at sea or on the shore'
      : props.aquatic === 'freshwater'
        ? 'in rivers and lakes'
        : 'in the wild'
  const dots = props.records
    ? ` Dots: where it has been recorded ${where}, within about 20 km.`
    : ''
  return `Shading: places where it's native.${dots}`
})
</script>

<template>
  <div
    class="rounded-lg bg-(--surface)/90 px-3 py-2 text-[11px] text-(--muted) shadow-sm ring-1 ring-(--line) backdrop-blur"
  >
    <div v-if="range" class="flex flex-col gap-1">
      <span class="inline-flex items-center gap-1.5">
        <span v-if="records" class="h-2.5 w-2.5 rounded-full" :style="{ background: dot }" />
        <span class="h-3 w-3 rounded-sm opacity-60" :style="{ background: fill }" />
        <InfoTip :text="nativeHelp">Native <span class="ml-1" aria-hidden="true">ⓘ</span></InfoTip>
      </span>
      <span v-if="introduced" class="inline-flex items-center gap-1.5">
        <span
          v-if="records"
          class="h-2.5 w-2.5 rounded-full"
          :style="{ background: 'var(--map-introduced)' }"
        />
        <span
          class="h-3 w-3 rounded-sm ring-1 ring-(--map-introduced) ring-inset"
          :style="{ background: hatch }"
        />
        <InfoTip
          text="Brought by people and now established in the wild (naturalised or invasive). Places where it's only grown or kept aren't shown."
          >Introduced <span class="ml-1" aria-hidden="true">ⓘ</span></InfoTip
        >
      </span>
      <span v-if="unrecorded" class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-sm border border-dashed" :style="{ borderColor: fill }" />
        Known range, no records
      </span>
    </div>
    <template v-else>
      <InfoTip
        text="How many of the atlas's poisonous species grow or live in each country, native or introduced. Tap a country to see them, and its states where they're listed."
        class="mb-1 font-medium text-(--ink)"
      >
        Species recorded <span class="ml-1 text-(--muted)" aria-hidden="true">ⓘ</span>
      </InfoTip>
      <div class="flex flex-wrap gap-x-2 gap-y-1">
        <span class="flex items-center gap-1">
          <span
            class="h-3 w-3 rounded-sm ring-1 ring-(--line) ring-inset"
            :style="{ background: 'var(--map-land)' }"
          />
          None
        </span>
        <span v-for="(_, i) in HEAT_STEPS" :key="i" class="flex items-center gap-1">
          <span class="h-3 w-3 rounded-sm" :style="{ background: `var(--heat-${i + 1})` }" />
          {{ heatLabel(i) }}
        </span>
      </div>
    </template>
  </div>
</template>
