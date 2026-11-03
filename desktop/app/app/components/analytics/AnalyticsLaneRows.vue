<script setup lang="ts">
import type { LaneRows } from '~/utils/sources/analytics'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * Champions measured against (or with) the one on screen, lane by lane: a
 * strip of portraits per lane, each with its win rate, the source's deltas
 * when it has them, pick rate and games. The strips sort together — hardest,
 * easiest or most played first.
 */
const props = defineProps<{ lanes: LaneRows[], kind?: 'counter' | 'synergy' }>()
const { t } = useT()
const { nameOf, portraitOf } = useChampionStatics()

type Sort = 'hardest' | 'easiest' | 'common' | 'delta'
const sort = ref<Sort>('common')
const LANE_KEYS: Record<string, string> = { TOP: 'probuild.role.top', JUNGLE: 'probuild.role.jungle', MIDDLE: 'probuild.role.middle', BOTTOM: 'probuild.role.bottom', UTILITY: 'probuild.role.utility' }

const sorted = computed(() => props.lanes.map(lane => ({
  ...lane,
  rows: [...lane.rows].sort((a, b) => sort.value === 'hardest' ? a.winRate - b.winRate : sort.value === 'easiest' ? b.winRate - a.winRate : sort.value === 'delta' ? (b.delta1 ?? 0) - (a.delta1 ?? 0) : b.games - a.games).slice(0, 24),
})))
const hasDelta = computed(() => props.lanes.some(lane => lane.rows.some(row => row.delta1 !== undefined)))
const sorts = computed<Sort[]>(() => (hasDelta.value ? ['common', 'easiest', 'hardest', 'delta'] : ['common', 'easiest', 'hardest']))
/** The same sorts, worded for allies: the best teammate is the "easiest" one. */
const SYNERGY: Record<Sort, string> = { common: 'synergy.common', easiest: 'synergy.good', hardest: 'synergy.bad', delta: 'synergy.delta' }
const sortLabel = (option: Sort) => t(props.kind === 'synergy' ? `analytics.${SYNERGY[option]}` : `analytics.matchups.sort.${option}`)
const tone = (value: number) => (value >= 0.52 ? 'text-primary' : value < 0.48 ? 'text-error' : 'text-highlighted')
const delta = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
</script>

<template>
  <div class="space-y-3">
    <div class="flex gap-1.5">
      <UButton v-for="option in sorts" :key="option" :label="sortLabel(option)" size="xs" :color="sort === option ? 'primary' : 'neutral'" :variant="sort === option ? 'soft' : 'ghost'" @click="sort = option" />
    </div>
    <div v-for="lane in sorted" :key="lane.position" class="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl bg-accented/15 p-2">
      <p class="text-center text-sm font-semibold text-highlighted">{{ kind === 'synergy' ? (LANE_KEYS[lane.position] ? t(LANE_KEYS[lane.position]!) : lane.position) : t('analytics.matchups.lane', { lane: LANE_KEYS[lane.position] ? t(LANE_KEYS[lane.position]!) : lane.position }) }}</p>
      <ul class="flex gap-1.5 overflow-x-auto pb-1">
        <li v-for="row in lane.rows" :key="row.championId" class="flex w-[5.25rem] shrink-0 flex-col items-center gap-0.5 rounded-lg bg-accented/25 px-1 py-1.5 text-center leading-tight" :title="nameOf(row.championId)">
          <img v-if="portraitOf(row.championId)" :src="portraitOf(row.championId)!" :alt="nameOf(row.championId)" width="36" height="36" class="img-skeleton size-9 rounded-md">
          <span class="text-[13px] font-semibold tabular-nums" :class="tone(row.winRate)">{{ formatPercentage(row.winRate, 1) }}</span>
          <span v-if="row.delta1 !== undefined" class="whitespace-nowrap text-[10px] tabular-nums text-muted">{{ t('analytics.delta1') }} {{ delta(row.delta1) }}</span>
          <span v-if="row.delta2 !== undefined" class="whitespace-nowrap text-[10px] tabular-nums text-muted">{{ t('analytics.delta2') }} {{ delta(row.delta2) }}</span>
          <span class="whitespace-nowrap text-[10px] tabular-nums text-dimmed"><template v-if="row.pickRate !== null">{{ formatPercentage(row.pickRate, 1) }} · </template>{{ row.games.toLocaleString() }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
