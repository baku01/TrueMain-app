<script setup lang="ts">
import type { StaticItemData, StaticSummonerSpellData } from '#shared/types/static-data'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * A measured table of items (or summoner spell pairs) — a set's icons, its
 * win rate, pick rate and games, and the minute it is bought when the source
 * says — with tabs when it has more than one view (starting sets and single
 * items; popular, winning and all items). Sorted by any column on a click;
 * the first rows shown, the rest one click away.
 */
interface Row { itemIds?: number[], spellIds?: number[], winRate: number, pickRate: number, games: number, minute?: number }

const props = withDefaults(defineProps<{
  tabs: { key: string, label: string, rows: Row[] }[]
  items?: Record<number, StaticItemData>
  summoners?: Record<number, StaticSummonerSpellData>
  /** The win rate the rows read against: above it in the accent, below it in red. */
  average?: number | null
  limit?: number
}>(), { items: () => ({}), summoners: () => ({}), average: null, limit: 12 })

const { t } = useT()
const active = ref(props.tabs[0]?.key ?? '')
watch(() => props.tabs.map(tab => tab.key).join(), () => {
  if (!props.tabs.some(tab => tab.key === active.value)) active.value = props.tabs[0]?.key ?? ''
})
type SortKey = 'winRate' | 'pickRate' | 'games' | 'minute'
const sort = ref<SortKey>('games')
const expanded = ref(false)

const rows = computed(() => {
  const list = [...(props.tabs.find(tab => tab.key === active.value)?.rows ?? [])]
  list.sort((a, b) => (b[sort.value] ?? -1) - (a[sort.value] ?? -1))
  return expanded.value ? list : list.slice(0, props.limit)
})
const total = computed(() => props.tabs.find(tab => tab.key === active.value)?.rows.length ?? 0)
const timed = computed(() => rows.value.some(row => row.minute !== undefined))
const tone = (winRate: number) => (props.average === null ? 'text-highlighted' : winRate >= props.average ? 'text-primary' : 'text-error')
const columns = computed(() => [
  { key: 'winRate' as const, label: t('analytics.table.winRate') },
  { key: 'pickRate' as const, label: t('analytics.table.pickRate') },
  { key: 'games' as const, label: t('analytics.table.games') },
  ...(timed.value ? [{ key: 'minute' as const, label: t('analytics.table.minute') }] : []),
])
</script>

<template>
  <div class="space-y-2">
    <div v-if="tabs.length > 1" class="flex flex-wrap gap-1" role="tablist">
      <UButton
        v-for="tab in tabs"
        :key="tab.key"
        :label="tab.label"
        size="xs"
        :color="active === tab.key ? 'primary' : 'neutral'"
        :variant="active === tab.key ? 'soft' : 'ghost'"
        role="tab"
        :aria-selected="active === tab.key"
        @click="active = tab.key; expanded = false"
      />
    </div>
    <table class="w-full text-xs">
      <thead>
        <tr class="text-[10px] uppercase tracking-wider text-dimmed">
          <th class="pb-1.5 text-left font-semibold">{{ spellsOnly(tabs) ? t('analytics.table.spells') : t('analytics.table.items') }}</th>
          <th v-for="column in columns" :key="column.key" class="pb-1.5 text-right font-semibold">
            <button type="button" class="inline-flex items-center gap-0.5 uppercase" :class="sort === column.key ? 'text-highlighted' : 'hover:text-muted'" @click="sort = column.key">
              {{ column.label }}<UIcon v-if="sort === column.key" name="i-lucide-arrow-down" class="size-3" />
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="index" class="border-t border-default/60">
          <td class="py-1.5">
            <span class="flex flex-wrap items-center gap-1">
              <template v-if="row.spellIds">
                <GameTooltipSummonerSpellIcon v-for="id in row.spellIds" :key="id" :spell="summoners[id] ?? null" :width="24" :height="24" class="size-6 rounded" />
              </template>
              <template v-else>
                <GameTooltipItemIcon v-for="(id, at) in row.itemIds" :key="`${id}-${at}`" :item="items[id] ?? null" :width="24" :height="24" class="size-6 rounded" />
              </template>
            </span>
          </td>
          <td class="py-1.5 text-right font-semibold tabular-nums" :class="tone(row.winRate)">{{ formatPercentage(row.winRate, 2) }}</td>
          <td class="py-1.5 text-right tabular-nums text-muted">{{ formatPercentage(row.pickRate, 2) }}</td>
          <td class="py-1.5 text-right tabular-nums text-muted">{{ row.games.toLocaleString() }}</td>
          <td v-if="timed" class="py-1.5 text-right tabular-nums text-dimmed">{{ row.minute !== undefined ? t('analytics.table.minuteValue', { minute: row.minute }) : '—' }}</td>
        </tr>
      </tbody>
    </table>
    <UButton v-if="total > limit" :label="expanded ? t('analytics.table.less') : t('analytics.table.more', { count: total - limit })" size="xs" color="neutral" variant="ghost" block @click="expanded = !expanded" />
  </div>
</template>

<script lang="ts">
/** Whether every tab lists summoner spells: the first column says so. */
function spellsOnly(tabs: { rows: { spellIds?: number[] }[] }[]): boolean {
  return tabs.every(tab => tab.rows.every(row => row.spellIds))
}
</script>
