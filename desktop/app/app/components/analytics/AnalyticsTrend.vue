<script setup lang="ts">
import type { TrendSeries } from '~/utils/sources/analytics'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * The trend: four small charts — win, pick and ban rate, games — a line per
 * elo bracket the source charts, the overall one in the accent. With a single
 * point (a source that keeps one patch) the value stands alone.
 */
const props = defineProps<{ trend: { winRate: TrendSeries[], pickRate: TrendSeries[], banRate: TrendSeries[], games: TrendSeries[] } }>()
const { t } = useT()
/** The days shown, the source's whole window down to today alone. */
const RANGES = ['max', '14', '7', '1'] as const
const range = ref<typeof RANGES[number]>('max')
const sliced = (series: TrendSeries[]) => (range.value === 'max' ? series : series.map(line => ({ ...line, points: line.points.slice(-Number(range.value)) })))
const daily = computed(() => props.trend.winRate.some(line => line.points.length > 2))

const COLORS: Record<string, string> = {
  all: 'var(--ui-primary)', diamond_plus: '#8ea6ff', emerald: '#34d399', platinum: '#5eead4', gold: '#e2b95c', silver: '#b9c2cd', bronze: '#b3763f', iron: '#837a7c',
}
const W = 300
const H = 120

const charts = computed(() => (['winRate', 'pickRate', 'banRate', 'games'] as const).map((key) => {
  const series = sliced(props.trend[key]).filter(line => line.points.length)
  const values = series.flatMap(line => line.points.map(point => point.value))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const path = (line: TrendSeries) => line.points.map((point, index) => {
    const x = line.points.length === 1 ? W / 2 : (index / (line.points.length - 1)) * W
    const y = H - 8 - ((point.value - min) / span) * (H - 16)
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const format = (value: number) => (key === 'games' ? Math.round(value).toLocaleString() : formatPercentage(value, 2))
  return { key, series, path, min: format(min), max: format(max), last: series[0]?.points.at(-1) ? format(series[0].points.at(-1)!.value) : '—', single: series.every(line => line.points.length < 2) }
}).filter(chart => chart.series.length))
const brackets = computed(() => [...new Set(props.trend.winRate.map(line => line.label))])
</script>

<template>
  <div class="space-y-3">
    <div v-if="daily" class="flex flex-wrap gap-1.5">
      <UButton v-for="option in RANGES" :key="option" :label="t(`analytics.trend.range.${option}`)" size="xs" :color="range === option ? 'primary' : 'neutral'" :variant="range === option ? 'soft' : 'ghost'" @click="range = option" />
    </div>
    <div v-if="brackets.length > 1" class="flex flex-wrap gap-3 text-[11px] text-muted">
      <span v-for="bracket in brackets" :key="bracket" class="flex items-center gap-1.5"><span class="h-0.5 w-3 rounded" :style="{ background: COLORS[bracket] ?? 'var(--ui-text-dimmed)' }" />{{ t(`analytics.trend.bracket.${bracket}`) }}</span>
    </div>
    <div class="grid gap-3 @3xl:grid-cols-2 @6xl:grid-cols-4">
      <div v-for="chart in charts" :key="chart.key" class="rounded-xl bg-accented/15 p-3">
        <p class="stat-label">{{ t(`analytics.trend.${chart.key}`) }}</p>
        <p class="text-lg font-semibold tabular-nums text-highlighted">{{ chart.last }}</p>
        <svg v-if="!chart.single" :viewBox="`0 0 ${W} ${H}`" class="mt-1 h-28 w-full" preserveAspectRatio="none" role="img" :aria-label="t(`analytics.trend.${chart.key}`)">
          <path v-for="line in [...chart.series].reverse()" :key="line.label" :d="chart.path(line)" fill="none" :stroke="COLORS[line.label] ?? 'var(--ui-text-dimmed)'" :stroke-width="line.label === 'all' ? 2.5 : 1.25" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
        </svg>
        <div v-if="!chart.single" class="flex justify-between text-[10px] tabular-nums text-dimmed"><span>{{ chart.min }}</span><span>{{ chart.max }}</span></div>
      </div>
    </div>
  </div>
</template>
