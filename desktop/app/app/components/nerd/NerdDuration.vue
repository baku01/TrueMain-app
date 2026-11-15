<script setup lang="ts">
import type { DurationReport, Overview } from '~/utils/nerd-stats/analysis'
import type { GameRow } from '~/utils/nerd-stats/features'

/**
 * The win rate over the game's length: the kernel-smoothed curve with its
 * band (`kernelRate`, Silverman's bandwidth), the five-minute bins over it as
 * points with their Wilson intervals, a coin flip ruled at 50%, and a
 * crosshair reading the curve at any minute. Under it, on the same minutes,
 * how many games ended there, wins and losses stacked — one chart per measure,
 * never two scales on one plot.
 */
const props = defineProps<{
  duration: DurationReport
  overview: Overview
  rows: GameRow[]
}>()

const { t } = useT()
const f = useNerdFormat()
const tip = useChartTip()

const span = computed(() => {
  const curve = props.duration.curve
  const minutes = props.rows.map(row => row.game.durationSeconds / 60)
  const low = Math.floor(Math.min(curve[0]?.x ?? 20, ...minutes.filter(m => m >= (curve[0]?.x ?? 0) - 2)))
  const high = Math.ceil(Math.max(curve.at(-1)?.x ?? 40, ...minutes.filter(m => m <= (curve.at(-1)?.x ?? 60) + 2)))
  return [low, Math.max(high, low + 10)] as const
})
const x = (minute: number) => (Math.min(Math.max(minute, span.value[0]), span.value[1]) - span.value[0]) / (span.value[1] - span.value[0]) * 100
const y = (rate: number) => 100 - rate * 100

const line = computed(() => props.duration.curve.map(point => `${x(point.x)},${y(point.rate)}`).join(' '))
const band = computed(() => {
  const curve = props.duration.curve
  return [...curve.map(point => `${x(point.x)},${y(point.high)}`), ...[...curve].reverse().map(point => `${x(point.x)},${y(point.low)}`)].join(' ')
})
const xTicks = computed(() => {
  const out: number[] = []
  for (let minute = Math.ceil(span.value[0] / 5) * 5; minute <= span.value[1]; minute += 5) out.push(minute)
  return out
})

/** Bins under this many games are left to the histogram: a point resting on one game is all whisker. */
const MIN_BIN_GAMES = 3

/** Each bin drawn at its middle; the open ones (under 20, 40+) a little inside their edge. */
const binPoints = computed(() => props.duration.bins.filter(bin => bin.games >= MIN_BIN_GAMES).map(bin => ({
  ...bin,
  at: Number.isFinite(bin.to) ? (bin.from === 0 ? bin.to - 2 : (bin.from + bin.to) / 2) : bin.from + 2.5,
  label: bin.from === 0 ? `< ${bin.to}` : Number.isFinite(bin.to) ? `${bin.from}–${bin.to}` : `${bin.from}+`,
})))

/** Games per two minutes, wins under losses. */
const histogram = computed(() => {
  const [low, high] = span.value
  const buckets: { from: number, wins: number, losses: number }[] = []
  for (let from = low; from < high; from += 2) buckets.push({ from, wins: 0, losses: 0 })
  for (const row of props.rows) {
    const minute = row.game.durationSeconds / 60
    const index = Math.min(Math.max(Math.floor((minute - low) / 2), 0), buckets.length - 1)
    if (row.win) buckets[index]!.wins++
    else buckets[index]!.losses++
  }
  return buckets
})
const tallest = computed(() => Math.max(1, ...histogram.value.map(bucket => bucket.wins + bucket.losses)))

const hoverX = ref<number | null>(null)
function track(event: PointerEvent) {
  const frame = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const minute = span.value[0] + (event.clientX - frame.left) / frame.width * (span.value[1] - span.value[0])
  const nearest = props.duration.curve.reduce<typeof props.duration.curve[number] | null>((best, point) => (!best || Math.abs(point.x - minute) < Math.abs(best.x - minute) ? point : best), null)
  if (!nearest) return
  hoverX.value = x(nearest.x)
  tip.show(event, t('nerd.duration.at', { minute: f.minutes(nearest.x) }), [
    { label: t('nerd.col.winRate'), value: f.percent(nearest.rate, 1), swatch: 'var(--nerd-win)' },
    { label: t('nerd.col.ci'), value: `${f.percent(nearest.low, 0)} – ${f.percent(nearest.high, 0)}` },
    { label: t('nerd.duration.effective'), value: f.number(nearest.effective, 1) },
  ])
}
function leave() {
  hoverX.value = null
  tip.hide()
}
</script>

<template>
  <section class="surface rounded-lg">
    <header class="flex flex-wrap items-center gap-3 border-b border-default px-4 py-3.5">
      <span class="tm-emblem grid size-9 shrink-0 place-items-center rounded-lg text-primary">
        <UIcon name="i-tabler-hourglass" class="size-5" />
      </span>
      <div class="min-w-0 flex-1">
        <h2 class="text-base font-semibold text-highlighted">{{ t('nerd.duration.title') }}</h2>
        <p class="text-xs text-muted">{{ t('nerd.duration.subtitle', { count: overview.games, bandwidth: f.number(duration.bandwidth, 1) }) }}</p>
      </div>
      <div class="flex gap-2">
        <div class="rounded-lg bg-elevated/50 px-3 py-1.5 ring-1 ring-default">
          <p class="stat-label">{{ t('nerd.duration.wins') }}</p>
          <p class="font-display text-lg font-semibold text-highlighted">{{ f.minutes(duration.win) }}</p>
        </div>
        <div class="rounded-lg bg-elevated/50 px-3 py-1.5 ring-1 ring-default">
          <p class="stat-label">{{ t('nerd.duration.losses') }}</p>
          <p class="font-display text-lg font-semibold text-highlighted">{{ f.minutes(duration.loss) }}</p>
        </div>
        <div class="rounded-lg bg-elevated/50 px-3 py-1.5 ring-1 ring-default">
          <p class="stat-label">Cohen d</p>
          <p class="font-display text-lg font-semibold text-highlighted">{{ duration.effect ? f.signed(duration.effect.d, 2) : '—' }}</p>
        </div>
      </div>
    </header>

    <div :ref="el => (tip.box.value = el as HTMLElement)" class="relative p-4 pl-12">
      <!-- The win rate over the minutes. -->
      <div class="relative h-64" @pointermove="track" @pointerleave="leave">
        <span v-for="tick in [0, 0.25, 0.5, 0.75, 1]" :key="tick" class="absolute -left-10 w-8 -translate-y-1/2 text-right text-[10px] tabular-nums text-dimmed" :style="{ top: `${y(tick)}%` }">{{ f.percent(tick, 0) }}</span>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 size-full overflow-visible" role="img" :aria-label="t('nerd.duration.curveLabel')">
          <line v-for="tick in [0, 25, 75, 100]" :key="tick" x1="0" x2="100" :y1="tick" :y2="tick" class="stroke-[var(--ui-border)]" vector-effect="non-scaling-stroke" />
          <line x1="0" x2="100" y1="50" y2="50" class="stroke-[var(--ui-border-accented)]" vector-effect="non-scaling-stroke" />
          <polygon :points="band" class="nerd-fade fill-(--nerd-win)/12" />
          <polyline :points="line" fill="none" class="nerd-fade stroke-(--nerd-win)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
          <line v-if="hoverX !== null" :x1="hoverX" :x2="hoverX" y1="0" y2="100" class="stroke-[var(--ui-text-dimmed)]" vector-effect="non-scaling-stroke" />
        </svg>
        <template v-for="bin in binPoints" :key="bin.from">
          <span class="pointer-events-none absolute w-px -translate-x-1/2 bg-(--ui-text-muted)" :style="{ left: `${x(bin.at)}%`, top: `${y(bin.high)}%`, height: `${(bin.high - bin.low) * 100}%` }" />
          <span class="pointer-events-none absolute size-2.5 -translate-1/2 rounded-full bg-(--ui-text-highlighted) ring-2 ring-(--tm-pane)" :style="{ left: `${x(bin.at)}%`, top: `${y(bin.rate)}%` }" />
          <span class="pointer-events-none absolute -translate-x-1/2 translate-y-2 whitespace-nowrap text-[10px] tabular-nums text-muted" :style="{ left: `${x(bin.at)}%`, top: `${y(bin.low)}%` }">{{ f.percent(bin.rate, 0) }} · {{ bin.games }}</span>
        </template>
      </div>

      <!-- How many games ended at each length, on the same minutes. -->
      <div class="mt-6 flex h-16 items-end gap-[2px]">
        <div v-for="bucket in histogram" :key="bucket.from" class="flex h-full flex-1 flex-col justify-end gap-[2px]" :title="`${bucket.from}–${bucket.from + 2} min: ${bucket.wins} / ${bucket.losses}`">
          <span v-if="bucket.losses" class="nerd-stack rounded-t-[3px] bg-(--nerd-loss)" :style="{ height: `${bucket.losses / tallest * 100}%` }" />
          <span v-if="bucket.wins" class="nerd-stack bg-(--nerd-win)" :class="bucket.losses ? '' : 'rounded-t-[3px]'" :style="{ height: `${bucket.wins / tallest * 100}%` }" />
        </div>
      </div>
      <div class="relative mt-1 h-4">
        <span v-for="tick in xTicks" :key="tick" class="absolute -translate-x-1/2 text-[10px] tabular-nums text-dimmed" :style="{ left: `${x(tick)}%` }">{{ tick }}′</span>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span class="flex items-center gap-1.5"><span class="h-0.5 w-3 rounded-full bg-(--nerd-win)" />{{ t('nerd.duration.curve') }}</span>
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-(--ui-text-highlighted)" />{{ t('nerd.duration.bins') }}</span>
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-sm bg-(--nerd-win)" />{{ t('nerd.wins') }}</span>
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-sm bg-(--nerd-loss)" />{{ t('nerd.losses') }}</span>
      </div>
      <NerdTip :tip="tip.tip.value" />
    </div>
  </section>
</template>

<style scoped>
.nerd-fade {
  animation: nerd-fade 700ms var(--tm-ease) backwards;
}

.nerd-stack {
  transform-origin: bottom;
  animation: nerd-stack 480ms var(--tm-ease) backwards;
}

@keyframes nerd-fade {
  from { opacity: 0; }
}

@keyframes nerd-stack {
  from { transform: scaleY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .nerd-fade, .nerd-stack {
    animation: none;
  }
}
</style>
