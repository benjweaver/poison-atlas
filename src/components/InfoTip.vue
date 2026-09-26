<script setup lang="ts">
// A small bubble of explanation next to whatever is in the slot.
//
// With a mouse it shows on hover, with a keyboard on focus. Touch screens
// can't hover, so there a tap toggles it, unless `tap` is false: then the tap
// belongs to the thing itself (a button that does something) and the bubble
// is only a hover/focus label.
import { nextTick, onBeforeUnmount, ref, useId } from 'vue'

const props = withDefaults(defineProps<{ text: string; tap?: boolean }>(), { tap: true })
// The bubble is teleported, so there are two roots; classes go on the trigger.
defineOptions({ inheritAttrs: false })

const id = useId()
const open = ref(false)
const trigger = ref<HTMLElement>()
const bubble = ref<HTMLElement>()
const pos = ref({ left: 0, top: 0, below: false })

// Fixed-positioned above the trigger (below if there's no room), kept 8px
// inside the viewport so it's never cut off at a phone's edge.
async function place() {
  await nextTick()
  const t = trigger.value?.getBoundingClientRect()
  const b = bubble.value?.getBoundingClientRect()
  if (!t || !b) return
  const below = t.top < b.height + 12
  const left = Math.min(Math.max(8, t.left + t.width / 2 - b.width / 2), innerWidth - b.width - 8)
  pos.value = { left, top: below ? t.bottom + 6 : t.top - b.height - 6, below }
}

// Whether the last input was the keyboard: focus from Tab shows the bubble, but
// focus from a tap doesn't (Safari focuses whatever you tap, and :focus-visible
// can't be relied on to tell the two apart).
let keyboard = false
const fromKeyboard = () => (keyboard = true)
const fromPointer = () => (keyboard = false)

// Scrolling closes it, but not the tiny scrolls a tap itself can cause on iOS
// (focus, the toolbar settling): only a real scroll away does.
let scrolledFrom = 0
function onScroll() {
  if (Math.abs(scrollY - scrolledFrom) > 12) hide()
}

function show() {
  open.value = true
  place()
  scrolledFrom = scrollY
  addEventListener('scroll', onScroll, { capture: true, passive: true })
}
function hide() {
  open.value = false
  removeEventListener('scroll', onScroll, { capture: true })
}

// The pointer that started the current press. Safari reports a tap's click
// event as a mouse click, so the click can't say whether it was a tap.
let pressedWith = ''
function onDown(e: PointerEvent) {
  pressedWith = e.pointerType
}

// Mouse hovers; touch and pen taps (handled in onClick) so a tap doesn't both
// open it on "enter" and close it on "click".
function onEnter(e: PointerEvent) {
  if (e.pointerType === 'mouse') show()
}
function onLeave(e: PointerEvent) {
  if (e.pointerType === 'mouse') hide()
}
function onClick() {
  if (!props.tap) return hide()
  // A mouse already opened it on hover; keep it open.
  if (pressedWith === 'mouse') return
  if (open.value) hide()
  else show()
}

function onOutside(e: PointerEvent) {
  if (open.value && !trigger.value?.contains(e.target as Node)) hide()
}
function onFocus() {
  if (keyboard) show()
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') hide()
}
addEventListener('pointerdown', onOutside)
addEventListener('keydown', onKey)
addEventListener('keydown', fromKeyboard, { capture: true })
addEventListener('pointerdown', fromPointer, { capture: true })
onBeforeUnmount(() => {
  removeEventListener('pointerdown', onOutside)
  removeEventListener('keydown', onKey)
  removeEventListener('keydown', fromKeyboard, { capture: true })
  removeEventListener('pointerdown', fromPointer, { capture: true })
  removeEventListener('scroll', onScroll, { capture: true })
})
</script>

<template>
  <span
    v-bind="$attrs"
    ref="trigger"
    class="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-(--accent)"
    :tabindex="tap ? 0 : undefined"
    :aria-describedby="open ? id : undefined"
    @pointerdown="onDown"
    @pointerenter="onEnter"
    @pointerleave="onLeave"
    @focusin="onFocus"
    @focusout="hide"
    @click="onClick"
  >
    <slot />
  </span>
  <Teleport to="body">
    <span
      v-if="open"
      :id="id"
      ref="bubble"
      role="tooltip"
      class="pointer-events-none fixed z-50 max-w-64 rounded-md bg-(--ink) px-2.5 py-1.5 text-xs leading-snug font-normal text-(--surface) normal-case shadow-lg"
      :style="{ left: `${pos.left}px`, top: `${pos.top}px` }"
    >
      {{ text }}
    </span>
  </Teleport>
</template>
