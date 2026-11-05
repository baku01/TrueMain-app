<script setup lang="ts">
import type { JevDecision, JevOption } from '~/utils/jev-build'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * Every choice of the Jev build laid out as the analytics page lays a slot: a
 * row per choice, a card per option centred under it — its icons, each with
 * its tooltip (item, rune, tree, summoner spell, ability), the source's win
 * rate, pick rate and games, and Jev's probability as a bar. Jev's pick stands
 * out in the accent, the source's most played carries its mark, and a row
 * where the two part says so.
 */
defineProps<{ decisions: JevDecision[], championId: number }>()
const { t } = useT()
const { items, summoners, runeTree, championStatic } = useStaticData()
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const tone = (value: number) => (value >= 0.52 ? 'text-primary' : value < 0.48 ? 'text-muted' : 'text-highlighted')
const percent = (value: number | undefined) => `${Math.round((value ?? 0) * 100)}%`
const slotLabel = (name: string) => (name.startsWith('item') ? t('jev.slot.item', { slot: name.slice(4) }) : t(`jev.slot.${name}`))
const timing = (option: JevOption) => (option.after === 0 ? t('jev.after.first') : t('jev.after.item', { item: option.after ?? 0 }))
</script>

<template>
  <div class="space-y-2">
    <div v-for="decision in decisions" :key="decision.slot.name" class="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl bg-accented/15 p-2">
      <div class="flex flex-col items-center gap-1 text-center">
        <p class="text-sm font-semibold leading-tight text-highlighted">{{ slotLabel(decision.slot.name) }}</p>
        <p v-if="decision.answer" class="text-[11px] tabular-nums text-muted">{{ t('jev.card.confidence', { value: percent(decision.answer.confidence) }) }}</p>
        <UBadge v-if="decision.jev.key !== decision.standard.key" :label="t('jev.card.differs')" color="primary" variant="soft" size="sm" />
      </div>
      <ul class="flex justify-center gap-1.5 overflow-x-auto pb-1">
        <li
          v-for="option in decision.slot.options"
          :key="option.key"
          class="relative flex w-[7.5rem] shrink-0 flex-col items-center gap-1 rounded-lg px-1.5 pb-2 pt-2.5 text-center leading-tight transition-colors"
          :class="option.key === decision.jev.key ? 'bg-primary/12 ring-1 ring-primary/50' : 'bg-accented/25'"
        >
          <UIcon v-if="option.key === decision.jev.key" name="i-tabler-sparkles" class="absolute left-1.5 top-1.5 size-3.5 text-primary" :aria-label="t('jev.card.jevPick')" />
          <UIcon v-if="option.key === decision.standard.key" name="i-tabler-database" class="absolute right-1.5 top-1.5 size-3.5 text-dimmed" :aria-label="t('jev.card.standardPick')" />

          <!-- The option's own picture, every icon with its tooltip. -->
          <span class="flex min-h-9 items-center justify-center gap-0.5">
            <template v-if="option.itemIds.length">
              <GameTooltipItemIcon v-for="id in option.itemIds" :key="id" :item="items[id] ?? null" :width="option.itemIds.length > 2 ? 28 : 36" :height="option.itemIds.length > 2 ? 28 : 36" class="rounded-md" />
            </template>
            <template v-else-if="option.page">
              <GameTooltipPerkIcon :perk="runeTree?.perks[option.page.primaryKeystoneId] ?? null" :width="36" :height="36" class="size-9 rounded-full bg-black/30" />
              <GameTooltipPerkStyleIcon :style="runeTree?.perkStyles[option.page.secondaryStyleId] ?? null" :width="26" :height="26" class="size-[26px]" />
            </template>
            <template v-else-if="option.spellIds">
              <GameTooltipSummonerSpellIcon v-for="id in option.spellIds" :key="id" :spell="summoners[id] ?? null" :width="36" :height="36" class="size-9 rounded-md" />
            </template>
            <template v-else-if="option.order">
              <span v-for="(key, index) in option.order" :key="key" class="flex items-center gap-0.5">
                <UIcon v-if="index > 0" name="i-lucide-chevron-right" class="size-3 text-dimmed" />
                <span class="relative size-7">
                  <GameTooltipChampionSpellIcon :spell="championStatic(championId)?.championSpells[key] ?? null" :width="28" :height="28" :fallback-label="key" class="size-7 rounded" />
                  <span class="absolute -bottom-1 -right-1 rounded bg-default px-0.5 text-[9px] font-bold text-highlighted">{{ key }}</span>
                </span>
              </span>
            </template>
            <span v-else-if="option.after !== undefined" class="text-xs font-semibold text-highlighted">{{ timing(option) }}</span>
          </span>
          <span v-if="option.opening" class="text-[10px] tabular-nums text-muted">{{ t('jev.card.opening', { keys: option.opening.join(' ') }) }}</span>

          <span v-if="option.games" class="text-[13px] font-semibold tabular-nums" :class="tone(option.winRate)">{{ formatPercentage(option.winRate, 1) }}</span>
          <span v-if="option.games" class="whitespace-nowrap text-[10px] tabular-nums text-dimmed">{{ formatPercentage(option.pickRate, 1) }} · {{ compact.format(option.games) }}</span>
          <span class="mt-auto flex w-full items-center gap-1.5 pt-1">
            <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-accented/70">
              <span class="block h-full rounded-full" :class="option.key === decision.jev.key ? 'bg-primary' : 'bg-(--ui-text-dimmed)'" :style="{ width: percent(decision.answer?.probabilities[option.key]) }" />
            </span>
            <span class="text-[11px] font-semibold tabular-nums" :class="option.key === decision.jev.key ? 'text-primary' : 'text-muted'">{{ decision.answer ? percent(decision.answer.probabilities[option.key]) : '—' }}</span>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
