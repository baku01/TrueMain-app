<script setup lang="ts">
import type { SynergyRow } from '~/utils/synergies'
import { bySynergy } from '~/utils/synergies'
import { formatPercentage } from '#shared/utils/ddragon'
import { formatCount } from '#shared/utils/counts'
import { winRateTone } from '#common/utils/rate-tone'
import { POSITION_BY_VALUE } from '#common/utils/positions'

/**
 * Pairs of champions on one team, as Blitz's synergy tables: a champion's
 * allies (the champion page) or the best duos of two lanes (`pair`, the stats
 * page — both champions and their lanes). Tier, win rate, the delta over
 * what the two champions' own rates predict where the source measures it,
 * and games; best tier first, any header re-sorts. The first rows shown, the
 * rest one click away; a champion opens its page on its lane.
 */
const props = defineProps<{ rows: SynergyRow[], pair?: boolean }>()
const { t } = useT()
const { nameOf, portraitOf } = useChampionStatics()

type SortKey = 'tier' | 'winRate' | 'delta' | 'games'
const sort = ref<SortKey>('tier')
const expanded = ref(false)
const LIMIT = 25
watch(() => props.rows, () => (expanded.value = false))

const hasDelta = computed(() => props.rows.some(row => row.delta !== null))
const sorted = computed(() => {
  if (sort.value === 'tier') return [...props.rows].sort(bySynergy)
  const value = (row: SynergyRow) => (sort.value === 'winRate' ? row.winRate : sort.value === 'delta' ? row.delta ?? -1 : row.games)
  return [...props.rows].sort((a, b) => value(b) - value(a) || b.games - a.games)
})
const shown = computed(() => (expanded.value ? sorted.value : sorted.value.slice(0, LIMIT)))
const columns = computed(() => [
  { key: 'tier' as const, label: t('stats.col.tier'), align: 'text-center' },
  { key: 'winRate' as const, label: props.pair ? t('stats.col.duoWr') : t('stats.col.wr'), align: 'text-right' },
  ...(hasDelta.value ? [{ key: 'delta' as const, label: t('stats.col.delta'), align: 'text-right' }] : []),
  { key: 'games' as const, label: t('stats.col.games'), align: 'text-right' },
])
const lane = (position: string) => POSITION_BY_VALUE.get(position)
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatPercentage(Math.abs(value), 1)}`
</script>

<template>
  <div class="flex flex-col gap-2">
    <table v-if="rows.length" class="w-full text-xs">
      <thead>
        <tr class="stat-label">
          <th class="w-8 pb-1.5 text-left font-semibold">#</th>
          <th v-if="pair" class="w-16 pb-1.5 text-center font-semibold">{{ t('stats.col.roles') }}</th>
          <th class="pb-1.5 text-left font-semibold">{{ pair ? t('stats.col.champions') : t('stats.col.ally') }}</th>
          <th v-for="column in columns" :key="column.key" class="w-20 pb-1.5 font-semibold" :class="column.align" :title="column.key === 'delta' ? t('stats.col.deltaTitle') : undefined">
            <button type="button" class="inline-flex items-center gap-0.5 uppercase" :class="sort === column.key ? 'text-highlighted' : 'hover:text-muted'" @click="sort = column.key">
              {{ column.label }}<UIcon v-if="sort === column.key" name="i-lucide-arrow-down" class="size-3" />
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in shown" :key="`${row.championId}-${row.allyChampionId}`" class="border-t border-default/60">
          <td class="py-1 tabular-nums text-dimmed">{{ index + 1 }}</td>
          <td v-if="pair" class="py-1">
            <span class="flex items-center justify-center gap-1">
              <img v-for="position in [row.position, row.allyPosition]" :key="position" :src="lane(position)?.iconUrl" :alt="lane(position)?.label" :title="lane(position)?.label" width="16" height="16" class="size-4">
            </span>
          </td>
          <td class="py-1">
            <!-- A pair in two equal columns, so the second champion starts at the same place on every row. -->
            <span class="min-w-0 items-center gap-2" :class="pair ? 'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : 'flex'">
              <template v-for="(id, at) in pair ? [row.championId, row.allyChampionId] : [row.allyChampionId]" :key="`${id}-${at}`">
                <span v-if="at > 0" class="text-dimmed">&amp;</span>
                <NuxtLink :to="{ path: `/champions/${id}`, query: { position: at === 0 && pair ? row.position : row.allyPosition } }" class="flex min-w-0 items-center gap-2 hover:text-primary">
                  <img v-if="portraitOf(id)" :src="portraitOf(id)!" :alt="nameOf(id)" width="28" height="28" class="img-skeleton size-7 shrink-0 rounded-md">
                  <span class="truncate font-semibold text-highlighted">{{ nameOf(id) }}</span>
                </NuxtLink>
              </template>
            </span>
          </td>
          <td class="py-1"><span class="flex justify-center"><TierBadge :tier="row.tier" /></span></td>
          <td class="py-1 text-right font-semibold tabular-nums" :class="winRateTone(row.winRate)">{{ formatPercentage(row.winRate, 1) }}</td>
          <td v-if="hasDelta" class="py-1 text-right tabular-nums" :class="row.delta === null ? 'text-dimmed' : winRateTone(0.5 + row.delta)">{{ row.delta === null ? '—' : signed(row.delta) }}</td>
          <td class="py-1 text-right tabular-nums text-muted">{{ formatCount(row.games) }}</td>
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
      class="self-center"
      @click="expanded = !expanded"
    />
  </div>
</template>
