<script setup lang="ts">
import { computed } from 'vue'

import { HEAT_STEPS, heatLabel } from '@/lib/heat'

import InfoTip from './InfoTip.vue'

const props = defineProps<{
  range: boolean
  records: boolean
  /** The species has places listed without any records. */
  unrecorded?: boolean
  aquatic?: 'marine' | 'freshwater'
}>()

// Blue for animals that live in the water, green for land animals (as on the map).
const dot = computed(() => (props.aquatic ? 'var(--map-records)' : 'var(--map-records-land)'))
const fill = computed(() => (props.aquatic ? 'var(--map-range)' : 'var(--map-range-land)'))
</script>

<template>
  <div
    class="rounded-lg bg-(--surface)/90 px-3 py-2 text-[11px] text-(--muted) shadow-sm ring-1 ring-(--line) backdrop-blur"
  >
    <template v-if="records">
      <div class="flex flex-col gap-1">
        <span class="inline-flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: dot }" />
          {{
            aquatic === 'marine'
              ? 'Recorded at sea or on the shore'
              : aquatic === 'freshwater'
                ? 'Recorded in rivers and lakes'
                : 'Where it has been recorded'
          }}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="h-3 w-3 rounded-sm opacity-40" :style="{ background: fill }" /> Places it's
          found in
        </span>
        <span v-if="unrecorded" class="inline-flex items-center gap-1.5">
          <span class="h-3 w-3 rounded-sm border border-dashed" :style="{ borderColor: fill }" />
          Known range, no records
        </span>
      </div>
    </template>
    <template v-else-if="range">
      <span class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-sm opacity-70" :style="{ background: fill }" /> Where this
        species lives
      </span>
    </template>
    <template v-else>
      <InfoTip
        text="How many of the atlas's poisonous species live in each country. Tap a country to see them, and its states where they're listed."
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
