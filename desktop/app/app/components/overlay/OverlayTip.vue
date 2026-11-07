<script setup lang="ts">
import type { Tip } from '~/utils/tips/catalogue'
import { CATEGORY_ICONS } from '~/utils/tips/catalogue'
import { CATEGORY_TONES, tipImage, tipText } from '~/utils/tips/display'
import { SHOW_SECONDS } from '~/utils/tips/queue'

/**
 * One tip as the overlay shows it, under the objectives strip: the game's
 * minimap icon of the objective it counts down to, or its category's icon in
 * the category's colour, then its line — a sentence read at a glance — and a
 * hairline along its foot running out over the seconds it stays
 * (`SHOW_SECONDS`), still in the preview.
 */
const props = defineProps<{ tip: Tip, still?: boolean }>()

const TONES = {
  primary: 'text-primary',
  enemy: 'text-enemy',
  success: 'text-success',
  warning: 'text-warning',
  gold: 'text-stat-gold',
  muted: 'text-muted',
} as const

const image = computed(() => tipImage(props.tip))
const text = computed(() => tipText(props.tip))
const tone = computed(() => TONES[CATEGORY_TONES[props.tip.category]])
</script>

<template>
  <div
    class="relative flex items-center gap-2 overflow-hidden rounded-md bg-elevated/70 px-2 py-1.5 ring-1 ring-inset ring-default"
    data-tip
    :data-key="tip.key"
    role="status"
  >
    <img v-if="image" :src="image" alt="" class="size-5 shrink-0" data-tip-image>
    <span v-else class="flex size-5 shrink-0 items-center justify-center">
      <UIcon :name="CATEGORY_ICONS[tip.category]" class="size-4" :class="tone" data-tip-icon />
    </span>
    <p class="min-w-0 flex-1 text-xs leading-snug font-medium text-highlighted">{{ text }}</p>
    <span
      class="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-primary/70"
      :class="!still && 'animate-tip-time'"
      :style="{ animationDuration: `${SHOW_SECONDS}s` }"
      aria-hidden="true"
    />
  </div>
</template>
