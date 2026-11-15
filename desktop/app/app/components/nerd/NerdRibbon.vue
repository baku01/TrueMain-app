<script setup lang="ts">
import type { GameRow } from '~/utils/nerd-stats/features'

/**
 * Every game in order, oldest to newest, a bar each — up for a win, down for
 * a loss — under the win rate over the last ten, with a coin flip and the
 * player's own average ruled across it.
 */
const props = defineProps<{
  rows: GameRow[]
  /** The player's win rate over these games. */
  rate: number
}>()

const { t } = useT()
const f = useNerdFormat()
const champions = useStaticChampionsById()
const tip = useChartTip()

/** The rolling win rate over the last ten games (0..100 on both axes). */
const WINDOW = 10
const rolling = computed(() => {
  const results = props.rows.map(row => row.win)
  if (results.length < WINDOW) return ''
  const points: string[] = []
  for (let i = WINDOW - 1; i < results.length; i++) {
    const rate = results.slice(i - WINDOW + 1, i + 1).filter(Boolean).length / WINDOW
    points.push(`${((i + 0.5) / results.length) * 100},${100 - rate * 100}`)
  }
  return points.join(' ')
})

function showGame(event: MouseEvent | FocusEvent, row: GameRow) {
  const name = champions.value.get(row.game.championId)?.name ?? '—'
  tip.show(event, new Date(row.game.playedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }), [
    { label: name, value: row.win ? t('nerd.win') : t('nerd.loss'), swatch: row.win ? 'var(--nerd-win)' : 'var(--nerd-loss)' },
    { label: t('nerd.hero.kda'), value: `${row.game.kills}/${row.game.deaths}/${row.game.assists}` },
    { label: t('nerd.metric.duration'), value: f.minutes(row.game.durationSeconds / 60) },
  ])
}
</script>

<template>
  <div :ref="el => (tip.box.value = el as HTMLElement)" class="relative border-t border-default px-5 pb-3 pt-3">
    <div class="mb-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-dimmed">
      <span>{{ t('nerd.hero.ribbon', { count: rows.length }) }}</span>
      <span class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span class="flex items-center gap-1.5"><span class="h-0.5 w-3 rounded-full bg-(--ui-text-highlighted)" />{{ t('nerd.hero.rolling', { count: WINDOW }) }}</span>
        <span class="flex items-center gap-1.5"><span class="nerd-dash w-3" />{{ t('nerd.ref.average', { rate: f.percent(rate) }) }}</span>
        <span class="flex items-center gap-1.5"><span class="h-px w-3 bg-(--ui-border-accented)" />{{ t('nerd.ref.coin') }}</span>
      </span>
    </div>
    <div class="relative h-14">
      <svg v-if="rolling" viewBox="0 0 100 100" preserveAspectRatio="none" class="pointer-events-none absolute inset-0 z-10 size-full overflow-visible" aria-hidden="true">
        <line x1="0" x2="100" y1="50" y2="50" class="stroke-[var(--ui-border-accented)]" vector-effect="non-scaling-stroke" />
        <line x1="0" x2="100" :y1="100 - rate * 100" :y2="100 - rate * 100" class="stroke-[var(--ui-text-muted)]" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
        <polyline :points="rolling" fill="none" class="nerd-draw stroke-[var(--ui-text-highlighted)]" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" pathLength="1" />
      </svg>
      <div class="flex h-full items-stretch gap-[2px]">
        <button
          v-for="(row, index) in rows"
          :key="row.game.gameId"
          type="button"
          class="nerd-tick relative flex-1 rounded-[2px] focus-visible:outline-2 focus-visible:outline-primary"
          :style="{ animationDelay: `${Math.min(index * 4, 600)}ms` }"
          :aria-label="`${row.win ? t('nerd.win') : t('nerd.loss')} · ${champions.get(row.game.championId)?.name ?? ''}`"
          @pointerenter="showGame($event, row)"
          @focus="showGame($event, row)"
          @pointerleave="tip.hide"
          @blur="tip.hide"
        >
          <span class="absolute inset-x-0 rounded-[2px]" :class="row.win ? 'top-0 bottom-1/2 bg-(--nerd-win)' : 'top-1/2 bottom-0 bg-(--nerd-loss)'" />
        </button>
      </div>
    </div>
    <div class="mt-2">
      <NerdHowTo :text="t('nerd.hero.ribbonHow', { count: WINDOW })" />
    </div>
    <NerdTip :tip="tip.tip.value" />
  </div>
</template>

<style scoped>
.nerd-tick {
  animation: nerd-tick 360ms var(--tm-ease) backwards;
}

.nerd-draw {
  stroke-dasharray: 1;
  animation: nerd-draw 1100ms var(--tm-ease) backwards 200ms;
}

@keyframes nerd-tick {
  from { opacity: 0; transform: scaleY(0.2); }
}

@keyframes nerd-draw {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .nerd-tick, .nerd-draw {
    animation: none;
  }
}
</style>
