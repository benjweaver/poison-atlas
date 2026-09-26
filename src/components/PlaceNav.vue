<script setup lang="ts">
// Where you are, always in view: World › Country › State › Species. Every
// step but the last is a link back to it. With a species open there's a close
// button, and on phones (where the map scrolls away) a button back to the map.
import AppIcon from './AppIcon.vue'
import InfoTip from './InfoTip.vue'

defineProps<{
  crumbs: { code: string | null; label: string }[]
  /** Name of the open species, shown as the last step. */
  species?: string
}>()
defineEmits<{ go: [code: string | null]; close: []; map: [] }>()
</script>

<template>
  <nav
    aria-label="Where you are"
    class="flex min-h-11 items-center gap-2 border-b border-(--line) bg-(--surface) px-4 py-1.5"
  >
    <ol class="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
      <li v-for="(crumb, i) in crumbs" :key="crumb.label" class="flex items-center gap-1">
        <span v-if="i > 0" class="text-(--muted)" aria-hidden="true">›</span>
        <span
          v-if="i === crumbs.length - 1 && !species"
          class="font-semibold"
          aria-current="location"
        >
          <AppIcon v-if="i === 0" name="globe" class="mr-1 inline align-[-2px]" />{{ crumb.label }}
        </span>
        <button
          v-else
          type="button"
          class="rounded-sm text-left text-(--accent) hover:underline"
          @click="$emit('go', crumb.code)"
        >
          <template v-if="i === 0"
            ><AppIcon name="globe" class="inline align-[-2px] sm:mr-1" /><span
              class="max-sm:sr-only"
              >{{ crumb.label }}</span
            ></template
          ><template v-else>{{ crumb.label }}</template>
        </button>
      </li>
      <li v-if="species" class="flex items-center gap-1">
        <span class="text-(--muted)" aria-hidden="true">›</span>
        <span class="font-semibold" aria-current="page">{{ species }}</span>
      </li>
    </ol>

    <InfoTip text="Back to the map" :tap="false" class="md:hidden">
      <button
        type="button"
        class="flex items-center gap-1 rounded-full p-2 text-xs text-(--muted) ring-1 ring-(--line) hover:text-(--ink) sm:px-2.5 sm:py-1 md:hidden"
        aria-label="Back to the map"
        @click="$emit('map')"
      >
        <AppIcon name="map" /><span class="max-sm:hidden">Map</span>
      </button>
    </InfoTip>
    <InfoTip v-if="species" text="Close this species (Esc)" :tap="false">
      <button
        type="button"
        class="flex items-center gap-1 rounded-full p-2 text-xs text-(--muted) ring-1 ring-(--line) hover:text-(--ink) sm:px-2.5 sm:py-1"
        aria-label="Close this species"
        @click="$emit('close')"
      >
        <AppIcon name="close" /><span class="max-sm:hidden">Close</span>
      </button>
    </InfoTip>
  </nav>
</template>
