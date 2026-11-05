<script setup lang="ts">
import type { RunePageIds } from '~/utils/sources/model'

/**
 * A whole rune page in two short rows, every rune with its tooltip: the
 * keystone and the three runes of its tree, then the second tree's emblem, its
 * two runes and the three shards.
 */
defineProps<{ page: RunePageIds }>()
const { runeTree } = useStaticData()
</script>

<template>
  <span class="flex flex-col items-center gap-1">
    <span class="flex items-center gap-1">
      <GameTooltipPerkIcon :perk="runeTree?.perks[page.primaryKeystoneId] ?? null" :width="34" :height="34" class="size-[34px] rounded-full bg-black/30" />
      <GameTooltipPerkIcon v-for="id in [page.primaryPerk1Id, page.primaryPerk2Id, page.primaryPerk3Id]" :key="id" :perk="runeTree?.perks[id] ?? null" :width="22" :height="22" class="size-[22px] rounded-full bg-black/30" />
    </span>
    <span class="flex items-center gap-1">
      <GameTooltipPerkStyleIcon :style="runeTree?.perkStyles[page.secondaryStyleId] ?? null" :width="18" :height="18" class="size-[18px]" />
      <GameTooltipPerkIcon v-for="id in [page.secondaryPerk1Id, page.secondaryPerk2Id]" :key="id" :perk="runeTree?.perks[id] ?? null" :width="20" :height="20" class="size-5 rounded-full bg-black/30" />
      <span class="mx-0.5 h-3 w-px bg-default" aria-hidden="true" />
      <GameTooltipPerkIcon v-for="(id, index) in [page.statOffense, page.statFlex, page.statDefense]" :key="`shard-${index}`" :perk="runeTree?.perks[id] ?? null" :width="14" :height="14" class="size-3.5 rounded-full bg-black/40" />
    </span>
  </span>
</template>
