<script setup lang="ts">
import type { ClockSync } from '~/composables/useGameClock'
import { useGameClock } from '~/composables/useGameClock'
import type { GameState } from '~/types/game'
import { winProbability } from '~/utils/item-value'

/**
 * Each side's chance to win, on screen for the whole game: a model fitted on
 * our ranked games (`winProbability`) over each lane's creep-score, level and
 * kill lead, plus the map — turrets, inhibitors down, drakes, the Baron's and
 * the Elder's buffs. Our
 * side on the left in blue, theirs on the right in red (blue and red sides
 * when spectating) — the colours say which is which, so no labels.
 */
const { t } = useT()
const props = defineProps<{ game: GameState, sync: ClockSync }>()

// An inhibitor standing again or a buff running out is a matter of the clock, which runs here between two readings.
const clock = useGameClock(() => props.sync)

const ours = computed(() => Math.round(winProbability(props.game, clock.value) * 100))
/** The side ahead reads at full strength, the other steps back; an even game keeps both. */
const leading = computed(() => (ours.value > 50 ? 'ours' : ours.value < 50 ? 'theirs' : null))
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <p class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-dimmed">
      <AppMark class="size-2.5" />
      {{ t('overlay.panel.winProbability.label') }}
    </p>
    <div class="flex items-end justify-between gap-3">
      <span
        class="stat-value text-2xl leading-none tabular-nums text-ally transition-opacity duration-500"
        :class="leading === 'theirs' ? 'opacity-55' : 'drop-shadow-[0_0_8px_color-mix(in_oklch,var(--color-ally)_45%,transparent)]'"
      >{{ ours }}<span class="text-sm">%</span></span>
      <span
        class="stat-value text-2xl leading-none tabular-nums text-enemy transition-opacity duration-500"
        :class="leading === 'ours' ? 'opacity-55' : 'drop-shadow-[0_0_8px_color-mix(in_oklch,var(--color-enemy)_45%,transparent)]'"
      >{{ 100 - ours }}<span class="text-sm">%</span></span>
    </div>
    <!--
      One bar, both sides meeting where the odds stand. The even line is a notch
      standing just past the bar's edges rather than a cut through it: drawn
      inside, it split the leading side's colour in two and read as a glitch.
    -->
    <div class="relative">
      <!-- Each side a layer that scales (`transform`, the GPU's work), the line between them sliding: the same bar, no layout every frame over the game. -->
      <div class="relative h-1.5 overflow-hidden rounded-full bg-elevated ring-1 ring-inset ring-white/5">
        <span class="absolute inset-0 origin-left bg-linear-to-r from-ally/60 to-ally transition-transform duration-700 ease-[var(--tm-ease)] will-change-transform" :style="{ transform: `scaleX(${ours / 100})` }" />
        <span class="absolute inset-0 origin-right bg-linear-to-r from-enemy to-enemy/60 transition-transform duration-700 ease-[var(--tm-ease)] will-change-transform" :style="{ transform: `scaleX(${1 - ours / 100})` }" />
        <span class="absolute inset-0 transition-transform duration-700 ease-[var(--tm-ease)] will-change-transform" :style="{ transform: `translateX(${ours}%)` }"><span class="block h-full w-px bg-white/70" /></span>
      </div>
      <span class="pointer-events-none absolute -inset-y-0.5 left-1/2 w-px -translate-x-1/2 rounded-full bg-white/30" aria-hidden="true" />
    </div>
  </div>
</template>
