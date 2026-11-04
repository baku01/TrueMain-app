<script setup lang="ts">
import type { ChampionAnalytics } from '~/utils/sources/analytics'
import { formatPercentage } from '#shared/utils/ddragon'
import { formatTierName } from '#common/utils/tiers'

/**
 * The page's summary in a few lines, under the header: the champion's win
 * rate, grade and rank on the lane, who it beats and who beats it most
 * clearly (portraits), and how its best players do with it over the last week.
 */
const props = defineProps<{ analytics: ChampionAnalytics, championName: string, lane: string }>()
const { t } = useT()
const { nameOf, portraitOf } = useChampionStatics()

const header = computed(() => props.analytics.header)
const best = computed(() => props.analytics.best)
</script>

<template>
  <div v-if="header || analytics.counters || best" class="surface space-y-2 rounded-2xl px-4 py-3 text-sm leading-relaxed text-muted">
    <p v-if="header">
      {{ t('analytics.line.rate', { name: championName, lane, rate: formatPercentage(header.winRate, 2), patch: analytics.patch ?? '' }) }}
      <template v-if="header.rank && header.rankTotal"> {{ t('analytics.line.rank', { rank: header.rank, total: header.rankTotal, tier: header.tier ?? '—' }) }}</template>
    </p>
    <p v-if="analytics.counters" class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <span>{{ t('analytics.line.strong', { name: championName }) }}</span>
      <span v-for="id in analytics.counters.strong" :key="`s${id}`" class="inline-flex items-center gap-1 font-medium text-primary">
        <img v-if="portraitOf(id)" :src="portraitOf(id)!" alt="" width="18" height="18" class="size-[18px] rounded">{{ nameOf(id) }}
      </span>
      <span>{{ t('analytics.line.weak') }}</span>
      <span v-for="id in analytics.counters.weak" :key="`w${id}`" class="inline-flex items-center gap-1 font-medium text-error">
        <img v-if="portraitOf(id)" :src="portraitOf(id)!" alt="" width="18" height="18" class="size-[18px] rounded">{{ nameOf(id) }}
      </span>
    </p>
    <p v-if="best">
      {{ t('analytics.line.best', { rate: formatPercentage(best.winRate, 2), games: best.games.toLocaleString(), players: best.players.toLocaleString(), elo: formatTierName(best.elo.toUpperCase()), rank: best.expertRank }) }}
    </p>
  </div>
</template>
