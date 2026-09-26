<script setup lang="ts">
import type { Species } from '@/data/schema'
import { GROUP_LABELS } from '@/data/taxonomy'

import DangerBadge from './DangerBadge.vue'

defineProps<{ species: Species; countryWide?: boolean }>()
defineEmits<{ open: [] }>()
</script>

<template>
  <button
    type="button"
    class="flex w-full gap-3 rounded-lg p-2 text-left transition-colors hover:bg-(--surface-2) focus-visible:bg-(--surface-2) focus-visible:outline-none"
    @click="$emit('open')"
  >
    <img
      v-if="species.image"
      :src="species.image.src"
      :alt="species.name"
      loading="lazy"
      class="h-20 w-20 shrink-0 rounded-md bg-(--surface-2) object-cover"
    />
    <div v-else class="h-20 w-20 shrink-0 rounded-md bg-(--surface-2)" />
    <div class="min-w-0 flex-1">
      <div class="flex items-baseline justify-between gap-2">
        <h3 class="line-clamp-2 font-semibold">{{ species.name }}</h3>
        <span
          class="shrink-0 text-[11px] tracking-wide text-(--muted) uppercase max-[340px]:hidden"
        >
          {{ GROUP_LABELS[species.group] }}
        </span>
      </div>
      <p class="truncate text-xs text-(--muted) italic">{{ species.scientificName }}</p>
      <DangerBadge :level="species.danger" class="mt-1" />
      <p class="mt-1 line-clamp-2 text-sm text-(--muted)">{{ species.summary }}</p>
      <p v-if="species.aquatic" class="mt-1 text-[11px] font-medium text-(--map-records)">
        {{ species.aquatic === 'marine' ? 'In the sea' : 'In rivers and lakes' }}
      </p>
      <p v-if="countryWide" class="mt-1 text-[11px] text-(--muted)">
        Recorded country-wide — not broken down by state
      </p>
    </div>
  </button>
</template>
