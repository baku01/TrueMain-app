<script setup lang="ts">
import type { SequenceReport } from '~/utils/nerd-stats/analysis'
import { isFew, streakReading } from '~/utils/nerd-stats/insights'
import { wilson } from '~/utils/nerd-stats/stats'

/**
 * Streaks and tilt: the Wald–Wolfowitz runs test drawn as the standard normal
 * with the observed z marked and the two tails that make its p-value shaded;
 * the win rate after a win, after a loss and after two of either, with Wilson
 * intervals and the two-proportion test between the first two; and how long
 * the runs of wins and of losses were, against what a sequence in random
 * order would give (a run of length k has probability (1 − p)·p^(k−1)).
 * Said first in two sentences — the next game after a win against after a
 * loss, and whether the results come in streaks — each with how sure; the
 * test values are behind "show the maths".
 */
const props = defineProps<{
  sequence: SequenceReport
  rate: number
}>()

const { t } = useT()
const f = useNerdFormat()

const runs = computed(() => props.sequence.runs)
const reading = computed(() => streakReading(props.sequence))
const verdict = computed(() => reading.value.pattern)
const momentumLine = computed(() => (Number.isFinite(reading.value.afterWin) && Number.isFinite(reading.value.afterLoss)
  ? t('nerd.streaks.sayMomentum', { afterWin: f.percent(reading.value.afterWin), afterLoss: f.percent(reading.value.afterLoss) })
  : ''))
const symbols = computed(() => [
  ...(runs.value
    ? [
        { symbol: 'R', value: String(runs.value.runs), meaning: t('nerd.sym.runs') },
        { symbol: 'E[R]', value: f.number(runs.value.expected, 1), meaning: t('nerd.sym.expectedRuns') },
        { symbol: 'z', value: f.signed(runs.value.z, 2), meaning: t('nerd.sym.z') },
        { symbol: 'p', value: f.pValue(runs.value.p), meaning: t('nerd.sym.p') },
      ]
    : []),
  ...(props.sequence.momentum
    ? [{ symbol: `Δ = p_{${t('nerd.symbol.win')}} − p_{${t('nerd.symbol.loss')}}`, value: `${f.signed(props.sequence.momentum.difference * 100, 1)} pp · p = ${f.pValue(props.sequence.momentum.p)}`, meaning: t('nerd.sym.momentum') }]
    : []),
])

/** The standard normal's density over z ∈ [−4, 4], in the plot's 0..100 units. */
const Z = 4
const zx = (z: number) => (Math.max(-Z, Math.min(Z, z)) + Z) / (2 * Z) * 100
const density = (z: number) => Math.exp(-z * z / 2)
const curve = computed(() => Array.from({ length: 81 }, (_, i) => -Z + i * 0.1).map(z => `${zx(z)},${92 - density(z) * 82}`).join(' '))
const tails = computed(() => {
  const z = Math.abs(runs.value?.z ?? 0)
  const side = (from: number, to: number) => {
    const points: string[] = [`${zx(from)},92`]
    for (let v = from; v <= to + 1e-9; v += 0.05) points.push(`${zx(v)},${92 - density(v) * 82}`)
    points.push(`${zx(to)},92`)
    return points.join(' ')
  }
  return z >= Z ? [] : [side(-Z, -z), side(z, Z)]
})

const momentum = computed(() => {
  const moves = props.sequence.transitions
  return (['afterWin', 'afterLoss', 'afterTwoWins', 'afterTwoLosses'] as const).map(key => ({
    key,
    ...moves[key],
    ...wilson(moves[key].wins, moves[key].games),
  }))
})

/** Lengths of the runs of each result, 1..5+, against the counts a random order would give. */
const lengths = computed(() => {
  const results = props.sequence.results.map(entry => entry.win)
  const counts = { win: [0, 0, 0, 0, 0], loss: [0, 0, 0, 0, 0] }
  let i = 0
  while (i < results.length) {
    let j = i
    while (j + 1 < results.length && results[j + 1] === results[i]) j++
    counts[results[i] ? 'win' : 'loss'][Math.min(j - i, 4)]!++
    i = j + 1
  }
  const expected = (p: number, total: number) => [0, 1, 2, 3, 4].map(k => (k < 4 ? (1 - p) * p ** k : p ** 4) * total)
  const winRuns = counts.win.reduce((a, b) => a + b, 0)
  const lossRuns = counts.loss.reduce((a, b) => a + b, 0)
  return {
    win: counts.win,
    loss: counts.loss,
    expectedWin: expected(props.rate, winRuns),
    expectedLoss: expected(1 - props.rate, lossRuns),
    tallest: Math.max(1, ...counts.win, ...counts.loss),
  }
})
</script>

<template>
  <section class="surface rounded-lg">
    <NerdCardHeader icon="i-tabler-flame" :title="t('nerd.streaks.title')" :technical="t('nerd.streaks.technical')" :subtitle="t('nerd.streaks.subtitle', { count: sequence.results.length })" />

    <div class="grid gap-2 px-4 pt-4 xl:grid-cols-2">
      <NerdLead v-if="momentumLine" :text="momentumLine" :confidence="reading.momentumConfidence" :few="isFew(sequence.results.length)" icon="i-tabler-arrow-forward-up" />
      <NerdLead :text="t(`nerd.streaks.say.${verdict}`)" :confidence="verdict === 'streaky' || verdict === 'alternating' ? reading.patternConfidence : undefined" icon="i-tabler-arrows-shuffle" />
    </div>

    <div class="grid gap-6 p-4 xl:grid-cols-3">
      <!-- The runs test. -->
      <div class="min-w-0">
        <h3 class="stat-label">{{ t('nerd.streaks.runs') }}</h3>
        <template v-if="runs">
          <p class="mt-1 text-sm text-highlighted">
            <span class="font-display text-2xl font-semibold">{{ runs.runs }}</span>
            <span class="ml-1.5 text-muted">{{ t('nerd.streaks.runsVs', { expected: f.number(runs.expected, 0) }) }}</span>
          </p>
          <div class="relative mt-2 h-28">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 size-full" role="img" :aria-label="t('nerd.streaks.zLabel', { z: f.signed(runs.z, 2), p: f.pValue(runs.p) })">
              <polygon v-for="(points, index) in tails" :key="index" :points="points" class="fill-(--nerd-loss)/25" />
              <polyline :points="curve" fill="none" class="stroke-(--ui-text-muted)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
              <line x1="0" x2="100" y1="92" y2="92" class="stroke-[var(--ui-border-accented)]" vector-effect="non-scaling-stroke" />
              <line :x1="zx(runs.z)" :x2="zx(runs.z)" y1="4" y2="92" class="stroke-(--ui-text-highlighted)" stroke-width="2" vector-effect="non-scaling-stroke" />
            </svg>
            <span class="absolute top-0 -translate-x-1/2 rounded bg-default px-1 text-[10px] font-semibold text-highlighted ring-1 ring-default" :style="{ left: `${zx(runs.z)}%` }">{{ t('nerd.streaks.you') }}</span>
          </div>
          <div class="flex justify-between text-[10px] text-dimmed"><span>{{ t('nerd.streaks.axisStreaky') }}</span><span>{{ t('nerd.streaks.axisChance') }}</span><span>{{ t('nerd.streaks.axisAlternating') }}</span></div>
          <div class="mt-2">
            <NerdHowTo :text="t('nerd.streaks.runsHow')" />
          </div>
        </template>
        <p v-else class="mt-2 text-xs text-dimmed">{{ t('nerd.streaks.verdict.none') }}</p>
      </div>

      <!-- What the next game does after each result. -->
      <div class="min-w-0">
        <h3 class="stat-label">{{ t('nerd.streaks.momentum') }}</h3>
        <ul class="mt-2 space-y-2.5">
          <li v-for="entry in momentum" :key="entry.key" class="text-xs">
            <div class="flex justify-between gap-2">
              <span class="text-muted">{{ t(`nerd.streaks.${entry.key}`) }}</span>
              <span class="tabular-nums"><b class="font-semibold text-highlighted">{{ entry.games ? f.percent(entry.rate, 0) : '—' }}</b> <span class="text-dimmed">({{ entry.wins }}/{{ entry.games }})</span></span>
            </div>
            <div class="relative mt-1 h-2 rounded-full bg-accented/60">
              <span class="absolute inset-y-[-3px] left-1/2 w-px bg-(--ui-border-accented)" />
              <span class="nerd-dash-v absolute inset-y-[-3px]" :style="{ left: `${rate * 100}%` }" />
              <span v-if="entry.games" class="absolute inset-y-0 rounded-full" :class="entry.rate >= rate ? 'bg-(--nerd-win)/30' : 'bg-(--nerd-loss)/30'" :style="{ left: `${entry.low * 100}%`, width: `${(entry.high - entry.low) * 100}%` }" />
              <span v-if="entry.games" class="absolute top-1/2 size-2.5 -translate-1/2 rounded-full ring-2 ring-(--tm-pane)" :class="entry.rate >= rate ? 'bg-(--nerd-win)' : 'bg-(--nerd-loss)'" :style="{ left: `${entry.rate * 100}%` }" />
            </div>
          </li>
        </ul>
        <div class="mt-3">
          <NerdHowTo :text="t('nerd.streaks.momentumHow', { rate: f.percent(rate) })" />
        </div>
      </div>

      <!-- How long the runs were. -->
      <div class="min-w-0">
        <h3 class="stat-label">{{ t('nerd.streaks.lengths') }}</h3>
        <div class="mt-2 grid grid-cols-2 gap-4">
          <div v-for="side in (['win', 'loss'] as const)" :key="side">
            <p class="mb-1 flex items-center gap-1.5 text-[11px] text-muted">
              <span class="size-2 rounded-full" :class="side === 'win' ? 'bg-(--nerd-win)' : 'bg-(--nerd-loss)'" />
              {{ t(side === 'win' ? 'nerd.streaks.winRuns' : 'nerd.streaks.lossRuns', { longest: side === 'win' ? sequence.streaks.longestWin : sequence.streaks.longestLoss }) }}
            </p>
            <div class="flex h-24 items-end gap-1.5">
              <div v-for="(count, k) in lengths[side]" :key="k" class="relative flex h-full flex-1 flex-col justify-end" :title="t('nerd.streaks.lengthTitle', { length: k + 1, count, expected: f.number((side === 'win' ? lengths.expectedWin : lengths.expectedLoss)[k]!, 1) })">
                <span class="nerd-column rounded-t-[3px]" :class="side === 'win' ? 'bg-(--nerd-win)' : 'bg-(--nerd-loss)'" :style="{ height: `${count / lengths.tallest * 100}%` }" />
                <span class="absolute inset-x-0 h-0.5 rounded-full bg-(--ui-text-highlighted)" :style="{ bottom: `${Math.min((side === 'win' ? lengths.expectedWin : lengths.expectedLoss)[k]! / lengths.tallest, 1) * 100}%` }" />
              </div>
            </div>
            <div class="mt-1 flex gap-1.5 text-center text-[10px] tabular-nums text-dimmed">
              <span v-for="k in 5" :key="k" class="flex-1">{{ k === 5 ? '5+' : k }}</span>
            </div>
          </div>
        </div>
        <p class="mt-2 flex items-center gap-1.5 text-[11px] text-dimmed"><span class="h-0.5 w-3 rounded-full bg-(--ui-text-highlighted)" />{{ t('nerd.streaks.expected') }}</p>
        <div class="mt-2">
          <NerdHowTo :text="t('nerd.streaks.lengthsHow')" />
        </div>
      </div>
    </div>
    <div class="px-4 pb-4">
      <NerdDetails :symbols="symbols" />
    </div>
  </section>
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
