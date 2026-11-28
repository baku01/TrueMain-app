<script setup lang="ts">
import type { CounterRow } from '~/utils/counters'
import { counterTier, formatPoints } from '~/utils/counters'
import { formatPercentage, formatPercentageOrDash } from '#shared/utils/ddragon'
import { formatCount } from '#shared/utils/counts'
import { winRateTone } from '#common/utils/rate-tone'

/**
 * One of the Counters view's two tables, as Blitz's: each opponent with the
 * matchup's tier, its score in percentage points, the win rate and the games,
 * best first; "laning only" swaps in the lane's score and win rate. A header
 * sorts by its column; the first rows shown, the rest one click away. A row
 * opens the opponent's own page on the lane.
 */
const props = defineProps<{
  title: string
  rows: CounterRow[]
  laning: boolean
  /** The weak table: its tier is read from the opponent's side. */
  weak?: boolean
  position: string
}>()

const { t } = useT()
const { nameOf, portraitOf } = useChampionStatics()

type SortKey = 'score' | 'winRate' | 'games'
const sort = ref<SortKey>('score')
const sortDir = ref<'desc' | 'asc'>('desc')
const expanded = ref(false)
const LIMIT = 10

function toggleSort(key: SortKey) {
  if (sort.value === key) sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  else {
    sort.value = key
    sortDir.value = 'desc'
  }
}

const score = (row: CounterRow) => (props.laning ? row.laneScore : row.score) ?? 0
const winRate = (row: CounterRow) => (props.laning ? row.laneWinRate : row.winRate)
const sorted = computed(() => {
  // The table's own order is the score away from even, strongest first.
  const value = (row: CounterRow) => (sort.value === 'score' ? Math.abs(score(row)) : sort.value === 'winRate' ? winRate(row) ?? 0 : row.games)
  const factor = sortDir.value === 'desc' ? 1 : -1
  return [...props.rows].sort((a, b) => factor * (value(b) - value(a)) || b.games - a.games)
})
const shown = computed(() => (expanded.value ? sorted.value : sorted.value.slice(0, LIMIT)))
const columns = computed(() => [
  { key: 'score' as const, label: props.laning ? t('counters.lanePp') : t('counters.pp'), title: props.laning ? t('counters.lanePpTitle') : t('counters.ppTitle') },
  { key: 'winRate' as const, label: props.laning ? t('counters.laneWr') : t('counters.wr'), title: props.laning ? t('counters.laneWrTitle') : t('counters.wrTitle') },
  { key: 'games' as const, label: t('counters.games'), title: t('counters.gamesTitle') },
])
</script>

<template>
  <section class="surface flex min-w-0 flex-col gap-2 rounded-2xl p-4">
    <h3 class="flex items-center gap-2 text-sm font-semibold text-highlighted">
      <UIcon :name="weak ? 'i-tabler-trending-down' : 'i-tabler-trending-up'" class="size-4" :class="weak ? 'text-error' : 'text-primary'" />
      {{ title }}
      <span class="text-[11px] font-normal tabular-nums text-dimmed">{{ rows.length }}</span>
    </h3>
    <table v-if="rows.length" class="w-full text-xs">
      <thead>
        <tr class="stat-label">
          <th class="pb-1.5 text-left font-semibold">{{ t('counters.champion') }}</th>
          <th class="w-12 pb-1.5 text-center font-semibold" :title="weak ? t('counters.tierWeakTitle') : t('counters.tierTitle')">{{ t('counters.tier') }}</th>
          <th v-for="column in columns" :key="column.key" class="w-16 pb-1.5 text-right font-semibold" :title="column.title" :aria-sort="sort === column.key ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'">
            <button type="button" class="inline-flex items-center gap-0.5" :class="sort === column.key ? 'text-highlighted' : 'hover:text-muted'" @click="toggleSort(column.key)">
              {{ column.label }}<UIcon v-if="sort === column.key" :name="sortDir === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'" class="size-3" />
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in shown" :key="row.championId" class="border-t border-default/60 transition-colors hover:bg-accented/40">
          <td class="py-1">
            <NuxtLink :to="{ path: `/champions/${row.championId}`, query: { position, view: 'counters' } }" class="group flex min-w-0 items-center gap-2">
              <img v-if="portraitOf(row.championId)" :src="portraitOf(row.championId)!" :alt="nameOf(row.championId)" width="28" height="28" class="img-skeleton size-7 shrink-0 rounded-md">
              <span class="truncate font-semibold text-highlighted transition-colors group-hover:text-primary">{{ nameOf(row.championId) }}</span>
            </NuxtLink>
          </td>
          <td class="py-1"><span class="flex justify-center"><TierBadge :tier="counterTier(weak ? -score(row) : score(row))" /></span></td>
          <td class="py-1 text-right font-semibold tabular-nums" :class="winRateTone(0.5 + score(row))">{{ formatPoints(score(row)) }}</td>
          <td class="py-1 text-right tabular-nums" :class="winRateTone(winRate(row))">{{ laning ? formatPercentageOrDash(winRate(row), 1) : formatPercentage(row.winRate, 1) }}</td>
          <td class="py-1 text-right tabular-nums text-muted">{{ formatCount(row.games) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="py-4 text-center text-xs text-muted">{{ t('counters.none') }}</p>
    <UButton
      v-if="rows.length > LIMIT"
      :label="expanded ? t('counters.less') : t('counters.all', { count: rows.length })"
      color="neutral"
      variant="ghost"
      size="xs"
      class="self-center"
      @click="expanded = !expanded"
    />
  </section>
</template>
