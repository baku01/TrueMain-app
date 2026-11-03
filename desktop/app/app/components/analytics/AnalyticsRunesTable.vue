<script setup lang="ts">
import type { RuneTreeResponse } from '#shared/types/static-data'
import type { RuneStat } from '~/utils/sources/analytics'
import { formatPercentage } from '#shared/utils/ddragon'
import { weighedWinRate } from '~/utils/sources/model'

/**
 * Every rune of every tree, and the shards, each with its win rate, pick rate
 * and games — as a primary rune, or as a secondary one — the tree read one
 * row at a time. "Highest win page" lights each row's rune that wins most,
 * weighed by its games (`weighedWinRate`: 70% of 30 games does not beat 56%
 * of 30 000), "Most picked page" each row's most taken; the rest go grey.
 */
const props = defineProps<{ stats: Map<number, RuneStat>, tree: RuneTreeResponse }>()
const { t } = useT()
const use = ref<'primary' | 'secondary'>('primary')
type Focus = 'overview' | 'win' | 'pick'
const focus = ref<Focus>('overview')
const of = (id: number, flex = false) => props.stats.get(flex ? -id : id)?.[flex ? 'primary' : use.value] ?? null
/**
 * The one page a focus lights, whole: the best keystone of every tree, the
 * best rune of each row of its tree, one secondary tree with its best two
 * runes from two rows, and the best shard of each row — "best" being the most
 * games for the most picked page, the win rate weighed by games for the
 * winning one. Null in the overview, where nothing is greyed by choice.
 */
const litPage = computed<{ runes: Set<number>, shards: (number | null)[] } | null>(() => {
  if (focus.value === 'overview') return null
  const score = (stat: { games: number, winRate: number } | null | undefined) =>
    (!stat?.games ? -1 : focus.value === 'win' ? weighedWinRate(stat) : stat.games)
  const primary = (id: number) => score(props.stats.get(id)?.primary)
  const secondary = (id: number) => score(props.stats.get(id)?.secondary)
  const bestOf = (ids: number[], by: (id: number) => number) => ids.reduce<number | null>((best, id) => (by(id) > (best === null ? -1 : by(best)) ? id : best), null)

  const keystone = bestOf(props.tree.styles.flatMap(style => style.keystones), primary)
  const tree = props.tree.styles.find(style => keystone !== null && style.keystones.includes(keystone))
  if (keystone === null || !tree) return null
  const runes = new Set<number>([keystone])
  for (const row of tree.subRows) {
    const best = bestOf(row, primary)
    if (best !== null) runes.add(best)
  }
  // The secondary tree whose two best runes, on two rows, score most together.
  const candidates = props.tree.styles.filter(style => style.styleId !== tree.styleId).map((style) => {
    const picks = style.subRows.map(row => bestOf(row, secondary)).filter((id): id is number => id !== null && secondary(id) >= 0)
      .sort((a, b) => secondary(b) - secondary(a)).slice(0, 2)
    return { picks, total: picks.reduce((sum, id) => sum + secondary(id), 0) }
  }).sort((a, b) => b.total - a.total)
  for (const id of candidates[0]?.picks ?? []) runes.add(id)
  const shards = props.tree.shardSlots.map((row, index) => bestOf(row, id => score(props.stats.get(index === 1 ? -id : id)?.primary)))
  return { runes, shards }
})
const dim = (id: number, _row: number[], flex = false, shardRow?: number) => {
  const page = litPage.value
  if (!page) return !of(id, flex)?.games
  return shardRow === undefined ? !page.runes.has(id) : page.shards[shardRow] !== id
}
const tone = (value: number) => (value >= 0.52 ? 'text-primary' : value < 0.48 ? 'text-error' : 'text-highlighted')
</script>

<template>
  <div class="space-y-3">
    <div class="grid grid-cols-3 overflow-hidden rounded-lg border border-default" role="tablist">
      <button v-for="option in (['overview', 'win', 'pick'] as const)" :key="option" type="button" role="tab" :aria-selected="focus === option" class="py-2 text-sm font-semibold transition-colors" :class="focus === option ? 'bg-primary/15 text-highlighted' : 'text-muted hover:bg-accented/40'" @click="focus = option">
        {{ t(`analytics.runes.focus.${option}`) }}
      </button>
    </div>
    <div class="flex gap-1.5">
      <UButton v-for="option in (['primary', 'secondary'] as const)" :key="option" :label="t(`analytics.runes.${option}`)" size="xs" :color="use === option ? 'primary' : 'neutral'" :variant="use === option ? 'soft' : 'ghost'" @click="use = option" />
    </div>
    <div class="flex gap-4 overflow-x-auto pb-1">
      <div v-for="style in tree.styles" :key="style.styleId" class="shrink-0 space-y-2 rounded-xl bg-accented/15 p-2">
        <div v-for="(row, index) in (use === 'primary' ? [style.keystones, ...style.subRows] : style.subRows)" :key="index" class="flex gap-1">
          <div v-for="id in row" :key="id" class="w-14 text-center leading-tight">
            <GameTooltipPerkIcon :perk="tree.perks[id] ?? null" :width="30" :height="30" class="mx-auto size-[30px] rounded-full transition" :class="dim(id, row) ? 'opacity-35 grayscale' : focus !== 'overview' ? 'selected-perk' : ''" />
            <template v-if="of(id)">
              <span class="block text-[11px] font-semibold tabular-nums" :class="litPage && dim(id, row) ? 'text-dimmed opacity-60' : tone(of(id)!.winRate)">{{ formatPercentage(of(id)!.winRate, 1) }}</span>
              <span class="block text-[10px] tabular-nums" :class="litPage && dim(id, row) ? 'text-dimmed opacity-60' : 'text-muted'">{{ formatPercentage(of(id)!.pickRate, 1) }}</span>
              <span class="block text-[10px] tabular-nums text-dimmed" :class="litPage && dim(id, row) ? 'opacity-60' : ''">{{ of(id)!.games.toLocaleString() }}</span>
            </template>
          </div>
        </div>
      </div>
      <div class="shrink-0 space-y-2 rounded-xl bg-accented/15 p-2">
        <p class="stat-label text-center">{{ t('analytics.runes.shards') }}</p>
        <div v-for="(row, index) in tree.shardSlots" :key="index" class="flex gap-1">
          <div v-for="id in row" :key="id" class="w-14 text-center leading-tight">
            <GameTooltipPerkIcon :perk="tree.perks[id] ?? null" :width="22" :height="22" class="mx-auto size-[22px] rounded-full transition" :class="dim(id, row, index === 1, index) ? 'opacity-35 grayscale' : focus !== 'overview' ? 'selected-perk' : ''" />
            <template v-if="of(id, index === 1)">
              <span class="block text-[11px] font-semibold tabular-nums" :class="litPage && dim(id, row, index === 1, index) ? 'text-dimmed opacity-60' : tone(of(id, index === 1)!.winRate)">{{ formatPercentage(of(id, index === 1)!.winRate, 1) }}</span>
              <span class="block text-[10px] tabular-nums" :class="litPage && dim(id, row, index === 1, index) ? 'text-dimmed opacity-60' : 'text-muted'">{{ formatPercentage(of(id, index === 1)!.pickRate, 1) }}</span>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
