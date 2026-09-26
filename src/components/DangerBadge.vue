<script setup lang="ts">
import { computed } from 'vue'

import { DANGER_LABELS, type Danger } from '@/data/taxonomy'

import InfoTip from './InfoTip.vue'

// `explain` adds a tap/hover explanation of the scale. Off inside species
// cards, which are buttons themselves: a tap there opens the species.
const props = defineProps<{ level: Danger; explain?: boolean }>()

const help = computed(
  () =>
    `Danger ${props.level} of 5: ${DANGER_LABELS[props.level].toLowerCase()}. ` +
    `The scale runs from 1 (${DANGER_LABELS[1].toLowerCase()}) to 5 (${DANGER_LABELS[5].toLowerCase()}).`,
)
</script>

<template>
  <component
    :is="explain ? InfoTip : 'span'"
    :text="explain ? help : undefined"
    class="inline-flex"
  >
    <span
      class="inline-flex items-center gap-1.5 text-xs font-medium"
      :style="{ color: `var(--danger-${level}-ink)` }"
      :title="explain ? undefined : `Danger ${level} of 5`"
    >
      <span class="flex gap-0.5" aria-hidden="true">
        <span
          v-for="i in 5"
          :key="i"
          class="h-1.5 w-2.5 rounded-full"
          :style="{ background: i <= level ? `var(--danger-${level})` : 'var(--line)' }"
        />
      </span>
      {{ DANGER_LABELS[level] }}
      <span v-if="explain" class="text-(--muted)"
        ><span class="sr-only">About the scale</span>ⓘ</span
      >
    </span>
  </component>
</template>
