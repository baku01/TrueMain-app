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
const chip = (value: number) => (value >= 0.52 ? 'bg-primary/15 text-primary' : value < 0.48 ? 'bg-accented text-muted' : 'bg-accented text-highlighted')

/** Each tree's own colour, the game's: the ring a picked rune wears in it. */
const TREE_COLORS: Record<number, string> = { 8000: '#c8aa6e', 8100: '#d44242', 8200: '#9faafc', 8300: '#49aab9', 8400: '#a1d586' }
const ringOf = (styleId: number | undefined) => ({ '--rune': TREE_COLORS[styleId ?? 0] ?? 'var(--ui-primary)' })
/** Each rune's share on its row, under it, when the source counts runes one by one. */
const shareOf = (map: Map<number, { pickRate: number }> | undefined, id: number) => (shares.value ? percent(map?.get(id)?.pickRate ?? 0) : null)
</script>

<template>
  <section class="surface relative min-w-0 space-y-3 rounded-2xl p-3">
    <header class="flex items-center gap-2">
      <h3 class="stat-label">{{ t('panel.runes') }}</h3>
      <BuildRuneImport v-if="page && champion" :page="page" :champion="champion" class="ml-auto" />
    </header>

    <!-- The pages the source measured, as Blitz shows them: the keystone, the win rate in a chip, the games. -->
    <div class="grid gap-1.5" :style="{ gridTemplateColumns: `repeat(${Math.min(options.pages.length, 3)}, minmax(0, 1fr))` }" role="tablist">
      <button
        v-for="(option, index) in options.pages"
        :key="index"
        type="button"
        role="tab"
        :aria-selected="picked === index"
        class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors"
        :class="picked === index ? 'bg-primary/10 ring-1 ring-inset ring-primary/50' : 'bg-accented/25 hover:bg-accented/50'"
        @click="picked = index"
      >
        <GameTooltipPerkIcon :perk="tree.perks[option.page.primaryKeystoneId] ?? null" :width="30" :height="30" class="size-[30px] shrink-0 rounded-full" />
        <span class="min-w-0 leading-tight">
          <span class="inline-block rounded px-1 text-[12px] font-bold tabular-nums" :class="chip(option.winRate)">{{ percent(option.winRate) }}</span>
          <span class="block truncate text-[10px] tabular-nums text-dimmed" :title="t('panel.games', { games: compact.format(option.games) })">{{ compact.format(option.games) }}</span>
        </span>
      </button>
    </div>

    <div v-if="primary && page" class="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2.5">
      <!-- The primary tree: its name, its keystones, its three rows. -->
      <div class="space-y-3 rounded-xl bg-accented/20 px-2 pb-3 pt-2" :style="ringOf(primary.styleId)">
        <p class="flex items-center justify-center gap-1.5 text-xs font-semibold" :style="{ color: 'var(--rune)' }">
          <img :src="primary.iconUrl" alt="" width="16" height="16" class="size-4">{{ primary.name }}
        </p>
        <div class="flex justify-center gap-1">
          <GameTooltipPerkIcon v-for="id in primary.keystones" :key="id" :perk="tree.perks[id] ?? null" :width="40" :height="40" class="rune size-10 rounded-full" :class="taken.has(id) ? 'tm-rune-on' : 'tm-rune-off'" />
        </div>
        <div v-for="(row, index) in primary.subRows" :key="index" class="flex justify-center gap-2">
          <div v-for="id in row" :key="id" class="flex w-9 flex-col items-center gap-0.5">
            <GameTooltipPerkIcon :perk="tree.perks[id] ?? null" :width="30" :height="30" class="rune size-[30px] rounded-full" :class="taken.has(id) ? 'tm-rune-on' : 'tm-rune-off'" />
            <span v-if="shares" class="text-[10px] leading-3 tabular-nums" :class="taken.has(id) ? 'font-semibold text-highlighted' : 'text-dimmed'">{{ shareOf(shares.primary, id) }}</span>
          </div>
        </div>
      </div>

      <!-- The secondary tree and, under it, the shards. -->
      <div class="space-y-3 rounded-xl bg-accented/20 px-2 pb-3 pt-2" :style="ringOf(secondary?.styleId)">
        <template v-if="secondary">
          <p class="flex items-center justify-center gap-1.5 text-xs font-semibold" :style="{ color: 'var(--rune)' }">
            <img :src="secondary.iconUrl" alt="" width="16" height="16" class="size-4">{{ secondary.name }}
          </p>
          <div v-for="(row, index) in secondary.subRows" :key="index" class="flex justify-center gap-1.5">
            <div v-for="id in row" :key="id" class="flex w-8 flex-col items-center gap-0.5">
              <GameTooltipPerkIcon :perk="tree.perks[id] ?? null" :width="26" :height="26" class="rune size-[26px] rounded-full" :class="taken.has(id) ? 'tm-rune-on' : 'tm-rune-off'" />
              <span v-if="shares" class="text-[10px] leading-3 tabular-nums" :class="taken.has(id) ? 'font-semibold text-highlighted' : 'text-dimmed'">{{ shareOf(shares.secondary, id) }}</span>
            </div>
          </div>
        </template>
        <div class="mx-3 border-t border-default/70" />
        <div v-for="(row, index) in tree.shardSlots" :key="`shard-${index}`" class="flex justify-center gap-1.5" :style="{ '--rune': 'var(--ui-primary)' }">
          <div v-for="id in row" :key="id" class="flex w-8 flex-col items-center gap-0.5">
            <GameTooltipPerkIcon :perk="tree.perks[id] ?? null" :width="20" :height="20" class="rune size-5 rounded-full" :class="shardTaken(index, id) ? 'tm-rune-on' : 'tm-rune-off'" />
            <span v-if="shares" class="text-[10px] leading-3 tabular-nums" :class="shardTaken(index, id) ? 'font-semibold text-highlighted' : 'text-dimmed'">{{ shareOf(shares.shards[index], id) }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<!-- Not scoped: the icon is a child component, which a scoped rule would not reach. -->
<style>
/* A picked rune wears its tree's colour as a ring and a soft glow; the others stand back in grey. */
.tm-rune-on {
  box-shadow: 0 0 0 2px var(--rune), 0 0 12px -2px var(--rune);
}
.tm-rune-off {
  filter: grayscale(1);
  opacity: 0.35;
  transition: opacity 120ms, filter 120ms;
}
.tm-rune-off:hover {
  filter: none;
  opacity: 0.9;
}
</style>
