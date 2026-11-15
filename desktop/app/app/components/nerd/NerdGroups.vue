<script setup lang="ts">
import type { GroupRate, NerdReport } from '~/utils/nerd-stats/analysis'
import { POSITION_BY_VALUE } from '#common/utils/positions'
import { groupConfidence, groupContrast } from '~/utils/nerd-stats/insights'

/**
 * The win rate by what the player chose — champion, lane, queue, keystone,
 * summoner spells, legendary items, side — each group's raw record with its
 * Wilson interval beside its empirical-Bayes estimate (`groupRates`): the raw
 * rate a hollow ring on its interval, the shrunk one a filled dot on its 95%
 * credible interval, both on a 0–100% track with the player's own rate (the
 * prior's mean) ruled across it. The prior is said above the table in plain
 * words — how many of the player's games each choice is pulled toward their
 * average by — and the best and worst choice of the kind first, with how far
 * each row can be trusted.
 */
const props = defineProps<{ report: NerdReport }>()

const { t } = useT()
const f = useNerdFormat()
const champions = useStaticChampionsById()
const { items, summoners, runeTree } = useStaticData()

type Kind = 'champions' | 'positions' | 'queues' | 'keystones' | 'spells' | 'items' | 'sides'
const KINDS: Kind[] = ['champions', 'positions', 'queues', 'keystones', 'spells', 'items', 'sides']
const kind = ref<Kind>('champions')
const kinds = computed(() => KINDS.map(value => ({ value, label: t(`nerd.groups.${value}`) })))

type Sort = 'games' | 'shrunk' | 'raw'
const sort = ref<Sort>('games')
const sorts = computed(() => (['games', 'shrunk', 'raw'] as const).map(value => ({ value, label: t(`nerd.groups.sort.${value}`) })))

const SHOWN = 15
const all = ref(false)
watch(kind, () => (all.value = false))

const group = computed(() => props.report[kind.value])
const sorted = computed(() => {
  const groups = [...group.value.groups]
  if (sort.value === 'shrunk') groups.sort((a, b) => b.shrunk.rate - a.shrunk.rate)
  if (sort.value === 'raw') groups.sort((a, b) => b.raw.rate - a.raw.rate || b.games - a.games)
  return groups
})
const shown = computed(() => (all.value ? sorted.value : sorted.value.slice(0, SHOWN)))

const best = computed(() => groupContrast(group.value))
const lead = computed(() => {
  const read = best.value
  if (!read) return ''
  return t('nerd.groups.say', {
    best: identity(read.best).name,
    bestRate: f.percent(read.best.shrunk.rate),
    bestGames: read.best.games,
    worst: identity(read.worst).name,
    worstRate: f.percent(read.worst.shrunk.rate),
    worstGames: read.worst.games,
  })
})
const symbols = computed(() => [
  { symbol: `p̃ = (${t('nerd.symbol.win')} + α) / (n + α + β)`, meaning: t('nerd.sym.shrunk') },
  { symbol: 'α', value: f.number(group.value.prior.alpha, 1), meaning: t('nerd.sym.alpha') },
  { symbol: 'β', value: f.number(group.value.prior.beta, 1), meaning: t('nerd.sym.betaPrior') },
  { symbol: 'α + β', value: f.number(group.value.prior.strength, 0), meaning: t('nerd.sym.strength') },
])

/** What a group is called and the icons it shows. */
function identity(entry: GroupRate): { name: string, icons: string[], round?: boolean } {
  const id = Number(entry.key)
  switch (kind.value) {
    case 'champions': {
      const champion = champions.value.get(id)
      return { name: champion?.name ?? `#${id}`, icons: champion?.iconUrl ? [champion.iconUrl] : [] }
    }
    case 'positions': {
      const position = POSITION_BY_VALUE.get(entry.key)
      return { name: position?.label ?? entry.key, icons: position ? [position.iconUrl] : [] }
    }
    case 'queues': return { name: t(`nerd.queueGroup.${entry.key}`), icons: [] }
    case 'keystones': {
      const perk = runeTree.value?.perks[id]
      return { name: perk?.name ?? `#${id}`, icons: perk ? [perk.iconUrl] : [], round: true }
    }
    case 'spells': {
      const spells = entry.key.split('+').map(spell => summoners.value[Number(spell)])
      return { name: spells.map(spell => spell?.name ?? '?').join(' + '), icons: spells.flatMap(spell => (spell ? [spell.iconUrl] : [])) }
    }
    case 'items': {
      const item = items.value[id]
      return { name: item?.name ?? `#${id}`, icons: item ? [item.iconUrl] : [] }
    }
    default: return { name: t(`nerd.side.${entry.key}`), icons: [] }
  }
}
</script>

<template>
  <section class="surface rounded-lg">
    <NerdCardHeader
      icon="i-tabler-chart-histogram"
      :title="t('nerd.groups.title')"
      :technical="t('nerd.groups.technical')"
      :subtitle="t('nerd.groups.prior', { strength: f.number(group.prior.strength, 0), mean: f.percent(group.prior.mean, 1) })"
    >
      <AppSegmented v-model="sort" :items="sorts" />
    </NerdCardHeader>

    <div class="space-y-3 p-4">
      <AppSegmented v-model="kind" :items="kinds" />
      <NerdLead v-if="lead && best" :text="lead" :confidence="groupConfidence(best.best, group.prior)" icon="i-tabler-trophy" />
      <div class="overflow-x-auto">
        <table class="w-full min-w-[66rem] text-xs">
          <thead class="text-dimmed">
            <tr class="text-left">
              <th class="pb-2 font-medium">{{ t(`nerd.groups.${kind}`) }}</th>
              <th class="pb-2 text-right font-medium">{{ t('nerd.col.games') }}</th>
              <th class="pb-2 text-right font-medium">{{ t('nerd.col.record') }}</th>
              <th class="pb-2 text-right font-medium">{{ t('nerd.groups.raw') }}</th>
              <th class="pb-2 text-right font-medium">{{ t('nerd.groups.shrunk') }}</th>
              <th class="w-[30%] px-4 pb-2 font-medium">
                <div class="relative h-3">
                  <span v-for="tick in [0, 0.25, 0.5, 0.75, 1]" :key="tick" class="absolute -translate-x-1/2 tabular-nums" :style="{ left: `${tick * 100}%` }">{{ f.percent(tick, 0) }}</span>
                </div>
              </th>
              <th class="pb-2 text-right font-medium">{{ t('nerd.confidence.label') }}</th>
              <th class="pb-2 text-right font-medium">KDA</th>
              <th class="pb-2 text-right font-medium">{{ t('nerd.col.score') }}</th>
              <th class="pb-2 text-right font-medium">LP</th>
            </tr>
          </thead>
          <TransitionGroup tag="tbody" move-class="transition-transform duration-300">
            <tr v-for="entry in shown" :key="`${kind}-${entry.key}`" class="border-t border-default/60 hover:bg-elevated/40">
              <td class="py-1.5 pr-3">
                <span class="flex min-w-0 items-center gap-2">
                  <SkeletonImage v-for="icon in identity(entry).icons" :key="icon" :src="icon" alt="" class="size-6 shrink-0" :class="identity(entry).round ? 'rounded-full' : 'rounded-md'" />
                  <span class="truncate font-medium text-highlighted">{{ identity(entry).name }}</span>
                </span>
              </td>
              <td class="py-1.5 text-right tabular-nums">{{ entry.games }}</td>
              <td class="py-1.5 text-right tabular-nums text-muted">{{ t('nerd.recordShort', { wins: entry.wins, losses: entry.games - entry.wins }) }}</td>
              <td class="py-1.5 text-right tabular-nums">
                {{ f.percent(entry.raw.rate, 0) }}
                <span class="block text-[10px] text-dimmed">{{ f.percent(entry.raw.low, 0) }}–{{ f.percent(entry.raw.high, 0) }}</span>
              </td>
              <td class="py-1.5 text-right tabular-nums">
                <b class="font-semibold text-highlighted">{{ f.percent(entry.shrunk.rate, 1) }}</b>
                <span class="block text-[10px] text-dimmed">{{ f.percent(entry.shrunk.low, 0) }}–{{ f.percent(entry.shrunk.high, 0) }}</span>
              </td>
              <td class="px-4 py-1.5">
                <div class="relative h-6" role="img" :aria-label="`${identity(entry).name}: ${f.percent(entry.raw.rate, 0)} → ${f.percent(entry.shrunk.rate, 1)}`">
                  <span class="absolute inset-y-0 left-1/2 w-px bg-(--ui-border)" />
                  <span class="absolute inset-y-0 w-px bg-(--ui-border-accented)" :style="{ left: `${group.prior.mean * 100}%` }" />
                  <span class="absolute top-[30%] h-px -translate-y-1/2 bg-(--ui-text-dimmed)" :style="{ left: `${entry.raw.low * 100}%`, width: `${(entry.raw.high - entry.raw.low) * 100}%` }" />
                  <span class="absolute top-[30%] size-2 -translate-1/2 rounded-full ring-[1.5px] ring-(--ui-text-muted) ring-inset" :style="{ left: `${entry.raw.rate * 100}%` }" />
                  <span class="absolute top-[70%] h-1.5 -translate-y-1/2 rounded-full bg-primary/30" :style="{ left: `${entry.shrunk.low * 100}%`, width: `${(entry.shrunk.high - entry.shrunk.low) * 100}%` }" />
                  <span class="absolute top-[70%] size-2.5 -translate-1/2 rounded-full bg-primary ring-2 ring-(--tm-pane)" :style="{ left: `${entry.shrunk.rate * 100}%` }" />
                </div>
              </td>
              <td class="py-1.5 text-right"><NerdConfidence :level="groupConfidence(entry, group.prior)" :detail="`${f.percent(entry.shrunk.low, 0)} – ${f.percent(entry.shrunk.high, 0)}`" /></td>
              <td class="py-1.5 text-right tabular-nums">{{ f.number(entry.kda, 2) }}</td>
              <td class="py-1.5 text-right tabular-nums text-muted">{{ entry.performance === null ? '—' : f.number(entry.performance, 0) }}</td>
              <td class="py-1.5 text-right tabular-nums text-muted">{{ entry.lp === null ? '—' : f.signed(entry.lp) }}</td>
            </tr>
          </TransitionGroup>
        </table>
      </div>
      <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-dimmed">
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-full ring-[1.5px] ring-(--ui-text-muted) ring-inset" />{{ t('nerd.groups.legendRaw') }}</span>
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-primary" />{{ t('nerd.groups.legendShrunk') }}</span>
        <span class="flex items-center gap-1.5"><span class="h-3 w-px bg-(--ui-border-accented)" />{{ t('nerd.groups.legendMean') }}</span>
        <UButton v-if="sorted.length > SHOWN" class="ml-auto" size="xs" color="neutral" variant="ghost" :label="all ? t('nerd.groups.less') : t('nerd.groups.more', { count: sorted.length - SHOWN })" @click="all = !all" />
      </div>
      <NerdHowTo :text="t('nerd.groups.how')" />
      <NerdDetails :symbols="symbols">
        <p class="text-[11px] leading-relaxed text-dimmed">{{ t('nerd.groups.hint') }}</p>
      </NerdDetails>
    </div>
  </section>
</template>
