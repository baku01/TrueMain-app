<script setup lang="ts">
import type { CorrelationMatrix } from '~/utils/nerd-stats/analysis'

/**
 * How the metrics move together: Spearman's rank correlation between every
 * pair, winning itself in the first row, on a diverging scale — the accent
 * for metrics that rise together, red for one rising as the other falls, the
 * neutral midpoint for none. Only the stronger cells carry their number; every
 * cell reads on hover and focus. Beside it, the metrics ranked by their
 * correlation with winning, and first, in a sentence, the ones that come most
 * with winning and with losing.
 */
const props = defineProps<{
  matrix: CorrelationMatrix
  games: number
}>()

const { t } = useT()
const f = useNerdFormat()
const tip = useChartTip()

const name = (key: string) => (key === 'win' ? t('nerd.win') : t(`nerd.short.${key}`))
const fill = (value: number | null) => {
  if (value === null) return 'transparent'
  const share = Math.round(Math.min(Math.abs(value), 1) ** 0.85 * 100)
  // Mixed in OKLab, not OKLCh: a polar mix from red to the blue-grey midpoint would sweep through purple.
  return `color-mix(in oklab, ${value >= 0 ? 'var(--nerd-win)' : 'var(--nerd-loss)'} ${share}%, var(--nerd-mid))`
}
const ink = (value: number | null) => (value !== null && Math.abs(value) >= 0.55 ? 'text-white' : 'text-highlighted')

const ranked = computed(() => props.matrix.keys.slice(1)
  .map((key, index) => ({ key, value: props.matrix.values[0]![index + 1] ?? null }))
  .filter((entry): entry is { key: typeof entry.key, value: number } => entry.value !== null)
  .sort((a, b) => Math.abs(b.value) - Math.abs(a.value)))

/** How strong a rank correlation is, in a word. */
const strength = (value: number) => {
  const size = Math.abs(value)
  return t(`nerd.heatmap.strength.${size >= 0.5 ? 'strong' : size >= 0.3 ? 'moderate' : size >= 0.1 ? 'weak' : 'none'}`)
}
const lead = computed(() => {
  const up = ranked.value.find(entry => entry.value > 0)
  const down = ranked.value.find(entry => entry.value < 0)
  if (!up || !down) return ''
  return t('nerd.heatmap.say', { up: t(`nerd.metric.${up.key}`), upStrength: strength(up.value), down: t(`nerd.metric.${down.key}`), downStrength: strength(down.value) })
})

function showCell(event: MouseEvent | FocusEvent, row: number, column: number) {
  const value = props.matrix.values[row]![column] ?? null
  tip.show(event, `${name(props.matrix.keys[row]!)} × ${name(props.matrix.keys[column]!)}`, [
    { label: 'ρ (Spearman)', value: value === null ? '—' : f.signed(value, 2), swatch: value === null ? undefined : value >= 0 ? 'var(--nerd-win)' : 'var(--nerd-loss)' },
  ])
}
</script>

<template>
  <section class="surface rounded-lg">
    <NerdCardHeader icon="i-tabler-grid-dots" :title="t('nerd.heatmap.title')" :technical="t('nerd.heatmap.technical')" :subtitle="t('nerd.heatmap.subtitle', { count: games })">
      <div class="flex items-center gap-2 text-[10px] tabular-nums text-dimmed">
        <span>{{ t('nerd.heatmap.legendDown') }}</span>
        <span class="h-2 w-40 rounded-full" style="background: linear-gradient(in oklab to right, var(--nerd-loss), var(--nerd-mid), var(--nerd-win))" />
        <span>{{ t('nerd.heatmap.legendUp') }}</span>
      </div>
    </NerdCardHeader>

    <div v-if="lead" class="px-4 pt-4">
      <NerdLead :text="lead" icon="i-tabler-arrows-join" />
    </div>

    <div class="grid gap-5 p-4 2xl:grid-cols-[minmax(0,1fr)_17rem]">
      <div :ref="el => (tip.box.value = el as HTMLElement)" class="relative min-w-0 overflow-x-auto">
        <div class="grid min-w-[44rem] max-w-[60rem] gap-[2px]" :style="{ gridTemplateColumns: `8.5rem repeat(${matrix.keys.length}, minmax(0, 1fr))` }">
          <span />
          <span v-for="key in matrix.keys" :key="key" class="flex h-16 items-end justify-center pb-1">
            <span class="origin-bottom-left translate-x-1/2 -rotate-45 whitespace-nowrap text-[10px] text-muted">{{ name(key) }}</span>
          </span>
          <template v-for="(rowKey, row) in matrix.keys" :key="rowKey">
            <span class="flex items-center justify-end truncate pr-2 text-[11px]" :class="row === 0 ? 'font-semibold text-highlighted' : 'text-muted'">{{ name(rowKey) }}</span>
            <button
              v-for="(value, column) in matrix.values[row]"
              :key="column"
              type="button"
              class="nerd-cell grid aspect-square cursor-default place-items-center rounded-[3px] text-[10px] font-medium tabular-nums transition-transform hover:scale-110 hover:ring-2 hover:ring-(--ui-text-highlighted)/40 focus-visible:outline-2 focus-visible:outline-primary"
              :class="[ink(value), row === column ? 'opacity-40' : '']"
              :style="{ background: row === column ? 'var(--ui-bg-accented)' : fill(value), animationDelay: `${(row + column) * 18}ms` }"
              :aria-label="`${name(rowKey)} × ${name(matrix.keys[column]!)}: ${value === null ? '—' : f.signed(value, 2)}`"
              @pointerenter="showCell($event, row, column)"
              @focus="showCell($event, row, column)"
              @pointerleave="tip.hide"
              @blur="tip.hide"
            >
              <span v-if="row !== column && value !== null && Math.abs(value) >= 0.3">{{ f.number(value, 2) }}</span>
            </button>
          </template>
        </div>
        <NerdTip :tip="tip.tip.value" />
        <div class="mt-3">
          <NerdHowTo :text="t('nerd.heatmap.how')" />
        </div>
      </div>

      <div class="min-w-0">
        <h3 class="stat-label mb-2">{{ t('nerd.heatmap.withWin') }}</h3>
        <ul class="space-y-1">
          <li v-for="entry in ranked" :key="entry.key" class="grid grid-cols-[minmax(0,1fr)_5rem_2.5rem] items-center gap-2 text-xs">
            <span class="truncate text-muted">{{ t(`nerd.metric.${entry.key}`) }}</span>
            <span class="relative h-2 rounded-full bg-accented/60">
              <span class="absolute inset-y-0 left-1/2 w-px bg-(--ui-border-accented)" />
              <span
                class="absolute inset-y-0"
                :class="entry.value >= 0 ? 'rounded-r-full' : 'rounded-l-full'"
                :style="{ left: entry.value >= 0 ? '50%' : `${50 - Math.abs(entry.value) * 50}%`, width: `${Math.abs(entry.value) * 50}%`, background: entry.value >= 0 ? 'var(--nerd-win)' : 'var(--nerd-loss)' }"
              />
            </span>
            <span class="text-right tabular-nums text-highlighted">{{ f.signed(entry.value, 2) }}</span>
          </li>
        </ul>
        <div class="mt-3">
          <NerdDetails :symbols="[{ symbol: 'ρ', meaning: t('nerd.sym.rho') }]">
            <p class="text-[11px] leading-relaxed text-dimmed">{{ t('nerd.heatmap.hint') }}</p>
          </NerdDetails>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.nerd-cell {
  animation: nerd-cell 420ms var(--tm-ease) backwards;
}

@keyframes nerd-cell {
  from { opacity: 0; transform: scale(0.6); }
}

@media (prefers-reduced-motion: reduce) {
  .nerd-cell {
    animation: none;
  }
}
</style>
