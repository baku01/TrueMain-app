<script setup lang="ts">
import type { DetailedStats, StatLine } from '~/utils/player-stats'
import type { FormBenchmarkResponse } from '~/utils/form-benchmark'
import DashboardEloLadder from '~/components/dashboard/DashboardEloLadder.vue'

/**
 * The player's play in detail over their latest games in the queue shown
 * (`useProfileInsights`), set against their lane opponents in those same
 * games — same elo, same role: each figure with a bar that leans right in
 * the accent where the player does better and left in red where they do
 * worse, the gap in percent, and the opponents' figure under it. Each group
 * (combat, laning, vision, objectives, survival) sums its lines into one
 * verdict. Hovering a line shows it in the wins and in the losses.
 */
const props = defineProps<{
  stats: DetailedStats | null
  loading: boolean
  /** The tiers' medians on the player's main role, for the elo ladder; null leaves it out. */
  benchmark?: FormBenchmarkResponse | null
  tier?: string | null
}>()

const { t } = useT()
const open = ref(true)

const format = (value: number | null, line: StatLine) => {
  if (value === null) return '—'
  switch (line.unit) {
    case 'share': return `${Math.round(value * 1000) / 10}%`
    case 'number': return value.toFixed(2)
    default: return value >= 100 ? Math.round(value).toLocaleString() : value.toFixed(1)
  }
}

/** Under 5% either way is even: within what twenty games can tell apart. */
const EVEN = 0.05
const tone = (edge: number | null) => (edge === null || Math.abs(edge) < EVEN ? 'even' : edge > 0 ? 'good' : 'bad')
const percent = (edge: number | null) => (edge === null ? '' : `${edge > 0 ? '+' : ''}${Math.round(edge * 100)}%`)
/** Half the bar is ±60%: a gap past it fills the side. */
const width = (edge: number | null) => `${Math.min(50, (Math.abs(edge ?? 0) / 0.6) * 50)}%`

const verdict = (edge: number | null) => {
  const kind = tone(edge)
  if (kind === 'even') return t('dash.stats.verdict.even')
  return t(kind === 'good' ? 'dash.stats.verdict.better' : 'dash.stats.verdict.worse', { gap: Math.abs(Math.round((edge ?? 0) * 100)) })
}

const overall = computed(() => {
  const edges = props.stats?.groups.map(group => group.edge).filter((edge): edge is number => edge !== null) ?? []
  return edges.length ? edges.reduce((sum, edge) => sum + edge, 0) / edges.length : null
})

const multi = computed(() => props.stats
  ? (['double', 'triple', 'quadra', 'penta'] as const).map(key => ({ key, count: props.stats!.multiKills[key] })).filter(entry => entry.count > 0)
  : [])

const TONE_TEXT = { good: 'text-primary', bad: 'text-error', even: 'text-muted' } as const
const TONE_BAR = { good: 'bg-primary', bad: 'bg-error', even: 'bg-(--ui-text-dimmed)' } as const
</script>

<template>
  <section class="surface rounded-2xl">
    <button type="button" class="flex w-full items-center gap-2 px-4 py-3 text-left" :aria-expanded="open" @click="open = !open">
      <UIcon name="i-ph-chart-bar-light" class="size-4 text-primary" />
      <h2 class="text-sm font-semibold text-highlighted">{{ t('dash.stats.title') }}</h2>
      <span v-if="stats" class="text-xs text-muted">{{ t('dash.stats.sample', { games: stats.games, wins: stats.wins, losses: stats.games - stats.wins }) }}</span>
      <span v-if="overall !== null" class="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" :class="[TONE_TEXT[tone(overall)], tone(overall) === 'good' ? 'bg-primary/10' : tone(overall) === 'bad' ? 'bg-error/10' : 'bg-accented/60']">
        {{ verdict(overall) }}
      </span>
      <span class="ml-auto text-[10px] text-dimmed">{{ t('dash.stats.source') }}</span>
      <UIcon name="i-lucide-chevron-down" class="size-4 text-dimmed transition-transform" :class="open && 'rotate-180'" />
    </button>

    <div v-if="open" class="border-t border-default px-4 pb-4 pt-3">
      <div v-if="loading && !stats" class="grid gap-3 lg:grid-cols-2" aria-busy="true">
        <USkeleton v-for="i in 4" :key="i" class="h-40 rounded-xl" />
      </div>
      <p v-else-if="!stats" class="py-4 text-center text-sm text-muted">{{ t('dash.stats.none') }}</p>
      <template v-else>
        <DashboardEloLadder :stats="stats" :benchmark="benchmark ?? null" :tier="tier ?? null" class="mb-3" />
        <p class="mb-3 flex items-center gap-1.5 text-[11px] text-muted">
          <UIcon name="i-lucide-swords" class="size-3.5 text-dimmed" />{{ t('dash.stats.against') }}
        </p>
        <div class="grid gap-3 lg:grid-cols-2">
          <div v-for="group in stats.groups" :key="group.key" class="rounded-xl bg-elevated/50 p-3 ring-1 ring-default">
            <header class="mb-2.5 flex items-center gap-2">
              <h3 class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">{{ t(`dash.stats.group.${group.key}`) }}</h3>
              <span class="ml-auto text-[11px] font-semibold" :class="TONE_TEXT[tone(group.edge)]">{{ verdict(group.edge) }}</span>
            </header>
            <ul class="space-y-2">
              <li
                v-for="line in group.lines"
                :key="line.key"
                class="grid grid-cols-[minmax(0,8.5rem)_3.75rem_minmax(0,1fr)_2.75rem] items-center gap-x-2.5 text-xs"
                :title="t('dash.stats.winLoss', { wins: format(line.wins, line), losses: format(line.losses, line) })"
              >
                <span class="truncate text-muted">{{ t(`dash.stats.line.${line.key}`) }}</span>
                <span class="text-right font-semibold tabular-nums text-highlighted">{{ format(line.all, line) }}</span>
                <!-- The opponents' figure is the centre line; the bar runs right where the player is better, left where worse. -->
                <span class="relative h-1.5 rounded-full bg-accented/70">
                  <span class="absolute inset-y-[-3px] left-1/2 w-px bg-(--ui-text-dimmed)" aria-hidden="true" />
                  <span
                    v-if="line.edge !== null"
                    class="absolute inset-y-0 rounded-full"
                    :class="TONE_BAR[tone(line.edge)]"
                    :style="line.edge >= 0 ? { left: '50%', width: width(line.edge) } : { right: '50%', width: width(line.edge) }"
                  />
                </span>
                <span class="text-right">
                  <span class="block text-[11px] font-semibold tabular-nums leading-tight" :class="TONE_TEXT[tone(line.edge)]">{{ percent(line.edge) || '—' }}</span>
                  <span class="block text-[9px] tabular-nums leading-tight text-dimmed">{{ format(line.opponents, line) }}</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="text-[10px] text-dimmed">{{ t('dash.stats.legend') }}</span>
          <span class="ml-auto" />
          <UBadge v-for="entry in multi" :key="entry.key" :label="`${t(`dash.stats.multi.${entry.key}`)} × ${entry.count}`" color="neutral" variant="subtle" size="sm" />
        </div>
      </template>
    </div>
  </section>
</template>
