<script setup lang="ts">
/**
 * A guide's rating as MOBAFire draws it: its score out of 10 in a ring that
 * fills with it, lit while the guide is rated this season, and its votes
 * beside it.
 */
const props = withDefaults(defineProps<{
  score: number | null
  current: boolean
  up: number
  down: number
  /** The guide's header: a larger ring. */
  large?: boolean
}>(), { large: false })

const { t } = useT()
const RADIUS = 22
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const offset = computed(() => CIRCUMFERENCE * (1 - Math.min(10, Math.max(0, props.score ?? 0)) / 10))
</script>

<template>
  <div class="flex shrink-0 items-center gap-3">
    <div class="relative" :class="large ? 'size-16' : 'size-13'">
      <svg viewBox="0 0 52 52" class="size-full -rotate-90">
        <circle cx="26" cy="26" :r="RADIUS" fill="none" stroke-width="5" stroke="var(--ui-bg-accented)" />
        <circle
          cx="26"
          cy="26"
          :r="RADIUS"
          fill="none"
          stroke-width="5"
          stroke-linecap="round"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="offset"
          :stroke="current ? 'var(--ui-primary)' : 'var(--ui-text-dimmed)'"
          class="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span class="absolute inset-0 flex items-center justify-center font-bold tabular-nums text-highlighted" :class="large ? 'text-xl' : 'text-base'">{{ score ?? '–' }}</span>
    </div>
    <div class="flex flex-col items-start text-xs tabular-nums">
      <span class="flex items-center gap-1 font-semibold text-data-good"><UIcon name="i-lucide-thumbs-up" class="size-3.5" />{{ up.toLocaleString() }}</span>
      <span class="stat-label text-[9px]!">{{ t('guides.votes') }}</span>
      <span class="flex items-center gap-1 text-muted"><UIcon name="i-lucide-thumbs-down" class="size-3.5" />{{ down.toLocaleString() }}</span>
    </div>
  </div>
</template>
