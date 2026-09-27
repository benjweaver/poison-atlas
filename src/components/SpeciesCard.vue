<script setup lang="ts">
import type { Species } from '@/data/schema'
import { GROUP_LABELS } from '@/data/taxonomy'
import { harmfulIf } from '@/lib/routes'

import DangerBadge from './DangerBadge.vue'

defineProps<{ species: Species; countryWide?: boolean; introduced?: boolean }>()
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
      <p class="mt-1 text-[11px] text-(--muted)">
        {{ harmfulIf(species.exposure.routes)
        }}<span v-if="species.aquatic" class="font-medium text-(--map-records)">
          · {{ species.aquatic === 'marine' ? 'in the sea' : 'in rivers and lakes' }}</span
        ><span v-if="introduced" class="font-medium text-(--introduced-ink)">
          · introduced here</span
        >
      </p>
      <p v-if="countryWide" class="mt-1 text-[11px] text-(--muted)">
        Recorded country-wide — not broken down by state
      </p>
    </div>
  </button>
</template>
