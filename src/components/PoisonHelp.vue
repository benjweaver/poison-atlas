<script setup lang="ts">
// Who to call: the poison centre for the country being viewed, with a number
// to tap, or else the general advice. Poison control comes first because it
// can say whether an exposure needs treatment, often before symptoms start.
import type { Help } from '@/lib/poison-help'

import AppIcon from './AppIcon.vue'

defineProps<{ help: Help | null }>()
</script>

<template>
  <p>
    <AppIcon name="phone" class="mr-1 inline align-[-2px]" />
    <template v-if="help"
      >Poison help in {{ help.place }}:
      <a :href="`tel:${help.centre.tel}`" class="font-semibold whitespace-nowrap text-(--accent)">{{
        help.centre.phone
      }}</a>
      ({{ help.centre.name }}<template v-if="help.centre.note">; {{ help.centre.note }}</template
      >).</template
    >
    <template v-else>Call your local poison centre, or your emergency number.</template>
  </p>
</template>
