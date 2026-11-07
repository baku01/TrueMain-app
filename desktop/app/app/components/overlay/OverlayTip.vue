<script setup lang="ts">
import type { Tip } from '~/utils/tips/catalogue'
import { CATEGORY_ICONS, URGENT_PRIORITY } from '~/utils/tips/catalogue'
import { CATEGORY_TONES, tipImage, tipText } from '~/utils/tips/display'
import { SHOW_SECONDS } from '~/utils/tips/queue'

/**
 * One tip as the Tips panel shows it, on the panel's pane like every other
 * panel's content: a bar down the pane's left edge and the category's name in
 * the category's colour, the game's minimap icon of the objective it counts
 * down to (or the category's icon), then its line — a sentence read at a
 * glance — and a hairline along the pane's foot running out over the seconds
 * it stays (`seconds`), still in the preview. A countdown about to run out
 * (`URGENT_PRIORITY`) has the pane's edge breathe, as the objectives' do.
 *
 * With `ago` the tip is one that already left, kept dim in the pane until the
 * next: no hairline, no breathing.
 */
const props = defineProps<{ tip: Tip, seconds?: number, still?: boolean, ago?: string }>()

const { t } = useT()

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
const label = computed(() => t(`tips.category.${props.tip.category}`))
const tone = computed(() => TONES[CATEGORY_TONES[props.tip.category]])
const urgent = computed(() => !props.ago && props.tip.priority >= URGENT_PRIORITY)
</script>

<template>
  <div
    class="relative flex items-center gap-2"
    :class="ago && 'opacity-60'"
    data-tip
    :data-key="tip.key"
    role="status"
  >
    <span class="pointer-events-none absolute -inset-y-2.5 -left-3 w-0.5 bg-current" :class="tone" aria-hidden="true" />
    <span v-if="urgent" class="pointer-events-none absolute -inset-x-3 -inset-y-2.5" aria-hidden="true">
      <span class="block size-full rounded-xl" :class="still ? 'ring-1 ring-primary/80 ring-inset' : 'animate-overlay-soon'" />
    </span>
    <img v-if="image" :src="image" alt="" class="size-5 shrink-0" data-tip-image>
    <span v-else class="flex size-5 shrink-0 items-center justify-center">
      <UIcon :name="CATEGORY_ICONS[tip.category]" class="size-4" :class="tone" data-tip-icon />
    </span>
    <div class="min-w-0 flex-1">
      <span class="block text-[10px] leading-none font-semibold tracking-wider uppercase" :class="tone" data-tip-label>
        {{ label }}<span v-if="ago" class="text-dimmed"> · {{ ago }}</span>
      </span>
      <p class="mt-1 text-xs leading-snug font-medium text-highlighted">{{ text }}</p>
    </div>
    <span
      v-if="!ago"
      class="pointer-events-none absolute -inset-x-3 -bottom-2.5 h-px origin-left bg-primary/70"
      :class="!still && 'animate-tip-time'"
      :style="{ animationDuration: `${seconds ?? SHOW_SECONDS}s` }"
      aria-hidden="true"
    />
  </div>
</template>
