<script setup lang="ts">
import type { JevDecision, JevOption } from '~/utils/jev-build'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * Every choice of the Jev build laid out as the analytics page lays a slot: a
 * row per choice, a card per option — its icon, the source's win rate, pick
 * rate and games, and Jev's probability as a bar. Jev's pick stands out in the
 * accent, the source's most played carries its mark, and a row where the two
 * part says so.
 */
defineProps<{ decisions: JevDecision[] }>()
const { t } = useT()
const { items, summoners, runeTree } = useStaticData()
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const tone = (value: number) => (value >= 0.52 ? 'text-primary' : value < 0.48 ? 'text-muted' : 'text-highlighted')
const percent = (value: number | undefined) => `${Math.round((value ?? 0) * 100)}%`
const slotLabel = (name: string) => (name.startsWith('item') ? t('jev.slot.item', { slot: name.slice(4) }) : t(`jev.slot.${name}`))

/** The option's own picture: its items, its keystone and second tree, its spells. */
function icons(option: JevOption): { src: string, alt: string, round?: boolean }[] {
  if (option.itemIds.length) return option.itemIds.map(id => ({ src: items.value[id]?.iconUrl ?? '', alt: items.value[id]?.name ?? '' }))
  if (option.page) {
    const tree = runeTree.value
    return [
      { src: tree?.perks[option.page.primaryKeystoneId]?.iconUrl ?? '', alt: tree?.perks[option.page.primaryKeystoneId]?.name ?? '', round: true },
      { src: tree?.perkStyles[option.page.secondaryStyleId]?.iconUrl ?? '', alt: tree?.perkStyles[option.page.secondaryStyleId]?.name ?? '', round: true },
    ]
  }
  if (option.spellIds) return option.spellIds.map(id => ({ src: summoners.value[id]?.iconUrl ?? '', alt: summoners.value[id]?.name ?? '' }))
  return []
}

/** What the card says under its picture: the skill order, the boots' moment, else nothing (the picture names it). */
function caption(option: JevOption): string | null {
  if (option.order) return option.order.join(' › ')
  if (option.after !== undefined) return option.after === 0 ? t('jev.after.first') : t('jev.after.item', { item: option.after })
  return null
}
</script>

<template>
  <div class="space-y-2">
    <div v-for="decision in decisions" :key="decision.slot.name" class="grid grid-cols-[7.5rem_minmax(0,1fr)] items-stretch gap-3 rounded-xl bg-accented/15 p-2">
      <div class="flex flex-col justify-center gap-1 px-1">
        <p class="text-sm font-semibold text-highlighted">{{ slotLabel(decision.slot.name) }}</p>
        <p v-if="decision.answer" class="text-[11px] tabular-nums text-muted">{{ t('jev.card.confidence', { value: percent(decision.answer.confidence) }) }}</p>
        <UBadge v-if="decision.jev.key !== decision.standard.key" :label="t('jev.card.differs')" color="primary" variant="soft" size="sm" class="w-fit" />
      </div>
      <ul class="flex gap-1.5 overflow-x-auto pb-1">
        <li
          v-for="option in decision.slot.options"
          :key="option.key"
          class="relative flex w-[7.5rem] shrink-0 flex-col items-center gap-1 rounded-lg px-1.5 pb-2 pt-2.5 text-center leading-tight transition-colors"
          :class="option.key === decision.jev.key ? 'bg-primary/12 ring-1 ring-primary/50' : 'bg-accented/25'"
          :title="option.label"
        >
          <UIcon v-if="option.key === decision.jev.key" name="i-tabler-sparkles" class="absolute left-1.5 top-1.5 size-3.5 text-primary" :aria-label="t('jev.card.jevPick')" />
          <UIcon v-if="option.key === decision.standard.key" name="i-tabler-database" class="absolute right-1.5 top-1.5 size-3.5 text-dimmed" :aria-label="t('jev.card.standardPick')" />
          <span class="flex min-h-9 items-center gap-0.5">
            <template v-if="option.itemIds.length">
              <GameTooltipItemIcon v-for="id in option.itemIds" :key="id" :item="items[id] ?? null" :width="option.itemIds.length > 2 ? 28 : 36" :height="option.itemIds.length > 2 ? 28 : 36" class="rounded-md" />
            </template>
            <template v-else>
              <img v-for="(icon, index) in icons(option)" :key="index" :src="icon.src" :alt="icon.alt" :title="icon.alt" class="size-9 object-contain" :class="icon.round ? 'rounded-full bg-black/30 p-0.5' : 'rounded-md'">
            </template>
          </span>
          <span v-if="caption(option)" class="text-xs font-semibold text-highlighted">{{ caption(option) }}</span>
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
