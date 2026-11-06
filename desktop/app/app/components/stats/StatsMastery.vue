<script setup lang="ts">
import type { ChampionPosition } from '#common/utils/positions'
import type { MasteryRow } from '~/utils/blitz/mastery'
import type { MasterySourceRead } from '~/utils/sources/mastery'
import { MASTERY_LEVELS, visibleMastery } from '~/utils/blitz/mastery'
import { readMastery } from '~/utils/sources/mastery'
import { formatPercentage } from '#shared/utils/ddragon'
import { winRateTone } from '#common/utils/rate-tone'
import { POSITION_BY_VALUE } from '#common/utils/positions'

/**
 * Win rate by champion mastery, as Blitz's Mastery page: for each champion
 * and lane the win rate of its players at mastery 5, 20, 50 and 100 and up,
 * the trend across them against the even line, and the improvement from the
 * first to the last — which champions repay the games put in. Most improved
 * first; any header re-sorts. The badge names the source (`readMastery`).
 */
const { t } = useT()
const { nameOf, portraitOf } = useChampionStatics()

const position = ref<ChampionPosition | null>(null)
const query = ref('')
const read = ref<MasterySourceRead | null>(null)
const failed = ref(false)
onMounted(async () => {
  try {
    read.value = await readMastery()
  }
  catch {
    failed.value = true
  }
})

type SortKey = number | 'improvement'
const sort = ref<SortKey>('improvement')
const expanded = ref(false)
const LIMIT = 40
const rows = computed(() => {
  const value = (row: MasteryRow) => (sort.value === 'improvement' ? row.improvement : row.levels[sort.value] ?? 0)
  return visibleMastery(read.value?.rows ?? [], position.value, query.value, nameOf).sort((a, b) => value(b) - value(a))
})
const shown = computed(() => (expanded.value ? rows.value : rows.value.slice(0, LIMIT)))
const columns = computed(() => [
  ...MASTERY_LEVELS.map((level, index) => ({ key: index as SortKey, label: t('mastery.level', { level }) })),
  { key: 'improvement' as SortKey, label: t('mastery.improvement') },
])

/** The trend as a 96×24 line, the even (50%) line through it. */
function trend(levels: number[]) {
  const low = Math.min(0.5, ...levels)
  const high = Math.max(0.5, ...levels)
  const span = high - low || 0.01
  const y = (value: number) => 22 - ((value - low) / span) * 20
  return { points: levels.map((value, index) => `${4 + index * 29.3},${y(value).toFixed(1)}`).join(' '), even: y(0.5).toFixed(1) }
}
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatPercentage(Math.abs(value), 1)}`
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <RolePicker v-model:position="position" />
      <UInput v-model="query" icon="i-lucide-search" size="sm" :placeholder="t('stats.search')" :aria-label="t('stats.search')" class="w-52" />
      <span class="flex-1" />
      <span v-if="read?.patch" class="text-xs tabular-nums text-dimmed">{{ t('counters.patch', { patch: read.patch }) }}</span>
      <StatsSourceBadge v-if="read" :source="read.source" />
    </div>
    <section class="surface rounded-2xl p-4">
      <p class="mb-3 text-xs leading-snug text-muted">{{ t('mastery.description') }}</p>
      <p v-if="failed" class="py-6 text-center text-sm text-muted">{{ t('stats.failed') }}</p>
      <div v-else-if="!read" class="space-y-1.5">
        <USkeleton v-for="row in 10" :key="row" class="h-8 w-full" />
      </div>
      <table v-else-if="rows.length" class="w-full text-xs">
        <thead>
          <tr class="stat-label">
            <th class="w-8 pb-1.5 text-left font-semibold">#</th>
            <th class="w-10 pb-1.5 text-center font-semibold">{{ t('stats.col.role') }}</th>
            <th class="pb-1.5 text-left font-semibold">{{ t('counters.champion') }}</th>
            <th v-for="column in columns" :key="column.key" class="w-24 whitespace-nowrap pb-1.5 text-right font-semibold">
              <button type="button" class="inline-flex items-center gap-0.5 uppercase" :class="sort === column.key ? 'text-highlighted' : 'hover:text-muted'" @click="sort = column.key">
                {{ column.label }}<UIcon v-if="sort === column.key" name="i-lucide-arrow-down" class="size-3" />
              </button>
            </th>
            <th class="hidden w-28 pb-1.5 text-center font-semibold lg:table-cell">{{ t('mastery.trend') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in shown" :key="`${row.championId}-${row.position}`" class="border-t border-default/60">
            <td class="py-1 tabular-nums text-dimmed">{{ index + 1 }}</td>
            <td class="py-1"><img :src="POSITION_BY_VALUE.get(row.position)?.iconUrl" :alt="POSITION_BY_VALUE.get(row.position)?.label" :title="POSITION_BY_VALUE.get(row.position)?.label" width="18" height="18" class="mx-auto size-[18px]"></td>
            <td class="py-1">
              <NuxtLink :to="{ path: `/champions/${row.championId}`, query: { position: row.position } }" class="flex min-w-0 items-center gap-2 hover:text-primary">
                <img v-if="portraitOf(row.championId)" :src="portraitOf(row.championId)!" :alt="nameOf(row.championId)" width="28" height="28" class="img-skeleton size-7 shrink-0 rounded-md">
                <span class="truncate font-semibold text-highlighted">{{ nameOf(row.championId) }}</span>
              </NuxtLink>
            </td>
            <td v-for="(rate, at) in row.levels" :key="at" class="py-1 text-right tabular-nums" :class="winRateTone(rate)">{{ formatPercentage(rate, 1) }}</td>
            <td class="py-1 text-right font-semibold tabular-nums" :class="winRateTone(0.5 + row.improvement)">{{ signed(row.improvement) }}</td>
            <td class="hidden py-1 lg:table-cell">
              <svg viewBox="0 0 96 24" class="mx-auto h-6 w-24" :class="winRateTone(row.levels.at(-1))" role="img" :aria-label="t('mastery.trendLabel', { rates: row.levels.map((rate, at) => `${MASTERY_LEVELS[at]}+ ${formatPercentage(rate, 1)}`).join(', ') })">
                <line x1="0" x2="96" :y1="trend(row.levels).even" :y2="trend(row.levels).even" class="stroke-(--ui-border-accented)" stroke-dasharray="2 2" />
                <polyline :points="trend(row.levels).points" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
              </svg>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="py-6 text-center text-xs text-muted">{{ t('stats.none') }}</p>
      <UButton
        v-if="rows.length > LIMIT"
        :label="expanded ? t('counters.less') : t('counters.all', { count: rows.length })"
        color="neutral"
        variant="ghost"
        size="xs"
        class="mx-auto mt-2 flex"
        @click="expanded = !expanded"
      />
    </section>
  </div>
</template>
