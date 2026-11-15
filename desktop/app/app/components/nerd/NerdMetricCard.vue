<script setup lang="ts">
import type { MetricAssociation } from '~/utils/nerd-stats/analysis'
import { confidenceOf, metricSplit } from '~/utils/nerd-stats/insights'
import { ascending, quantile } from '~/utils/nerd-stats/stats'

/**
 * One metric, wins against losses, said plainly first: the win rate with more
 * of it against with less (`metricSplit`) and how far that can be trusted.
 * Then every game a dot on its row (jittered, so equal values do not hide
 * each other), each row's mean a bar across it; under them the win rate in
 * the metric's terciles or quartiles, each bar coloured by whether it sits
 * above or below the player's own rate, with its Wilson interval, a coin flip
 * and that rate ruled across. A yes/no metric (first blood, the side) has no
 * spread to strip: it shows its two bins alone, larger. Its d, r, p and q are
 * behind "show the maths", each in a line.
 */
const props = defineProps<{
  entry: MetricAssociation
  /** The player's overall win rate: each bin's par. */
  rate: number
}>()

const { t } = useT()
const f = useNerdFormat()
const say = useNerdSay()
const tip = useChartTip()

const split = computed(() => metricSplit(props.entry))
const sentence = computed(() => say.split(props.entry, split.value))
const confidence = computed(() => confidenceOf(props.entry.correlation ? props.entry.q : null))
const symbols = computed(() => [
  { symbol: 'd', value: effect.value ? f.signed(effect.value.d, 2) : '—', meaning: t('nerd.sym.d') },
  { symbol: 'r_{pb}', value: props.entry.correlation ? f.signed(props.entry.correlation.r, 2) : '—', meaning: t('nerd.sym.r') },
  { symbol: 'p', value: props.entry.correlation ? f.pValue(props.entry.correlation.p) : '—', meaning: t('nerd.sym.p') },
  { symbol: 'q', value: props.entry.correlation ? f.pValue(props.entry.q) : '—', meaning: t('nerd.sym.q') },
  { symbol: 'n', value: String(props.entry.games), meaning: t('nerd.sym.n') },
])

const binary = computed(() => props.entry.definition.format === 'binary')
const W = 300
const PAD = 8

/** The strip's range: the 1st to 99th percentile, so one outlier does not squeeze the rest to a line. */
const range = computed(() => {
  const all = ascending([...props.entry.winValues, ...props.entry.lossValues])
  const low = quantile(all, 0.01)
  const high = quantile(all, 0.99)
  return high > low ? [low, high] as const : [low - 1, high + 1] as const
})
const x = (value: number) => {
  const [low, high] = range.value
  return PAD + (Math.min(Math.max(value, low), high) - low) / (high - low) * (W - 2 * PAD)
}
/** A fixed jitter per game (a hash of its index), so a redraw never shuffles the dots. */
const jitter = (index: number) => ((Math.sin(index * 12.9898) * 43758.5453) % 1 + 1) % 1

const dots = computed(() => [
  ...props.entry.winValues.map((value, index) => ({ key: `w${index}`, cx: x(value), cy: 5 + jitter(index) * 16, win: true })),
  ...props.entry.lossValues.map((value, index) => ({ key: `l${index}`, cx: x(value), cy: 31 + jitter(index + 977) * 16, win: false })),
])

const effect = computed(() => props.entry.effect)

const binLabel = (from: number, to: number) => {
  if (binary.value) return from === 1 ? t('nerd.yes') : t('nerd.no')
  const a = f.metric(props.entry.definition, from)
  const b = f.metric(props.entry.definition, to)
  return a === b ? a : `${a} – ${b}`
}

function showBin(event: MouseEvent | FocusEvent, index: number) {
  const bin = props.entry.bins[index]!
  tip.show(event, binLabel(bin.from, bin.to), [
    { label: t('nerd.col.winRate'), value: f.percent(bin.rate, 0), swatch: 'var(--ui-primary)' },
    { label: t('nerd.col.ci'), value: `${f.percent(bin.low, 0)} – ${f.percent(bin.high, 0)}` },
    { label: t('nerd.col.games'), value: String(bin.games) },
  ])
}
</script>

<template>
  <article :ref="el => (tip.box.value = el as HTMLElement)" class="surface relative flex flex-col rounded-lg p-3.5">
    <header class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-sm font-semibold text-highlighted">{{ t(`nerd.metric.${entry.definition.key}`) }}</h3>
        <p class="text-[11px] text-dimmed">{{ t(`nerd.timing.${entry.definition.timing}`) }} · {{ t('nerd.distributions.games', { count: entry.games }) }}</p>
      </div>
      <NerdConfidence :level="confidence" :detail="say.metricDetail(entry)" class="shrink-0" />
    </header>
    <p v-if="sentence" class="mt-2 text-[11.5px] leading-snug text-muted"><NerdRich :text="sentence" /></p>

    <template v-if="!binary">
      <svg :viewBox="`0 0 ${W} 52`" class="mt-2 w-full" role="img" :aria-label="t('nerd.distributions.stripLabel', { win: effect ? f.metric(entry.definition, effect.meanA) : '—', loss: effect ? f.metric(entry.definition, effect.meanB) : '—' })">
        <line :x1="PAD" :x2="W - PAD" y1="26" y2="26" class="stroke-[var(--ui-border)]" />
        <circle v-for="dot in dots" :key="dot.key" :cx="dot.cx" :cy="dot.cy" r="2.2" :fill="dot.win ? 'var(--nerd-win)' : 'var(--nerd-loss)'" fill-opacity="0.5" />
        <template v-if="effect">
          <rect :x="x(effect.meanA) - 1.5" y="2" width="3" height="22" rx="1.5" class="fill-[var(--ui-text-highlighted)]" />
          <rect :x="x(effect.meanB) - 1.5" y="28" width="3" height="22" rx="1.5" class="fill-[var(--ui-text-highlighted)]" />
        </template>
      </svg>
      <div class="flex justify-between text-[10px] tabular-nums text-dimmed">
        <span>{{ f.metric(entry.definition, range[0]) }}</span>
        <span v-if="effect">{{ t('nerd.distributions.means', { win: f.metric(entry.definition, effect.meanA), loss: f.metric(entry.definition, effect.meanB) }) }}</span>
        <span>{{ f.metric(entry.definition, range[1]) }}</span>
      </div>
    </template>

    <!-- The win rate by bin, against a coin flip, at the card's foot whatever the strip above took. -->
    <div class="mt-auto pt-5">
    <div class="relative grid items-end gap-1.5" :class="binary ? 'h-24' : 'h-16'" :style="{ gridTemplateColumns: `repeat(${entry.bins.length}, minmax(0, 1fr))` }">
      <span class="pointer-events-none absolute inset-x-0 h-px bg-(--ui-border-accented)" style="bottom: 50%" />
      <span class="nerd-dash pointer-events-none absolute inset-x-0 z-10" :style="{ bottom: `${rate * 100}%` }" />
      <button
        v-for="(bin, index) in entry.bins"
        :key="index"
        type="button"
        class="relative h-full cursor-default rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
        :aria-label="`${binLabel(bin.from, bin.to)}: ${f.percent(bin.rate, 0)}`"
        @pointerenter="showBin($event, index)"
        @focus="showBin($event, index)"
        @pointerleave="tip.hide"
        @blur="tip.hide"
      >
        <span class="nerd-column absolute inset-x-[18%] bottom-0 rounded-t-[4px]" :class="bin.rate >= rate ? 'bg-(--nerd-win)/75' : 'bg-(--nerd-loss)/70'" :style="{ height: `${bin.rate * 100}%`, animationDelay: `${index * 50}ms` }" />
        <span class="absolute left-1/2 w-px -translate-x-1/2 bg-(--ui-text-muted)" :style="{ bottom: `${bin.low * 100}%`, height: `${(bin.high - bin.low) * 100}%` }" />
        <span class="absolute left-1/2 -translate-x-1/2 text-[10px] font-semibold tabular-nums text-highlighted" :style="{ bottom: `calc(${Math.max(bin.rate, bin.high) * 100}% + 1px)` }">{{ f.percent(bin.rate, 0) }}</span>
      </button>
    </div>
    </div>
    <div class="mt-1 grid gap-1.5 text-center text-[10px] tabular-nums text-dimmed" :style="{ gridTemplateColumns: `repeat(${entry.bins.length}, minmax(0, 1fr))` }">
      <span v-for="(bin, index) in entry.bins" :key="index" class="truncate">{{ binLabel(bin.from, bin.to) }}<br>{{ t('nerd.distributions.games', { count: bin.games }) }}</span>
    </div>
    <NerdDetails class="mt-3" :symbols="symbols" />
    <NerdTip :tip="tip.tip.value" />
  </article>
</template>

<style scoped>
.nerd-column {
  transform-origin: bottom;
  animation: nerd-column 520ms var(--tm-ease) backwards;
}

@keyframes nerd-column {
  from { transform: scaleY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .nerd-column {
    animation: none;
  }
}
</style>
