<script setup lang="ts">
import type { FormBenchmarkResponse, Quartiles } from '~/utils/form-benchmark'
import type { DetailedStats } from '~/utils/player-stats'
import { formatTierName } from '#common/utils/tiers'

/**
 * The player's figures placed among the elos: for each one TrueMain measures
 * by tier on the player's main role (`/benchmarks/form`), a scale with every
 * tier's median on it and the player's mark — and the highest tier whose
 * median the player meets, said in words ("CS/min of a Diamond"). The
 * player's own tier is lit on the scale.
 *
 * Any tier can be picked to compare against (the player's own by default):
 * its dot is lit, and each figure says how far it is from that tier's median.
 */
const props = defineProps<{
  stats: DetailedStats | null
  benchmark: FormBenchmarkResponse | null
  /** The player's Solo/Duo tier, to light on each scale. */
  tier: string | null
}>()

const { t } = useT()

const ORDER = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER']
const TIER_COLOR: Record<string, string> = {
  IRON: '#8a7f7a', BRONZE: '#a8693f', SILVER: '#9fb0bd', GOLD: '#d6ad4f', PLATINUM: '#4fb0a5', EMERALD: '#3cb878',
  DIAMOND: '#6f8cf0', MASTER: '#b45fd1', GRANDMASTER: '#d6534f', CHALLENGER: '#f0c75a',
}
type Metric = 'kda' | 'killParticipation' | 'csPerMinute' | 'deaths' | 'visionPerMinute'
const METRICS: { key: Metric, stat: string, lowerIsBetter?: boolean, share?: boolean }[] = [
  { key: 'kda', stat: 'kda' },
  { key: 'killParticipation', stat: 'killParticipation', share: true },
  { key: 'csPerMinute', stat: 'csPerMinute' },
  { key: 'visionPerMinute', stat: 'visionPerMinute' },
  { key: 'deaths', stat: 'deaths', lowerIsBetter: true },
]

const available = computed(() => ORDER.filter(name => props.benchmark?.tiers.some(row => row.tier === name)))
const picked = ref<string | null>(null)
const compareTo = computed(() => picked.value && available.value.includes(picked.value)
  ? picked.value
  : props.tier && available.value.includes(props.tier.toUpperCase()) ? props.tier.toUpperCase() : available.value[Math.floor(available.value.length / 2)] ?? null)

const valueOf = (stat: string) => props.stats?.groups.flatMap(group => group.lines).find(line => line.key === stat)?.all ?? null

const rows = computed(() => {
  const tiers = (props.benchmark?.tiers ?? []).filter(row => ORDER.includes(row.tier)).sort((a, b) => ORDER.indexOf(a.tier) - ORDER.indexOf(b.tier))
  return METRICS.flatMap((metric) => {
    const value = valueOf(metric.stat)
    const marks = tiers.map(row => ({ tier: row.tier, quartiles: row[metric.key] as Quartiles | null })).filter((mark): mark is { tier: string, quartiles: Quartiles } => mark.quartiles !== null)
    if (value === null || marks.length < 2) return []
    const medians = marks.map(mark => mark.quartiles.median)
    const low = Math.min(...medians, value)
    const high = Math.max(...medians, value)
    const span = high - low || 1
    // Placed left to right from worst to best: a figure where less is better runs the other way.
    const at = (figure: number) => {
      const position = ((figure - low) / span) * 100
      return metric.lowerIsBetter ? 100 - position : position
    }
    const better = (figure: number, median: number) => (metric.lowerIsBetter ? figure <= median : figure >= median)
    const level = [...marks].reverse().find(mark => better(value, mark.quartiles.median))?.tier ?? null
    const against = marks.find(mark => mark.tier === compareTo.value)?.quartiles ?? null
    const raw = against && against.median !== 0 ? (value - against.median) / Math.abs(against.median) : null
    const gap = raw === null ? null : metric.lowerIsBetter ? -raw : raw
    return [{ ...metric, value, level, gap, median: against?.median ?? null, marks: marks.map(mark => ({ tier: mark.tier, at: at(mark.quartiles.median) })), mine: at(value) }]
  })
})

const format = (value: number, share?: boolean) => (share ? `${Math.round(value * 100)}%` : value.toFixed(value >= 10 ? 1 : 2))
</script>

<template>
  <div v-if="rows.length" class="rounded-xl bg-elevated/50 p-3 ring-1 ring-default">
    <header class="mb-2 flex flex-wrap items-center gap-2">
      <h3 class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">{{ t('dash.elo.title') }}</h3>
      <span class="text-[10px] text-dimmed">{{ t('dash.elo.hint') }}</span>
    </header>
    <div class="mb-3 flex flex-wrap items-center gap-1" role="radiogroup" :aria-label="t('dash.elo.compare')">
      <span class="mr-1 text-[10px] text-dimmed">{{ t('dash.elo.compare') }}</span>
      <button
        v-for="name in available"
        :key="name"
        type="button"
        role="radio"
        :aria-checked="compareTo === name"
        class="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 transition-colors"
        :class="compareTo === name ? 'ring-current' : 'ring-transparent opacity-60 hover:opacity-100'"
        :style="{ color: TIER_COLOR[name], backgroundColor: compareTo === name ? `${TIER_COLOR[name]}22` : undefined }"
        @click="picked = name"
      >
        <span class="size-1.5 rounded-full" :style="{ backgroundColor: TIER_COLOR[name] }" />
        {{ formatTierName(name) }}<span v-if="name === tier?.toUpperCase()" class="font-normal opacity-70"> · {{ t('dash.elo.yours') }}</span>
      </button>
    </div>
    <ul class="space-y-3.5">
      <li v-for="row in rows" :key="row.key" class="grid grid-cols-[minmax(0,8.5rem)_3.75rem_minmax(0,1fr)_minmax(0,8.5rem)] items-center gap-x-2.5 text-xs">
        <span class="truncate text-muted">{{ t(`dash.stats.line.${row.stat}`) }}</span>
        <span class="text-right font-semibold tabular-nums text-highlighted">{{ format(row.value, row.share) }}</span>
        <!-- Every tier's median as a tick, the player's tier lit, the player's mark on top. -->
        <span class="relative h-5">
          <span class="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-(--ui-border-accented)" aria-hidden="true" />
          <span
            v-for="mark in row.marks"
            :key="mark.tier"
            class="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-(--ui-bg-elevated)"
            :class="mark.tier === compareTo ? 'scale-150' : 'opacity-60'"
            :style="{ left: `${mark.at}%`, backgroundColor: TIER_COLOR[mark.tier] }"
            :title="`${formatTierName(mark.tier)}`"
          />
          <span class="absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" :style="{ left: `${row.mine}%` }" :title="t('dash.elo.you')">
            <span class="size-3 rotate-45 rounded-[2px] bg-white shadow-[0_0_8px] shadow-white/50 ring-2 ring-(--ui-bg-elevated)" />
          </span>
        </span>
        <span class="text-right text-[11px] leading-tight">
          <span v-if="row.gap !== null" class="block font-semibold tabular-nums" :class="Math.abs(row.gap) < 0.05 ? 'text-muted' : row.gap > 0 ? 'text-primary' : 'text-error'">
            {{ row.gap > 0 ? '+' : '' }}{{ Math.round(row.gap * 100) }}% <span class="font-normal text-dimmed">vs {{ format(row.median!, row.share) }}</span>
          </span>
          <span class="block truncate text-[10px]">
            <template v-if="row.level">
              <span class="text-dimmed">{{ t('dash.elo.levelOf') }}&nbsp;</span>
              <span class="font-semibold" :style="{ color: TIER_COLOR[row.level] }">{{ formatTierName(row.level) }}</span>
            </template>
            <span v-else class="text-dimmed">{{ t('dash.elo.below') }}</span>
          </span>
        </span>
      </li>
    </ul>
  </div>
</template>
