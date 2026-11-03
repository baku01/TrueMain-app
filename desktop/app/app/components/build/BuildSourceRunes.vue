<script setup lang="ts">
import type { RuneTreeResponse } from '#shared/types/static-data'
import type { BuildOptions } from '~/utils/sources/model'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * The lane's runes as the source measured them: its most played pages as
 * tabs, each with its share and win rate, and under the picked one the whole
 * tree, the page's runes lit and the others faded. A source that counts runes
 * one by one (Blitz, lolalytics) puts each rune's share under it; one that
 * counts whole pages (op.gg) lights the page alone. The page shown is the one
 * the import button sends to the client.
 */
const props = defineProps<{
  options: BuildOptions
  tree: RuneTreeResponse
  champion: string | null
}>()

const { t } = useT()
const picked = ref(0)
watch(() => props.options, () => (picked.value = 0))

const shown = computed(() => props.options.pages[picked.value] ?? props.options.pages[0] ?? null)
const page = computed(() => shown.value?.page ?? null)
const primary = computed(() => props.tree.styles.find(style => style.styleId === page.value?.primaryStyleId) ?? null)
const secondary = computed(() => props.tree.styles.find(style => style.styleId === page.value?.secondaryStyleId) ?? null)
const shares = computed(() => (page.value && props.options.shares ? props.options.shares(page.value.primaryStyleId) : null))

const taken = computed(() => new Set(page.value
  ? [page.value.primaryKeystoneId, page.value.primaryPerk1Id, page.value.primaryPerk2Id, page.value.primaryPerk3Id, page.value.secondaryPerk1Id, page.value.secondaryPerk2Id]
  : []))
const shardTaken = (row: number, id: number) => page.value !== null && [page.value.statOffense, page.value.statFlex, page.value.statDefense][row] === id

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const percent = (value: number | undefined) => (value === undefined ? '' : formatPercentage(value, 0))
const tone = (value: number) => (value >= 0.52 ? 'text-primary' : value < 0.48 ? 'text-muted' : 'text-default')
</script>

<template>
  <section class="surface relative min-w-0 space-y-3 rounded-2xl p-3">
    <header class="flex items-center gap-2">
      <h3 class="stat-label">{{ t('panel.runes') }}</h3>
      <BuildRuneImport v-if="page && champion" :page="page" :champion="champion" class="ml-auto" />
    </header>

    <div class="mx-auto grid max-w-[24rem] grid-cols-3 gap-1.5" role="tablist">
      <button
        v-for="(option, index) in options.pages"
        :key="index"
        type="button"
        role="tab"
        :aria-selected="picked === index"
        :title="t('panel.games', { games: compact.format(option.games) })"
        class="flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left transition-colors"
        :class="picked === index ? 'bg-primary/10 ring-1 ring-inset ring-primary/50' : 'bg-accented/20 hover:bg-accented/50'"
        @click="picked = index"
      >
        <GameTooltipPerkIcon :perk="tree.perks[option.page.primaryKeystoneId] ?? null" :width="28" :height="28" class="size-7 shrink-0 rounded-full" />
        <span class="min-w-0 leading-tight">
          <span class="block text-[13px] font-semibold tabular-nums" :class="tone(option.winRate)">{{ percent(option.winRate) }}</span>
          <span class="block truncate text-[10px] tabular-nums text-dimmed">{{ percent(option.pickRate) }}</span>
        </span>
      </button>
    </div>

    <div v-if="primary && page" class="mx-auto grid max-w-[24rem] grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3">
      <div class="space-y-2 rounded-xl bg-accented/15 px-1 py-2">
        <div class="flex justify-center gap-1.5">
          <GameTooltipPerkIcon v-for="id in primary.keystones" :key="id" :perk="tree.perks[id] ?? null" :width="34" :height="34" class="size-[34px] rounded-full" :class="taken.has(id) ? 'selected-perk' : 'deselected'" />
        </div>
        <div v-for="(row, index) in primary.subRows" :key="index" class="flex justify-center gap-2.5">
          <div v-for="id in row" :key="id" class="flex w-8 flex-col items-center">
            <GameTooltipPerkIcon :perk="tree.perks[id] ?? null" :width="26" :height="26" class="size-[26px] rounded-full" :class="taken.has(id) ? 'selected-perk' : 'deselected'" />
            <span v-if="shares" class="text-[10px] leading-4 tabular-nums" :class="taken.has(id) ? 'font-semibold text-highlighted' : 'text-dimmed'">{{ percent(shares.primary.get(id)?.pickRate ?? 0) }}</span>
          </div>
        </div>
      </div>

      <div class="space-y-2 rounded-xl bg-accented/15 px-1 py-2">
        <template v-if="secondary">
          <div v-for="(row, index) in secondary.subRows" :key="index" class="flex justify-center gap-2">
            <div v-for="id in row" :key="id" class="flex w-7 flex-col items-center">
              <GameTooltipPerkIcon :perk="tree.perks[id] ?? null" :width="22" :height="22" class="size-[22px] rounded-full" :class="taken.has(id) ? 'selected-perk' : 'deselected'" />
              <span v-if="shares" class="text-[10px] leading-4 tabular-nums" :class="taken.has(id) ? 'font-semibold text-highlighted' : 'text-dimmed'">{{ percent(shares.secondary.get(id)?.pickRate ?? 0) }}</span>
            </div>
          </div>
        </template>
        <div class="mx-2 border-t border-default" />
        <div v-for="(row, index) in tree.shardSlots" :key="`shard-${index}`" class="flex justify-center gap-2">
          <div v-for="id in row" :key="id" class="flex w-7 flex-col items-center">
            <GameTooltipPerkIcon :perk="tree.perks[id] ?? null" :width="16" :height="16" class="size-4 rounded-full" :class="shardTaken(index, id) ? 'selected-perk' : 'deselected'" />
            <span v-if="shares" class="text-[10px] leading-4 tabular-nums" :class="shardTaken(index, id) ? 'font-semibold text-highlighted' : 'text-dimmed'">{{ percent(shares.shards[index]?.get(id)?.pickRate ?? 0) }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
