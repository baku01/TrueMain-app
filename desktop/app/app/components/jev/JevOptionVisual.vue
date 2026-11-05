<script setup lang="ts">
import type { JevOption } from '~/utils/jev-build'

/**
 * An option of the Jev page as its own picture, every icon with its tooltip,
 * in three sizes: `lg` for the build path's pick, `md` for the details table,
 * `sm` for an alternative under a step (a rune page down to its keystone and
 * second tree, a skill order down to its letters).
 */
const props = withDefaults(defineProps<{ option: JevOption, championId: number, size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })
const { t } = useT()
const { items, summoners, runeTree, championStatic } = useStaticData()
const PX = { sm: 24, md: 30, lg: 40 } as const
const px = computed(() => PX[props.size])
const timing = computed(() => (props.option.after === 0 ? t('jev.after.first') : t('jev.after.item', { item: props.option.after ?? 0 })))
</script>

<template>
  <span class="flex min-w-0 flex-wrap items-center gap-1">
    <template v-if="option.itemIds.length">
      <GameTooltipItemIcon v-for="(id, index) in option.itemIds" :key="`${id}-${index}`" :item="items[id] ?? null" :width="px" :height="px" class="rounded-md" />
    </template>
    <template v-else-if="option.page">
      <span v-if="size === 'sm'" class="flex items-center gap-0.5">
        <GameTooltipPerkIcon :perk="runeTree?.perks[option.page.primaryKeystoneId] ?? null" :width="24" :height="24" class="size-6 rounded-full bg-black/30" />
        <GameTooltipPerkStyleIcon :style="runeTree?.perkStyles[option.page.secondaryStyleId] ?? null" :width="14" :height="14" class="size-3.5" />
      </span>
      <JevRunePage v-else :page="option.page" />
    </template>
    <template v-else-if="option.spellIds">
      <GameTooltipSummonerSpellIcon v-for="id in option.spellIds" :key="id" :spell="summoners[id] ?? null" :width="size === 'sm' ? 20 : px - 6" :height="size === 'sm' ? 20 : px - 6" class="rounded-md" />
    </template>
    <template v-else-if="option.order">
      <span v-if="size === 'sm'" class="text-[10px] font-bold tracking-wide text-highlighted">{{ option.order.join('›') }}</span>
      <template v-else>
        <span v-for="(key, index) in option.order" :key="key" class="flex items-center gap-0.5">
          <UIcon v-if="index > 0" name="i-lucide-chevron-right" class="size-3 text-dimmed" />
          <span class="relative" :style="{ width: `${px - 10}px`, height: `${px - 10}px` }">
            <GameTooltipChampionSpellIcon :spell="championStatic(championId)?.championSpells[key] ?? null" :width="px - 10" :height="px - 10" :fallback-label="key" class="size-full rounded" />
            <span class="absolute -bottom-1 -right-1 rounded bg-default px-0.5 text-[9px] font-bold text-highlighted">{{ key }}</span>
          </span>
        </span>
      </template>
      <span v-if="option.opening && size !== 'sm'" class="w-full text-center text-[10px] tabular-nums text-muted">{{ t('jev.card.opening', { keys: option.opening.join(' ') }) }}</span>
    </template>
    <span v-else-if="option.after !== undefined" class="text-center font-semibold text-highlighted" :class="size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs'">{{ timing }}</span>
  </span>
</template>
