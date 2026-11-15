<script setup lang="ts">
import type { CellRate, SequenceReport } from '~/utils/nerd-stats/analysis'
import { getActiveLocale } from '#common/utils/i18n'

/**
 * When the player wins: a strip of the day's 24 hours and one of the week's
 * seven days, each cell's win rate shrunk toward the player's own (an hour
 * played twice says little) and coloured on a diverging scale around it —
 * the accent above, red below, the neutral midpoint at par; the raw rate and
 * the count in the cell. Beside them, the win rate by the game's place in its
 * sitting, with Wilson intervals: whether the third game in a row is the one
 * to stop at.
 */
const props = defineProps<{
  hours: CellRate[]
  weekdays: CellRate[]
  /** The player's overall win rate: each cell's par. */
  rate: number
  sessions: SequenceReport['sessions']
}>()

const { t } = useT()
const f = useNerdFormat()
const tip = useChartTip()

/** ±this far from par is the scale's full colour. */
const FULL = 0.15
const fill = (cell: CellRate) => {
  if (!cell.shrunk) return 'var(--tm-pane-2)'
  const diff = cell.shrunk.rate - props.rate
  const share = Math.round(Math.min(Math.abs(diff) / FULL, 1) * 100)
  return `color-mix(in oklab, ${diff >= 0 ? 'var(--nerd-win)' : 'var(--nerd-loss)'} ${share}%, var(--nerd-mid))`
}

const dayNames = computed(() => {
  const format = new Intl.DateTimeFormat(getActiveLocale(), { weekday: 'short' })
  // 2026-11-15 was a Sunday: getDay() 0.
  return Array.from({ length: 7 }, (_, day) => format.format(new Date(2026, 10, 15 + day)).replace('.', ''))
})

function showCell(event: MouseEvent | FocusEvent, title: string, cell: CellRate) {
  tip.show(event, title, cell.games
    ? [
        { label: t('nerd.clock.raw'), value: `${f.percent(cell.rate, 0)} (${cell.wins}/${cell.games})` },
        { label: t('nerd.clock.shrunk'), value: f.percent(cell.shrunk!.rate, 1), swatch: cell.shrunk!.rate >= props.rate ? 'var(--nerd-win)' : 'var(--nerd-loss)' },
        { label: t('nerd.col.credible'), value: `${f.percent(cell.shrunk!.low, 0)} – ${f.percent(cell.shrunk!.high, 0)}` },
      ]
    : [{ label: '', value: t('nerd.clock.none') }])
}

const sessionMax = computed(() => Math.max(...props.sessions.map(entry => entry.games), 1))
</script>

<template>
  <section class="surface rounded-lg">
    <header class="flex flex-wrap items-center gap-3 border-b border-default px-4 py-3.5">
      <span class="tm-emblem grid size-9 shrink-0 place-items-center rounded-lg text-primary">
        <UIcon name="i-tabler-calendar-time" class="size-5" />
      </span>
      <div class="min-w-0 flex-1">
        <h2 class="text-base font-semibold text-highlighted">{{ t('nerd.clock.title') }}</h2>
        <p class="text-xs text-muted">{{ t('nerd.clock.subtitle', { rate: f.percent(rate, 1) }) }}</p>
      </div>
      <div class="flex items-center gap-2 text-[10px] tabular-nums text-dimmed">
        <span>{{ f.signed(-FULL * 100, 0) }} pp</span>
        <span class="h-2 w-32 rounded-full" style="background: linear-gradient(in oklab to right, var(--nerd-loss), var(--nerd-mid), var(--nerd-win))" />
        <span>{{ f.signed(FULL * 100, 0) }} pp</span>
      </div>
    </header>

    <div :ref="el => (tip.box.value = el as HTMLElement)" class="relative grid gap-6 p-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div class="min-w-0 space-y-5">
        <div>
          <h3 class="stat-label mb-2">{{ t('nerd.clock.hours') }}</h3>
          <div class="grid grid-cols-12 gap-[2px] md:grid-cols-24">
            <button
              v-for="cell in hours"
              :key="cell.key"
              type="button"
              class="nerd-cell flex h-14 cursor-default flex-col items-center justify-center rounded-[4px] text-[10px] tabular-nums transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-primary"
              :style="{ background: fill(cell), animationDelay: `${cell.key * 20}ms` }"
              :aria-label="`${cell.key}h: ${cell.games ? f.percent(cell.rate, 0) : '—'}`"
              @pointerenter="showCell($event, `${cell.key}:00 – ${cell.key}:59`, cell)"
              @focus="showCell($event, `${cell.key}:00 – ${cell.key}:59`, cell)"
              @pointerleave="tip.hide"
              @blur="tip.hide"
            >
              <span class="font-semibold text-highlighted">{{ cell.games ? f.percent(cell.rate, 0) : '·' }}</span>
              <span class="text-dimmed">{{ cell.games || '' }}</span>
            </button>
          </div>
          <div class="mt-1 grid grid-cols-12 gap-[2px] text-center text-[10px] tabular-nums text-dimmed md:grid-cols-24">
            <span v-for="cell in hours" :key="cell.key">{{ cell.key }}h</span>
          </div>
        </div>

        <div>
          <h3 class="stat-label mb-2">{{ t('nerd.clock.weekdays') }}</h3>
          <div class="grid grid-cols-7 gap-[2px]">
            <button
              v-for="cell in weekdays"
              :key="cell.key"
              type="button"
              class="nerd-cell flex h-16 cursor-default flex-col items-center justify-center rounded-[4px] tabular-nums transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-primary"
              :style="{ background: fill(cell), animationDelay: `${cell.key * 40}ms` }"
              :aria-label="`${dayNames[cell.key]}: ${cell.games ? f.percent(cell.rate, 0) : '—'}`"
              @pointerenter="showCell($event, dayNames[cell.key]!, cell)"
              @focus="showCell($event, dayNames[cell.key]!, cell)"
              @pointerleave="tip.hide"
              @blur="tip.hide"
            >
              <span class="text-[11px] capitalize text-muted">{{ dayNames[cell.key] }}</span>
              <span class="text-sm font-semibold text-highlighted">{{ cell.games ? f.percent(cell.rate, 0) : '—' }}</span>
              <span class="text-[10px] text-dimmed">{{ t('nerd.distributions.games', { count: cell.games }) }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="min-w-0">
        <h3 class="stat-label mb-2">{{ t('nerd.clock.sessions') }}</h3>
        <div class="relative grid h-48 grid-cols-4 items-end gap-3 border-b border-(--ui-border-accented) pt-5">
          <span class="pointer-events-none absolute inset-x-0 h-px bg-(--ui-border-accented)" style="bottom: 50%" />
          <div v-for="entry in sessions" :key="entry.position" class="relative h-full">
            <template v-if="entry.games">
              <span class="nerd-column absolute inset-x-[22%] bottom-0 rounded-t-[4px] bg-primary/75" :style="{ height: `${entry.rate * 100}%`, animationDelay: `${entry.position * 70}ms` }" />
              <span class="absolute left-1/2 w-px -translate-x-1/2 bg-(--ui-text-muted)" :style="{ bottom: `${entry.low * 100}%`, height: `${(entry.high - entry.low) * 100}%` }" />
              <span class="absolute left-1/2 -translate-x-1/2 text-xs font-semibold tabular-nums text-highlighted" :style="{ bottom: `calc(${entry.high * 100}% + 2px)` }">{{ f.percent(entry.rate, 0) }}</span>
            </template>
          </div>
        </div>
        <div class="mt-1.5 grid grid-cols-4 gap-3 text-center text-[11px]">
          <span v-for="entry in sessions" :key="entry.position">
            <span class="block text-muted">{{ t(entry.position === 4 ? 'nerd.clock.sessionLater' : 'nerd.clock.sessionNth', { n: entry.position }) }}</span>
            <span class="block tabular-nums text-dimmed">{{ t('nerd.distributions.games', { count: entry.games }) }}</span>
            <span class="mx-auto mt-1 block h-1 rounded-full bg-accented" :style="{ width: `${entry.games / sessionMax * 100}%` }" />
          </span>
        </div>
        <p class="mt-3 text-[11px] leading-relaxed text-dimmed">{{ t('nerd.clock.sessionHint') }}</p>
      </div>
      <NerdTip :tip="tip.tip.value" />
    </div>
  </section>
</template>

<style scoped>
.nerd-cell {
  animation: nerd-cell 420ms var(--tm-ease) backwards;
}

.nerd-column {
  transform-origin: bottom;
  animation: nerd-column 520ms var(--tm-ease) backwards;
}

@keyframes nerd-cell {
  from { opacity: 0; transform: translateY(6px); }
}

@keyframes nerd-column {
  from { transform: scaleY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .nerd-cell, .nerd-column {
    animation: none;
  }
}
</style>
