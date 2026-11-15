<script setup lang="ts">
import type { GameRow, MetricKey } from '~/utils/nerd-stats/features'
import type { GameSource } from '~/utils/deep-history'
import { DEFINITION_BY_KEY } from '~/utils/nerd-stats/features'
import { POSITION_BY_VALUE } from '#common/utils/positions'

/**
 * Every game the analysis read, one row each with every figure it was read
 * for — the table view of every chart on the page. Sorted by any column (a
 * second click turns the order over); a figure the game did not carry is a
 * dash, never a zero. The last column says where each game was read from.
 */
const props = defineProps<{
  rows: GameRow[]
  /** Where each game was read from (`useDeepHistory`). */
  sourceOf?: (gameId: number) => GameSource | null
}>()

const { t } = useT()
const f = useNerdFormat()
const champions = useStaticChampionsById()

interface Column {
  key: string
  label: string
  value: (row: GameRow) => number | string | null
  show: (row: GameRow) => string
  align?: 'left'
}

const metricColumn = (key: MetricKey): Column => ({
  key,
  label: t(`nerd.short.${key}`),
  value: row => row.values[key] ?? null,
  show: (row) => {
    const value = row.values[key]
    if (value === undefined) return '—'
    const definition = DEFINITION_BY_KEY.get(key)!
    return definition.format === 'binary' ? (value ? t('nerd.yes') : t('nerd.no')) : f.metric(definition, value)
  },
})

const columns = computed<Column[]>(() => [
  { key: 'date', label: t('nerd.col.date'), value: row => row.game.playedAt, show: row => new Date(row.game.playedAt).toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }), align: 'left' },
  { key: 'result', label: t('nerd.col.result'), value: row => (row.win ? 1 : 0), show: row => (row.win ? t('nerd.winShort') : t('nerd.lossShort')) },
  { key: 'champion', label: t('nerd.col.champion'), value: row => champions.value.get(row.game.championId)?.name ?? '', show: row => champions.value.get(row.game.championId)?.name ?? '—', align: 'left' },
  { key: 'position', label: t('nerd.col.position'), value: row => row.game.position ?? '', show: row => (row.game.position ? POSITION_BY_VALUE.get(row.game.position)?.shortLabel ?? row.game.position : '—'), align: 'left' },
  { key: 'queue', label: t('nerd.col.queue'), value: row => row.queue, show: row => t(`nerd.queueGroup.${row.queue}`), align: 'left' },
  metricColumn('duration'),
  { key: 'kda', label: 'K / D / A', value: row => row.values.kda ?? 0, show: row => `${row.game.kills} / ${row.game.deaths} / ${row.game.assists}` },
  metricColumn('kda'),
  metricColumn('killParticipation'),
  metricColumn('csPerMin'),
  metricColumn('goldPerMin'),
  metricColumn('damagePerMin'),
  metricColumn('damageShare'),
  metricColumn('visionPerMin'),
  metricColumn('goldDiff10'),
  metricColumn('goldDiff15'),
  metricColumn('csDiff15'),
  metricColumn('xpDiff15'),
  metricColumn('teamGoldDiff15'),
  metricColumn('firstBlood'),
  metricColumn('towerDiff'),
  metricColumn('dragonDiff'),
  { key: 'side', label: t('nerd.col.side'), value: row => row.game.teamId, show: row => t(row.game.teamId === 100 ? 'nerd.side.blue' : 'nerd.side.red') },
  { key: 'session', label: t('nerd.col.session'), value: row => row.session, show: row => t('nerd.col.sessionNth', { n: row.session }) },
  metricColumn('performance'),
  { key: 'lp', label: 'LP', value: row => row.lpDelta, show: row => (row.lpDelta === null ? '—' : f.signed(row.lpDelta)) },
  { key: 'source', label: t('nerd.col.source'), value: row => props.sourceOf?.(row.game.gameId) ?? null, show: (row) => {
    const source = props.sourceOf?.(row.game.gameId)
    return source ? t(`nerd.sourceShort.${source}`) : '—'
  }, align: 'left' },
])

const sortKey = ref('date')
const descending = ref(true)
function sortBy(key: string) {
  if (sortKey.value === key) descending.value = !descending.value
  else {
    sortKey.value = key
    descending.value = true
  }
}
const sorted = computed(() => {
  const column = columns.value.find(entry => entry.key === sortKey.value) ?? columns.value[0]!
  const direction = descending.value ? -1 : 1
  return [...props.rows].sort((a, b) => {
    const x = column.value(a)
    const y = column.value(b)
    // Unmeasured last, whichever way.
    if (x === null || y === null) return x === null ? (y === null ? 0 : 1) : -1
    return (x < y ? -1 : x > y ? 1 : 0) * direction
  })
})
</script>

<template>
  <section class="surface rounded-lg">
    <NerdCardHeader icon="i-tabler-table" :title="t('nerd.games.title')" :subtitle="t('nerd.games.subtitle', { count: rows.length })" />
    <div class="max-h-[70vh] overflow-auto">
      <table class="w-full min-w-max text-xs">
        <thead class="sticky top-0 z-10 bg-(--tm-pane) shadow-[0_1px_0_var(--ui-border)]">
          <tr>
            <th
              v-for="(column, index) in columns"
              :key="column.key"
              class="whitespace-nowrap px-2.5 py-2 font-medium"
              :class="[column.align === 'left' ? 'text-left' : 'text-right', index === 0 ? 'sticky left-0 z-10 bg-(--tm-pane) pl-4' : '']"
              :aria-sort="sortKey === column.key ? (descending ? 'descending' : 'ascending') : 'none'"
            >
              <button type="button" class="inline-flex items-center gap-1 text-dimmed hover:text-highlighted" :class="sortKey === column.key ? 'text-highlighted' : ''" @click="sortBy(column.key)">
                {{ column.label }}
                <UIcon :name="sortKey === column.key ? (descending ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up') : 'i-lucide-arrow-up-down'" class="size-3" :class="sortKey === column.key ? 'text-primary' : 'opacity-40'" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in sorted" :key="row.game.gameId" class="border-t border-default/60 hover:bg-elevated/40" :class="row.win ? 'nerd-row-win' : 'nerd-row-loss'">
            <td
              v-for="(column, index) in columns"
              :key="column.key"
              class="whitespace-nowrap px-2.5 py-1.5 tabular-nums"
              :class="[column.align === 'left' ? 'text-left' : 'text-right', index === 0 ? 'sticky left-0 bg-(--tm-pane) pl-4 text-muted' : '', column.key === 'result' ? 'font-semibold text-highlighted' : '']"
            >
              <span v-if="column.key === 'champion'" class="flex items-center gap-1.5">
                <SkeletonImage :src="champions.get(row.game.championId)?.iconUrl" alt="" class="size-5 shrink-0 rounded" />
                {{ column.show(row) }}
              </span>
              <span v-else-if="column.key === 'result'" class="inline-flex items-center gap-1.5">
                <span class="size-1.5 rounded-full" :class="row.win ? 'bg-(--nerd-win)' : 'bg-(--nerd-loss)'" />{{ column.show(row) }}
              </span>
              <template v-else>{{ column.show(row) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.nerd-row-win td:first-child {
  box-shadow: inset 3px 0 0 var(--nerd-win);
}

.nerd-row-loss td:first-child {
  box-shadow: inset 3px 0 0 var(--nerd-loss);
}
</style>
