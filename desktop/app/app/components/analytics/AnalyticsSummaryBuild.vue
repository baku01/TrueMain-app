<script setup lang="ts">
import type { ChampionStaticData, RuneTreeResponse, StaticItemData, StaticSummonerSpellData } from '#shared/types/static-data'
import type { SummaryBuild } from '~/utils/sources/analytics'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * The build the page opens on, in two versions: the one that wins most and
 * the one most played. Left, the skill priority, spells and starting items;
 * centre, the skill order level by level; right, the rune page with its
 * shards; across the bottom, the core and the options for each item after it
 * — each with its win rate and games.
 */
const props = defineProps<{
  summary: { common: SummaryBuild | null, winning: SummaryBuild | null }
  championStatic: ChampionStaticData | null
  items: Record<number, StaticItemData>
  summoners: Record<number, StaticSummonerSpellData>
  runeTree: RuneTreeResponse | null
}>()

const { t } = useT()
const mode = ref<'winning' | 'common'>('winning')
const build = computed(() => props.summary[mode.value] ?? props.summary.common ?? props.summary.winning)

const spell = (key: string) => props.championStatic?.championSpells[key] ?? null
const page = computed(() => build.value?.runes?.page ?? null)
const primary = computed(() => props.runeTree?.styles.find(style => style.keystones.includes(page.value?.primaryKeystoneId ?? -1)) ?? null)
const secondary = computed(() => props.runeTree?.styles.find(style => style.styleId !== primary.value?.styleId && style.subRows.flat().includes(page.value?.secondaryPerk1Id ?? -1)) ?? null)
const taken = computed(() => new Set(page.value ? [page.value.primaryKeystoneId, page.value.primaryPerk1Id, page.value.primaryPerk2Id, page.value.primaryPerk3Id, page.value.secondaryPerk1Id, page.value.secondaryPerk2Id] : []))
const shards = computed(() => (page.value ? [page.value.statOffense, page.value.statFlex, page.value.statDefense] : []))

const rate = (value: number) => formatPercentage(value, 2)
const line = (measure: { winRate: number, games: number } | null) => (measure ? t('analytics.summary.line', { rate: rate(measure.winRate), games: measure.games.toLocaleString() }) : '')
</script>

<template>
  <section v-if="build" class="surface overflow-hidden rounded-2xl">
    <div class="grid grid-cols-2 border-b border-default" role="tablist">
      <button
        v-for="option in (['winning', 'common'] as const)"
        :key="option"
        type="button"
        role="tab"
        :aria-selected="mode === option"
        class="py-2.5 text-sm font-semibold transition-colors"
        :class="mode === option ? 'bg-primary/15 text-highlighted shadow-[inset_0_-2px_0_var(--ui-primary)]' : 'text-muted hover:bg-accented/40'"
        @click="mode = option"
      >
        {{ t(`analytics.summary.${option}`) }}
      </button>
    </div>

    <div class="@container grid gap-6 p-4 @5xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,19rem)]">
      <div class="space-y-5 text-center">
        <div v-if="build.skillPriority">
          <h3 class="text-sm font-semibold text-highlighted">{{ t('analytics.summary.skillPriority') }}</h3>
          <div class="mt-2 flex items-center justify-center gap-1.5">
            <template v-for="(key, index) in build.skillPriority.order" :key="key">
              <div class="relative size-10"><GameTooltipChampionSpellIcon :spell="spell(key)" :width="40" :height="40" class="size-10 rounded" /><ItemRankBadge :value="key" /></div>
              <UIcon v-if="index < build.skillPriority.order.length - 1" name="i-lucide-chevron-right" class="size-4 text-dimmed" />
            </template>
          </div>
          <p class="mt-1 text-xs text-muted">{{ line(build.skillPriority) }}</p>
        </div>
        <div v-if="build.spells">
          <h3 class="text-sm font-semibold text-highlighted">{{ t('analytics.summary.spells') }}</h3>
          <div class="mt-2 flex justify-center gap-1.5"><GameTooltipSummonerSpellIcon v-for="id in build.spells.spellIds" :key="id" :spell="summoners[id] ?? null" :width="40" :height="40" class="size-10 rounded" /></div>
          <p class="mt-1 text-xs text-muted">{{ line(build.spells) }}</p>
        </div>
        <div v-if="build.starters">
          <h3 class="text-sm font-semibold text-highlighted">{{ t('analytics.summary.starters') }}</h3>
          <div class="mt-2 flex justify-center gap-1.5"><GameTooltipItemIcon v-for="(id, index) in build.starters.itemIds" :key="index" :item="items[id] ?? null" :width="40" :height="40" class="size-10 rounded" /></div>
          <p class="mt-1 text-xs text-muted">{{ line(build.starters) }}</p>
        </div>
      </div>

      <div class="min-w-0 text-center">
        <h3 class="text-sm font-semibold text-highlighted">{{ t('analytics.summary.skillOrder') }}</h3>
        <div v-if="build.skillOrder && championStatic" class="mt-2">
          <BuildSkillGrid :skill-order="build.skillPriority ? { sequence: build.skillPriority.order, games: build.skillPriority.games, pickRate: 0, winRate: build.skillPriority.winRate } : null" :points="build.skillOrder.points" :champion-static="championStatic" grid-only />
          <p class="mt-1 text-xs text-muted">{{ line(build.skillOrder) }}</p>
        </div>
        <p v-else class="mt-2 text-sm text-dimmed">—</p>
      </div>

      <div v-if="page && runeTree" class="text-center">
        <div class="grid grid-cols-[1fr_1fr_auto] gap-3">
          <div>
            <h3 class="text-sm font-semibold text-highlighted">{{ t('analytics.summary.primary') }}</h3>
            <div v-if="primary" class="mt-2 space-y-1.5">
              <div class="flex justify-center gap-1"><GameTooltipPerkIcon v-for="id in primary.keystones" :key="id" :perk="runeTree.perks[id] ?? null" :width="26" :height="26" class="size-[26px] rounded-full" :class="taken.has(id) ? 'selected-perk' : 'deselected'" /></div>
              <div v-for="(row, index) in primary.subRows" :key="index" class="flex justify-center gap-1"><GameTooltipPerkIcon v-for="id in row" :key="id" :perk="runeTree.perks[id] ?? null" :width="24" :height="24" class="size-6 rounded-full" :class="taken.has(id) ? 'selected-perk' : 'deselected'" /></div>
            </div>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-highlighted">{{ t('analytics.summary.secondary') }}</h3>
            <div v-if="secondary" class="mt-2 space-y-1.5">
              <div v-for="(row, index) in secondary.subRows" :key="index" class="flex justify-center gap-1"><GameTooltipPerkIcon v-for="id in row" :key="id" :perk="runeTree.perks[id] ?? null" :width="24" :height="24" class="size-6 rounded-full" :class="taken.has(id) ? 'selected-perk' : 'deselected'" /></div>
            </div>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-highlighted">{{ t('analytics.summary.shards') }}</h3>
            <div class="mt-2 space-y-1.5">
              <div v-for="(row, index) in runeTree.shardSlots" :key="index" class="flex justify-center gap-1"><GameTooltipPerkIcon v-for="id in row" :key="id" :perk="runeTree.perks[id] ?? null" :width="20" :height="20" class="size-5 rounded-full" :class="shards[index] === id ? 'selected-perk' : 'deselected'" /></div>
            </div>
          </div>
        </div>
        <p class="mt-2 text-xs text-muted">{{ line(build.runes) }}</p>
      </div>

      <div class="flex flex-wrap items-start justify-center gap-x-8 gap-y-4 border-t border-default pt-4 @5xl:col-span-3">
        <div v-if="build.core" class="text-center">
          <h3 class="text-sm font-semibold text-highlighted">{{ t('analytics.summary.core') }}</h3>
          <div class="mt-2 flex items-center gap-1.5">
            <template v-for="(id, index) in build.core.itemIds" :key="index">
              <GameTooltipItemIcon :item="items[id] ?? null" :width="40" :height="40" class="size-10 rounded" />
              <UIcon v-if="index < build.core.itemIds.length - 1" name="i-lucide-chevron-right" class="size-4 text-dimmed" />
            </template>
          </div>
          <p class="mt-1 text-xs text-muted">{{ line(build.core) }}</p>
        </div>
        <div v-for="group in build.after" :key="group.slot" class="text-center">
          <h3 class="text-sm font-semibold text-highlighted">{{ t('analytics.slot', { slot: group.slot }) }}</h3>
          <div class="mt-2 flex items-start gap-1.5">
            <template v-for="(option, index) in group.options.slice(0, 3)" :key="option.itemId">
              <span v-if="index" class="mt-3 text-[10px] font-semibold text-dimmed">{{ t('analytics.summary.or') }}</span>
              <div class="w-16">
                <GameTooltipItemIcon :item="items[option.itemId] ?? null" :width="40" :height="40" class="mx-auto size-10 rounded" />
                <p class="mt-0.5 text-xs font-semibold tabular-nums" :class="option.winRate >= 0.5 ? 'text-primary' : 'text-error'">{{ rate(option.winRate) }}</p>
                <p class="text-[10px] tabular-nums text-dimmed">{{ option.games.toLocaleString() }}</p>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
