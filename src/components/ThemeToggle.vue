<script setup lang="ts">
// One button that cycles System → Light → Dark. Its icon is the current
// choice, and the label says what the next tap does.
import { computed } from 'vue'

import { cycleTheme, theme, type ThemePreference } from '@/lib/theme'

import AppIcon from './AppIcon.vue'
import InfoTip from './InfoTip.vue'

const NAMES: Record<ThemePreference, string> = { system: 'System', light: 'Light', dark: 'Dark' }
const NEXT: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
}

const label = computed(() => {
  const now =
    theme.preference === 'system'
      ? `Theme: system (${theme.resolved})`
      : `Theme: ${NAMES[theme.preference].toLowerCase()}`
  return `${now}. Switch to ${NAMES[NEXT[theme.preference]].toLowerCase()}.`
})
</script>

<template>
  <InfoTip :text="label" :tap="false">
    <button
      type="button"
      class="rounded-full p-2 text-(--muted) ring-1 ring-(--line) hover:bg-(--surface-2) hover:text-(--ink)"
      :aria-label="label"
      @click="cycleTheme"
    >
      <AppIcon
        :name="
          theme.preference === 'system' ? 'system' : theme.preference === 'dark' ? 'moon' : 'sun'
        "
      />
    </button>
  </InfoTip>
</template>
