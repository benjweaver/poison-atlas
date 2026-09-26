<script setup lang="ts">
import { GROUP_LABELS, type Danger, type Group } from '@/data/taxonomy'

const props = defineProps<{ available: Group[] }>()
const groups = defineModel<Group[]>('groups', { required: true })
const query = defineModel<string>('query', { required: true })
const minDanger = defineModel<Danger>('minDanger', { required: true })

// A minimum rather than a pick-list: people want "the dangerous ones", not
// "exactly level 3". Short labels, because the menu shares a row with search.
const DANGER_OPTIONS: { value: Danger; label: string }[] = [
  { value: 1, label: 'Any danger' },
  { value: 2, label: 'Significant+' },
  { value: 3, label: 'Serious+' },
  { value: 4, label: 'Potentially fatal+' },
  { value: 5, label: 'Extremely dangerous' },
]

function toggle(group: Group) {
  groups.value = groups.value.includes(group)
    ? groups.value.filter((g) => g !== group)
    : props.available.filter((g) => g === group || groups.value.includes(g))
}
</script>

<template>
  <div class="space-y-2">
    <!-- 16px text on phones: iOS Safari zooms the page into any smaller field.
         On very narrow screens the menu drops below search rather than
         squeezing it. -->
    <div class="flex flex-wrap gap-2">
      <input
        v-model.trim="query"
        type="search"
        placeholder="Search species…"
        aria-label="Search species"
        class="min-w-32 flex-[3_1_8rem] rounded-lg bg-(--surface-2) px-3 py-2 text-base md:text-sm ring-1 ring-(--line) outline-none placeholder:text-(--muted) focus:ring-2 focus:ring-(--accent)"
      />
      <select
        v-model.number="minDanger"
        aria-label="Minimum danger"
        class="max-w-full flex-[1_1_auto] rounded-lg bg-(--surface-2) px-2 py-2 text-base md:text-sm ring-1 ring-(--line) outline-none focus:ring-2 focus:ring-(--accent)"
        :class="minDanger > 1 ? 'text-(--accent)' : 'text-(--muted)'"
      >
        <option v-for="o in DANGER_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <!-- Phones: one row that scrolls sideways (fading at the edge to show there's
         more), instead of three rows of chips. -->
    <div
      class="flex flex-wrap gap-1.5 max-md:-mx-4 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 max-md:py-0.5 max-md:[mask-image:linear-gradient(to_right,black_88%,transparent)] max-md:[scrollbar-width:none]"
      role="group"
      aria-label="Filter by animal group"
    >
      <button
        v-for="group in available"
        :key="group"
        type="button"
        :aria-pressed="groups.includes(group)"
        class="shrink-0 rounded-full px-2.5 py-1 text-xs ring-1 transition-colors"
        :class="
          groups.includes(group)
            ? 'bg-(--accent) text-(--on-accent) ring-(--accent)'
            : 'text-(--muted) ring-(--line) hover:text-(--ink)'
        "
        @click="toggle(group)"
      >
        {{ GROUP_LABELS[group] }}
      </button>
      <button
        v-if="groups.length"
        type="button"
        class="shrink-0 px-1 text-xs text-(--muted) underline hover:text-(--ink) max-md:order-first"
        @click="groups = []"
      >
        Clear
      </button>
    </div>
  </div>
</template>
