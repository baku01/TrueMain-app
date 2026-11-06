<script setup lang="ts">
import type { PostMatchBenchmark, PostMatchInsights, PostMatchMetric } from '~/utils/post-match'
import { getActiveLocale } from '#common/utils/i18n'
import { formatTierName } from '#common/utils/tiers'
import { LANE_END_MINUTE } from '~/utils/post-match'

/**
 * How the game went, as Blitz's post-match sums it up: the farm and the
 * vision per minute against a yardstick — the player's tier on the lane, or
 * their own recent games when no source answers for it — and the deaths, how
 * many and when, on a strip of the game with the laning phase marked. The
 * badge names where the yardstick came from (`readPostMatchBenchmark`).
 */
const props = defineProps<{
  insights: PostMatchInsights
  benchmark: PostMatchBenchmark | null
  pending: boolean
  durationSeconds: number
}>()

const { t } = useT()

const decimal = (value: number, digits = 1) => new Intl.NumberFormat(getActiveLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)

/** Which yardstick, in the badge's words. */
const badge = computed(() => {
  const benchmark = props.benchmark
  if (props.pending) return t('postMatch.badge.reading')
  if (!benchmark) return t('postMatch.badge.none')
  if (benchmark.origin === 'own') return t('postMatch.badge.own', { games: benchmark.samples ?? 0 })
  const source = benchmark.origin === 'truemain' ? 'TrueMain' : 'Blitz'
  return benchmark.tier ? t('postMatch.badge.tier', { source, tier: formatTierName(benchmark.tier) }) : source
})
/** What the reference figure is called under each tile. */
const referenceLabel = computed(() => (props.benchmark?.origin === 'own' ? t('postMatch.reference.own') : t('postMatch.reference.tier')))

const VERDICT_TEXT = { better: 'text-data-good', even: 'text-muted', worse: 'text-data-bad' } as const

const tiles = computed(() => [
  { key: 'cs', label: t('postMatch.cs'), metric: props.insights.csPerMinute, digits: 1 },
  { key: 'vision', label: t('postMatch.vision'), metric: props.insights.visionPerMinute, digits: 2 },
] satisfies { key: string, label: string, metric: PostMatchMetric, digits: number }[])

const minutes = computed(() => Math.max(props.durationSeconds / 60, 1))
const at = (minute: number) => `${Math.min(100, (minute / minutes.value) * 100)}%`
const clock = (minute: number) => `${Math.floor(minute)}:${String(Math.floor((minute % 1) * 60)).padStart(2, '0')}`
const deaths = computed(() => props.insights.deaths)
const lateDeaths = computed(() => (props.insights.laneDeaths === null ? null : deaths.value.value - props.insights.laneDeaths))
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <h3 class="stat-label">{{ t('postMatch.title') }}</h3>
      <UBadge color="neutral" variant="soft" size="sm" :icon="pending ? 'i-lucide-loader-circle' : 'i-lucide-ruler'" :label="badge" />
    </div>

    <div class="grid gap-3 sm:grid-cols-3">
      <div v-for="tile in tiles" :key="tile.key" class="rounded-lg bg-elevated/60 p-3 ring-1 ring-inset ring-default">
        <p class="stat-label">{{ tile.label }}</p>
        <p class="stat-value mt-1 text-2xl leading-none tabular-nums text-highlighted">{{ decimal(tile.metric.value, tile.digits) }}</p>
        <p v-if="tile.metric.reference !== null" class="mt-1.5 text-xs text-muted">
          {{ referenceLabel }} <span class="tabular-nums">{{ decimal(tile.metric.reference, tile.digits) }}</span>
          <span class="ml-1 font-semibold tabular-nums" :class="VERDICT_TEXT[tile.metric.verdict ?? 'even']">
            {{ tile.metric.value >= tile.metric.reference ? '+' : '−' }}{{ decimal(Math.abs(tile.metric.value - tile.metric.reference), tile.digits) }}
          </span>
        </p>
        <p v-else class="mt-1.5 text-xs text-dimmed">{{ t('postMatch.reference.missing') }}</p>
      </div>

      <div class="rounded-lg bg-elevated/60 p-3 ring-1 ring-inset ring-default">
        <p class="stat-label">{{ t('postMatch.deaths') }}</p>
        <p class="mt-1 flex items-baseline gap-2">
          <span class="stat-value text-2xl leading-none tabular-nums text-highlighted">{{ deaths.value }}</span>
          <span v-if="deaths.reference !== null" class="text-xs text-muted">
            {{ referenceLabel }} <span class="tabular-nums" :class="VERDICT_TEXT[deaths.verdict ?? 'even']">{{ decimal(deaths.reference) }}</span>
          </span>
        </p>
        <!-- The game as a strip, the laning phase shaded, a mark at each death. -->
        <div v-if="insights.deathTimes" class="mt-2.5">
          <div class="relative h-1.5 rounded-full bg-accented/60">
            <span class="absolute inset-y-0 left-0 rounded-l-full bg-primary/25" :style="{ width: at(LANE_END_MINUTE) }" />
            <UTooltip v-for="(minute, index) in insights.deathTimes" :key="index" :text="clock(minute)">
              <span class="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-data-bad ring-2 ring-default" :style="{ left: at(minute) }" />
            </UTooltip>
          </div>
          <p class="mt-1.5 text-xs text-muted">
            <template v-if="deaths.value === 0">{{ t('postMatch.deathless') }}</template>
            <template v-else>{{ t('postMatch.deathSplit', { lane: insights.laneDeaths ?? 0, late: lateDeaths ?? 0, minute: LANE_END_MINUTE }) }}</template>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
