<script setup lang="ts">
import type { SequenceReport } from '~/utils/nerd-stats/analysis'
import { wilson } from '~/utils/nerd-stats/stats'

/**
 * Streaks and tilt: the Wald–Wolfowitz runs test drawn as the standard normal
 * with the observed z marked and the two tails that make its p-value shaded;
 * the win rate after a win, after a loss and after two of either, with Wilson
 * intervals and the two-proportion test between the first two; and how long
 * the runs of wins and of losses were, against what a sequence in random
 * order would give (a run of length k has probability (1 − p)·p^(k−1)).
 */
const props = defineProps<{
  sequence: SequenceReport
  rate: number
}>()

const { t } = useT()
const f = useNerdFormat()

const runs = computed(() => props.sequence.runs)
const verdict = computed(() => {
  const test = runs.value
  if (!test) return 'none'
  if (test.p >= 0.05) return 'random'
  return test.z < 0 ? 'streaky' : 'alternating'
})

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
    <header class="flex flex-wrap items-center gap-3 border-b border-default px-4 py-3.5">
      <span class="tm-emblem grid size-9 shrink-0 place-items-center rounded-lg text-primary">
        <UIcon name="i-tabler-flame" class="size-5" />
      </span>
      <div class="min-w-0 flex-1">
        <h2 class="text-base font-semibold text-highlighted">{{ t('nerd.streaks.title') }}</h2>
        <p class="text-xs text-muted">{{ t('nerd.streaks.subtitle', { count: sequence.results.length }) }}</p>
      </div>
    </header>

    <div class="grid gap-6 p-4 xl:grid-cols-3">
      <!-- The runs test. -->
      <div class="min-w-0">
        <h3 class="stat-label">{{ t('nerd.streaks.runs') }}</h3>
        <template v-if="runs">
          <p class="mt-1 text-sm text-highlighted">
            <span class="font-display text-2xl font-semibold">{{ runs.runs }}</span>
            <span class="ml-1.5 text-muted">{{ t('nerd.streaks.runsVs', { expected: f.number(runs.expected, 1), sd: f.number(runs.sd, 1) }) }}</span>
          </p>
          <div class="relative mt-2 h-28">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 size-full" role="img" :aria-label="t('nerd.streaks.zLabel', { z: f.signed(runs.z, 2), p: f.pValue(runs.p) })">
              <polygon v-for="(points, index) in tails" :key="index" :points="points" class="fill-(--nerd-loss)/25" />
              <polyline :points="curve" fill="none" class="stroke-(--ui-text-muted)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
              <line x1="0" x2="100" y1="92" y2="92" class="stroke-[var(--ui-border-accented)]" vector-effect="non-scaling-stroke" />
              <line :x1="zx(runs.z)" :x2="zx(runs.z)" y1="4" y2="92" class="stroke-(--ui-text-highlighted)" stroke-width="2" vector-effect="non-scaling-stroke" />
            </svg>
            <span class="absolute top-0 -translate-x-1/2 rounded bg-default px-1 text-[10px] font-semibold tabular-nums text-highlighted ring-1 ring-default" :style="{ left: `${zx(runs.z)}%` }">z = {{ f.signed(runs.z, 2) }}</span>
          </div>
          <div class="flex justify-between text-[10px] tabular-nums text-dimmed"><span>−4</span><span>0</span><span>+4</span></div>
          <p class="mt-2 text-xs text-muted">
            <b class="font-semibold text-highlighted">p = {{ f.pValue(runs.p) }}</b> · {{ t(`nerd.streaks.verdict.${verdict}`) }}
          </p>
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
              <span class="absolute inset-y-0 left-1/2 w-px bg-(--ui-border-accented)" />
              <span v-if="entry.games" class="absolute inset-y-0 rounded-full bg-primary/30" :style="{ left: `${entry.low * 100}%`, width: `${(entry.high - entry.low) * 100}%` }" />
              <span v-if="entry.games" class="absolute top-1/2 size-2.5 -translate-1/2 rounded-full bg-primary ring-2 ring-(--tm-pane)" :style="{ left: `${entry.rate * 100}%` }" />
            </div>
          </li>
        </ul>
        <p v-if="sequence.momentum" class="mt-3 text-xs text-muted">
          {{ t('nerd.streaks.momentumTest', { diff: f.signed(sequence.momentum.difference * 100, 1), z: f.signed(sequence.momentum.z, 2), p: f.pValue(sequence.momentum.p) }) }}
        </p>
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
      </div>
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
