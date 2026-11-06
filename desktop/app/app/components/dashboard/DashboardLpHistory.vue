<script setup lang="ts">
import type { ApexCutoff } from '#shared/types/apex-cutoffs'
import type { RankedQueueType } from '~/utils/league-history'
import type { LeagueHistory } from '~/utils/sources/rank-history'
import { rankChartDateLabel, rankChartPoints } from '#common/utils/rank-chart'
import { formatRank } from '#common/utils/tiers'
import { formatSigned } from '#shared/utils/deltas'
import { seasonStarts } from '~/utils/league-history'

/**
 * The profile's LP history tab, Blitz's: the queue's whole curve as its
 * source keeps it — every snapshot a dot, each season's start marked across
 * the plot — under the standing now, and the peak, the low and the LP moved
 * this season (since the latest start in view; the whole span without one),
 * with the source named beside the title.
 */
const props = defineProps<{
  history: LeagueHistory | null
  loading: boolean
  cutoffs: readonly ApexCutoff[]
}>()
const queue = defineModel<RankedQueueType>('queue', { required: true })
const { t } = useT()

const queues = computed(() => [
  { value: 'RANKED_SOLO_5x5' as const, label: t('dash.ranked.solo') },
  { value: 'RANKED_FLEX_SR' as const, label: t('dash.ranked.flex') },
])
const queueName = computed(() => queues.value.find(option => option.value === queue.value)!.label)

const entries = computed(() => props.history?.entries ?? [])
const points = computed(() => rankChartPoints(entries.value))
const starts = computed(() => seasonStarts(entries.value))
const markers = computed(() => starts.value.map(start => ({ index: start.index, label: t('dash.lpHistory.seasonStart', { year: start.year }) })))

const tiles = computed(() => {
  // A season ago's standing is no yardstick for this one's.
  const all = points.value.slice(starts.value.at(-1)?.index ?? 0)
  const now = all.at(-1)
  if (!now) return []
  const peak = all.reduce((best, point) => (point.score > best.score ? point : best))
  const low = all.reduce((worst, point) => (point.score < worst.score ? point : worst))
  const rank = (point: typeof now) => ({ text: formatRank(point.entry.tier, point.entry.division, { lp: point.entry.leaguePoints }), tier: point.entry.tier, tone: 'text-highlighted' })
  const net = now.score - all[0]!.score
  return [
    { key: 'now', label: t('dash.lpHistory.now'), ...rank(now), hint: rankChartDateLabel(now.entry.capturedAtUtc) },
    { key: 'peak', label: t('dash.lpHistory.peak'), ...rank(peak), hint: rankChartDateLabel(peak.entry.capturedAtUtc) },
    { key: 'low', label: t('dash.lpHistory.lowest'), ...rank(low), hint: rankChartDateLabel(low.entry.capturedAtUtc) },
    { key: 'net', label: t('dash.lpHistory.net'), text: `${formatSigned(net)} LP`, tier: null, tone: net >= 0 ? 'text-data-good' : 'text-data-bad', hint: rankChartDateLabel(all[0]!.entry.capturedAtUtc) },
  ]
})
</script>

<template>
  <section class="surface flex flex-col gap-4 rounded-lg p-4" data-testid="lp-history">
    <header class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h2 class="text-base font-semibold text-highlighted">{{ t('dash.lpHistory.title', { queue: queueName }) }}</h2>
          <DashboardSourceBadge v-if="history" :source="history.source" />
        </div>
        <p v-if="entries.length" class="text-xs text-muted">
          {{ t('dash.lpHistory.span', { count: entries.length, date: rankChartDateLabel(entries[0]!.capturedAtUtc) }) }}
        </p>
      </div>
      <AppSegmented v-model="queue" :items="queues" class="ml-auto" />
    </header>

    <template v-if="loading">
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <USkeleton v-for="index in 4" :key="index" class="h-[60px] rounded-lg" />
      </div>
      <USkeleton class="h-[360px] w-full rounded-md" />
    </template>

    <template v-else-if="points.length">
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div v-for="tile in tiles" :key="tile.key" class="rounded-lg bg-elevated/50 px-3 py-2 ring-1 ring-default">
          <p class="stat-label">{{ tile.label }}</p>
          <p class="flex items-center gap-1.5 text-sm font-semibold tabular-nums" :class="tile.tone">
            <RankIcon v-if="tile.tier" :tier="tile.tier" :size="20" />
            <span class="truncate">{{ tile.text }}</span>
          </p>
          <p class="text-[10px] tabular-nums text-dimmed">{{ tile.hint }}</p>
        </div>
      </div>
      <ProfileRankChart :points="points" :cutoffs="queue === 'RANKED_SOLO_5x5' ? cutoffs : []" :height="360" :tick-count="7" dots :markers="markers" />
    </template>

    <EmptyState v-else icon="i-lucide-chart-line" :title="t('dash.lpHistory.empty', { queue: queueName })" :description="t('dash.lpHistory.emptyHint')" class="py-12" />
  </section>
</template>
