<script setup lang="ts">
// The few line icons the app uses, drawn on a 24px grid in the current text
// colour. Decorative: whatever uses one gives it an accessible label.
export type IconName = 'sun' | 'moon' | 'system' | 'close' | 'map' | 'globe' | 'info' | 'heart'

defineProps<{ name: IconName; small?: boolean }>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="shrink-0"
    :class="small ? 'h-3 w-3' : 'h-4 w-4'"
  >
    <template v-if="name === 'sun'">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
      />
    </template>
    <path v-else-if="name === 'moon'" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    <template v-else-if="name === 'system'">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </template>
    <path v-else-if="name === 'close'" d="M6 6l12 12M18 6L6 18" />
    <template v-else-if="name === 'map'">
      <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
      <path d="M9 3v15M15 6v15" />
    </template>
    <template v-else-if="name === 'globe'">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </template>
    <path
      v-else-if="name === 'heart'"
      d="M12 21C12 21 3 15.5 3 9a4.5 4.5 0 0 1 9 0 4.5 4.5 0 0 1 9 0c0 6.5-9 12-9 12z"
    />
    <template v-else-if="name === 'info'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </template>
  </svg>
</template>
