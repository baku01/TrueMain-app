<script setup lang="ts">
import type { ChampionAnalytics } from '~/utils/sources/analytics'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * The champion's figures on the lane: the source's grade and rank, win, pick
 * and ban rates and games, each against the bracket's average or the patch
 * before when the source keeps them, and its damage by type.
 */
const props = defineProps<{ header: NonNullable<ChampionAnalytics['header']>, damage: ChampionAnalytics['damage'] }>()
const { t } = useT()

const percent = (value: number | null) => (value === null ? '—' : formatPercentage(value, 2))
const signed = (delta: number) => `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(2)}`
const tone = (delta: number) => (delta > 0.0005 ? 'text-primary' : delta < -0.0005 ? 'text-error' : 'text-dimmed')

const tiles = computed(() => {
  const { header } = props
  const previous = header.previous
  return [
    { key: 'winRate', value: percent(header.winRate), delta: header.averageWinRate !== null ? { value: header.winRate - header.averageWinRate, text: t('analytics.header.vsAverage', { delta: signed(header.winRate - header.averageWinRate) }) } : previous ? { value: header.winRate - previous.winRate, text: t('analytics.header.vsPrevious', { delta: signed(header.winRate - previous.winRate), patch: previous.patch }) } : null },
    ...(header.averageWinRate !== null ? [{ key: 'average', value: percent(header.averageWinRate), delta: null }] : []),
    { key: 'pickRate', value: percent(header.pickRate), delta: previous ? { value: header.pickRate - previous.pickRate, text: t('analytics.header.vsPrevious', { delta: signed(header.pickRate - previous.pickRate), patch: previous.patch }) } : null },
    { key: 'banRate', value: percent(header.banRate), delta: previous && header.banRate !== null && previous.banRate !== null ? { value: header.banRate - previous.banRate, text: t('analytics.header.vsPrevious', { delta: signed(header.banRate - previous.banRate), patch: previous.patch }) } : null },
    { key: 'games', value: header.games.toLocaleString(), delta: null },
  ]
})
// The app's theme carries no stock palette: the three damage colours are written out.
const DAMAGE = [
  { key: 'physical', color: '#f0913a' },
  { key: 'magic', color: '#4fb4f0' },
  { key: 'true', color: '#e6e8ee' },
] as const
</script>

<template>
  <div class="grid gap-3 @3xl:grid-cols-[auto_minmax(0,1fr)]">
    <div v-if="header.tier || header.rank" class="surface flex items-center gap-5 rounded-2xl px-5 py-3">
      <div v-if="header.tier" class="text-center">
        <p class="text-2xl font-bold text-highlighted">{{ header.tier }}</p>
        <p class="stat-label">{{ t('analytics.header.tier') }}</p>
      </div>
      <div v-if="header.rank" class="text-center">
        <p class="text-2xl font-bold tabular-nums text-highlighted">{{ header.rank }}<span v-if="header.rankTotal" class="text-base font-medium text-dimmed"> / {{ header.rankTotal }}</span></p>
        <p class="stat-label">{{ t('analytics.header.rank') }}</p>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3 @2xl:grid-cols-5">
      <div v-for="tile in tiles" :key="tile.key" class="surface rounded-2xl px-4 py-3">
        <p class="stat-label">{{ t(`analytics.header.${tile.key}`) }}</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-highlighted">{{ tile.value }}</p>
        <p v-if="tile.delta" class="text-[11px] tabular-nums" :class="tone(tile.delta.value)">{{ tile.delta.text }}</p>
      </div>
    </div>
    <div v-if="damage" class="surface rounded-2xl px-4 py-3 @3xl:col-span-2">
      <p class="stat-label mb-2">{{ t('analytics.header.damage') }}</p>
      <div class="flex h-2 overflow-hidden rounded-full bg-accented">
        <span v-for="part in DAMAGE" :key="part.key" :style="{ width: `${damage[part.key] * 100}%`, background: part.color }" />
      </div>
      <div class="mt-1.5 flex gap-4 text-[11px] text-muted">
        <span v-for="part in DAMAGE" :key="part.key" class="flex items-center gap-1.5"><span class="size-2 rounded-full" :style="{ background: part.color }" />{{ t(`analytics.damage.${part.key}`) }} {{ formatPercentage(damage[part.key], 0) }}</span>
      </div>
    </div>
  </div>
</template>
