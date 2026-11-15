<script setup lang="ts">
import type { ClockSync } from '~/composables/useGameClock'
import { useGameClock } from '~/composables/useGameClock'
import type { GameState } from '~/types/game'
import type { PaceComparison, PaceReference, PaceStanding } from '~/utils/pace-benchmark'
import { formatTierName } from '#common/utils/tiers'

/**
 * Our pace: CS per minute, with its curve so a glance says whether it is
 * climbing or slipping, and gold per minute. The CS a minute is live: our
 * creep score, which the shell sends at each last hit, over the game clock
 * run on between readings (`useGameClock`) — it rises at every last hit,
 * with a "+1" that floats off, and sinks while the farm waits; under it, the
 * pace of the last minute or so, against the whole game's. The curve and
 * gold read the samples the shell keeps at each whole minute
 * (`live_client::pace`), the curve's last point the live figure; gold is gold
 * earned as far as the API lets it be read (inventory cost plus gold in hand).
 *
 * With a `reference` (#1912), each figure gains the median of games played at
 * our Solo/Duo tier at this minute, an arrow in the data colours for where we
 * stand against that tier's quartiles, and the curve a faint line of the
 * median. A reference, not advice: nothing here tells the player what to do.
 * Our gold reads a little under gold earned (consumables used and sell-back
 * losses are invisible to the API), so the gold arrow leans low, never high.
 */
const { t } = useT()
const props = defineProps<{ game: GameState, reference?: PaceReference | null, sync?: ClockSync }>()

const samples = computed(() => props.game.pace.samples)
const last = computed(() => samples.value.at(-1) ?? null)

/** The game clock, in minutes: run on between readings live, the reading's own in a preview. */
const clock = useGameClock(() => props.sync ?? { gameTime: props.game.gameTime, at: Date.now() })
const minutes = computed(() => clock.value / 60)
/** Our creep score now: the shell's at our last hit, the latest minute's sample without a player of ours. */
const cs = computed(() => props.game.players.find(player => player.isMe)?.creepScore ?? last.value?.cs ?? 0)
/** From the first minute: before it, no minion has reached a lane and every value is a ramp. */
const csPerMinute = computed(() => (minutes.value >= 1 ? cs.value / minutes.value : null))
const goldPerMinute = computed(() => (last.value ? Math.round(last.value.gold / last.value.minute) : 0))

/**
 * The pace of the last minute or so: the creep score since the latest whole
 * minute's sample at least a minute back, over the time since — what the
 * farm does now, where the whole game's figure moves slowly.
 */
const recent = computed(() => {
  const since = [...samples.value].reverse().find(sample => sample.minute <= minutes.value - 1)
  if (!since || csPerMinute.value === null) return null
  const value = (cs.value - since.cs) / (minutes.value - since.minute)
  const tone = value >= csPerMinute.value + 0.3 ? STANDING.above : value <= csPerMinute.value - 0.3 ? STANDING.below : STANDING.within
  return { value, ...tone }
})

/** The last hit just landed, as a "+n" floating off the figure; cleared once its animation is done. */
const gain = shallowRef<{ id: number, amount: number } | null>(null)
let gains = 0
let fading: ReturnType<typeof setTimeout> | undefined
watch(cs, (now, before) => {
  if (before === undefined || now <= before || minutes.value < 1) return
  gain.value = { id: ++gains, amount: now - before }
  clearTimeout(fading)
  fading = setTimeout(() => (gain.value = null), 900)
})
onBeforeUnmount(() => clearTimeout(fading))

const tier = computed(() => (props.reference ? formatTierName(props.reference.tier) : null))

const STANDING: Record<PaceStanding, { icon: string, tone: string }> = {
  above: { icon: 'i-lucide-arrow-up', tone: 'text-data-good' },
  within: { icon: 'i-lucide-equal', tone: 'text-data-mid' },
  below: { icon: 'i-lucide-arrow-down', tone: 'text-data-bad' },
}

const comparisons = computed(() => {
  const reference = props.reference
  const row = (comparison: PaceComparison | null | undefined, digits: number) => comparison
    ? { ...STANDING[comparison.standing], median: comparison.median.toFixed(digits) }
    : null
  return { cs: row(reference?.cs, 1), gold: row(reference?.gold, 0) }
})

/** The curve leaves out the first minutes, when no minion has reached a lane yet and every value is a ramp. */
const CURVE_FROM = 3
const WIDTH = 72
const HEIGHT = 26

const curve = computed(() => {
  const points = samples.value
    .filter(sample => sample.minute >= CURVE_FROM)
    .map(sample => ({ minute: sample.minute, value: sample.cs / sample.minute }))
  // The live figure as the curve's end, between the whole minutes.
  if (csPerMinute.value !== null && minutes.value >= CURVE_FROM && minutes.value > (points.at(-1)?.minute ?? 0)) {
    points.push({ minute: minutes.value, value: csPerMinute.value })
  }
  if (points.length < 2) return null
  const first = points[0]!.minute
  const lastMinute = points.at(-1)!.minute
  const median = (props.reference?.csCurve ?? [])
    .filter(point => point.minute >= first && point.minute <= lastMinute)
  const span = Math.max(1, lastMinute - first)
  // One scale for both lines, so the reference sits where its values are.
  const values = [...points, ...median].map(point => point.value)
  const low = Math.min(...values)
  const high = Math.max(...values)
  const range = high - low || 1
  const toLine = (line: { minute: number, value: number }[]) => line.map(point => ({
    x: ((point.minute - first) / span) * WIDTH,
    // A flat curve sits in the middle; otherwise it fills the height with a margin for the stroke.
    y: high === low ? HEIGHT / 2 : 2 + (1 - (point.value - low) / range) * (HEIGHT - 4),
  }))
  const join = (xy: { x: number, y: number }[]) => xy.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const xy = toLine(points)
  const line = join(xy)
  return {
    line,
    area: `0,${HEIGHT} ${line} ${WIDTH},${HEIGHT}`,
    end: xy.at(-1)!,
    median: median.length >= 2 ? join(toLine(median)) : null,
  }
})

const gradient = `pace-${useId()}`
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-end justify-between gap-3">
      <div class="flex flex-col">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">CS/min</span>
        <span class="relative">
          <span class="stat-value text-xl leading-none tabular-nums transition-[color,text-shadow] duration-300" :class="gain ? 'text-primary pace-glow' : 'text-highlighted'">{{ csPerMinute === null ? '–' : csPerMinute.toFixed(1) }}</span>
          <Transition leave-active-class="transition-opacity duration-150" leave-to-class="opacity-0">
            <span v-if="gain" :key="gain.id" class="pace-gain pointer-events-none absolute -top-1 left-full ml-1 text-[11px] font-semibold tabular-nums text-primary">+{{ gain.amount }}</span>
          </Transition>
        </span>
        <span v-if="recent" class="mt-1 flex items-center gap-1 whitespace-nowrap text-[10px] leading-none tabular-nums text-muted">
          <UIcon :name="recent.icon" :class="['size-2.5 shrink-0', recent.tone]" />
          {{ recent.value.toFixed(1) }} {{ t('overlay.stats.now') }}
        </span>
      </div>
      <svg v-if="curve" :width="WIDTH" :height="HEIGHT" :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" class="overflow-visible text-primary" aria-hidden="true">
        <defs>
          <linearGradient :id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="currentColor" stop-opacity="0.28" />
            <stop offset="1" stop-color="currentColor" stop-opacity="0" />
          </linearGradient>
        </defs>
        <polygon :points="curve.area" :fill="`url(#${gradient})`" />
        <polyline v-if="curve.median" :points="curve.median" fill="none" class="text-data-mid" stroke="currentColor" stroke-opacity="0.6" stroke-width="1" stroke-dasharray="2 2" />
        <polyline :points="curve.line" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
        <circle :cx="curve.end.x" :cy="curve.end.y" r="2" fill="currentColor" />
        <circle v-if="gain" :key="gain.id" :cx="curve.end.x" :cy="curve.end.y" r="2" fill="none" stroke="currentColor" class="pace-ping" />
      </svg>
    </div>
    <span v-if="tier && comparisons.cs" class="-mt-1 flex items-center gap-1 whitespace-nowrap text-[10px] leading-none tabular-nums text-muted">
      <UIcon :name="comparisons.cs.icon" :class="['size-2.5 shrink-0', comparisons.cs.tone]" />
      {{ tier }} {{ comparisons.cs.median }}
    </span>
    <div class="flex flex-col border-t border-default pt-2">
      <span class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">{{ t('overlay.stats.goldPerMinute') }}</span>
      <span class="stat-value text-xl leading-none tabular-nums text-stat-gold">{{ last ? goldPerMinute : '–' }}</span>
      <span v-if="tier && comparisons.gold" class="mt-1 flex items-center gap-1 whitespace-nowrap text-[10px] leading-none tabular-nums text-muted">
        <UIcon :name="comparisons.gold.icon" :class="['size-2.5 shrink-0', comparisons.gold.tone]" />
        {{ tier }} {{ comparisons.gold.median }}
      </span>
    </div>
  </div>
</template>

<style scoped>
/* The last hit: a "+1" rising off the figure, the figure's glow and a ring on the curve's end, all gone within a second. */
.pace-gain {
  animation: pace-gain 900ms ease-out forwards;
}
.pace-glow {
  text-shadow: 0 0 10px color-mix(in oklab, var(--ui-primary) 60%, transparent);
}
.pace-ping {
  transform-box: fill-box;
  transform-origin: center;
  animation: pace-ping 700ms ease-out forwards;
}
@keyframes pace-gain {
  from { opacity: 0; transform: translateY(4px); }
  20% { opacity: 1; }
  to { opacity: 0; transform: translateY(-10px); }
}
@keyframes pace-ping {
  from { opacity: 0.9; transform: scale(1); }
  to { opacity: 0; transform: scale(3.5); }
}
@media (prefers-reduced-motion: reduce) {
  .pace-gain, .pace-ping { animation-duration: 1ms; }
}
</style>
