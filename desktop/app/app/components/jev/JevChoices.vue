<script setup lang="ts">
import type { JevOption } from '~/utils/jev-build'
import type { Parts, RankedSlot } from '~/utils/jev-recommend'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * Every choice of the build laid out as the analytics page lays a slot: a
 * panel per choice — the rune pages across the width, then the other lane
 * choices and the items in two columns — a card per option in it — its icons with their
 * tooltips, what lolalytics and Blitz measured (win rate, pick rate, games,
 * win probability added), the parts of its score (the statistics, the enemy
 * team, our champion's kit, the lane) and the needs it answers, then its total.
 * The recommended option stands out in the accent, the most played carries its
 * mark, and a row where the two part says so.
 */
const props = defineProps<{ ranked: RankedSlot[], championId: number }>()
const { t } = useT()
const { items, summoners, championStatic } = useStaticData()
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const tone = (value: number) => (value >= 0.52 ? 'text-primary' : value < 0.48 ? 'text-muted' : 'text-highlighted')
const percent = (value: number | undefined) => `${Math.round((value ?? 0) * 100)}%`
const signed = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
const wpaTone = (value: number) => (value >= 0.01 ? 'bg-primary/15 text-primary' : value <= -0.01 ? 'bg-error/10 text-error' : 'bg-accented/50 text-muted')
const slotLabel = (name: string) => (name.startsWith('item') ? t('jev.slot.item', { slot: name.slice(4) }) : t(`jev.slot.${name}`))
const timing = (option: JevOption) => (option.after === 0 ? t('jev.after.first') : t('jev.after.item', { item: option.after ?? 0 }))
/** The rune pages across the width, then two columns stacked apart: the other lane choices, and the items. */
const groups = computed(() => [
  [props.ranked.filter(entry => entry.slot.kind === 'runes')],
  [props.ranked.filter(entry => entry.slot.kind !== 'runes' && entry.slot.kind !== 'item'), props.ranked.filter(entry => entry.slot.kind === 'item')],
].map(group => group.filter(column => column.length)).filter(group => group.length))
const PART_ORDER: (keyof Parts)[] = ['stats', 'draft', 'kit', 'lane']
const partsOf = (parts: Parts) => PART_ORDER.filter(part => parts[part] !== undefined).map(part => ({ part, value: parts[part]! }))
const barTone = (value: number) => (value >= 0.6 ? 'bg-primary' : value <= 0.35 ? 'bg-error/70' : 'bg-(--ui-text-dimmed)')
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-for="(group, groupIndex) in groups" :key="groupIndex" class="grid items-start gap-2" :class="group.length > 1 ? 'xl:grid-cols-2' : ''">
      <div v-for="(column, columnIndex) in group" :key="columnIndex" class="flex min-w-0 flex-col gap-2">
    <div v-for="entry in column" :key="entry.slot.name" class="flex min-w-0 flex-col gap-2 rounded-xl bg-accented/15 p-2">
      <div class="flex items-center gap-2 px-1">
        <p class="text-sm font-semibold leading-tight text-highlighted">{{ slotLabel(entry.slot.name) }}</p>
        <UBadge v-if="entry.pick.key !== entry.standard.key" :label="t('jev.card.differs')" color="primary" variant="soft" size="sm" />
      </div>
      <ul class="flex flex-wrap gap-1.5">
        <li
          v-for="option in entry.slot.options"
          :key="option.key"
          class="relative flex shrink-0 flex-col items-center gap-1 rounded-lg px-2 pb-2 pt-2.5 text-center leading-tight transition-colors"
          :style="{ width: option.page ? '11.5rem' : '8rem' }"
          :class="option.key === entry.pick.key ? 'bg-primary/12 ring-1 ring-primary/50' : 'bg-accented/25'"
        >
          <UIcon v-if="option.key === entry.pick.key" name="i-tabler-sparkles" class="absolute left-1.5 top-1.5 size-3.5 text-primary" :aria-label="t('jev.card.jevPick')" />
          <UIcon v-if="option.key === entry.standard.key" name="i-tabler-database" class="absolute right-1.5 top-1.5 size-3.5 text-dimmed" :aria-label="t('jev.card.standardPick')" />
          <UBadge v-if="option.situational" :label="t('jev.card.situational')" color="warning" variant="subtle" size="xs" class="-mt-1" />
          <UBadge v-if="entry.scored[option.key]?.misfit" :label="t('jev.card.misfit')" color="error" variant="subtle" size="xs" class="-mt-1" :title="t('jev.card.misfitHint')" />

          <!-- The option's own picture, every icon with its tooltip. -->
          <span class="flex min-h-9 items-center justify-center gap-0.5">
            <template v-if="option.itemIds.length">
              <GameTooltipItemIcon v-for="id in option.itemIds" :key="id" :item="items[id] ?? null" :width="option.itemIds.length > 2 ? 28 : 36" :height="option.itemIds.length > 2 ? 28 : 36" class="rounded-md" />
            </template>
            <JevRunePage v-else-if="option.page" :page="option.page" />
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

          <!-- What was measured: win rate, pick rate and games, win probability added. -->
          <span v-if="option.games" class="text-[13px] font-semibold tabular-nums" :class="tone(option.winRate)">{{ formatPercentage(option.winRate, 1) }}</span>
          <span v-if="option.games" class="whitespace-nowrap text-[10px] tabular-nums text-dimmed">{{ formatPercentage(option.pickRate, 1) }} · {{ compact.format(option.games) }}</span>
          <span v-if="option.wpa !== null && option.wpa !== undefined" class="flex flex-wrap justify-center gap-1 text-[9px] font-semibold tabular-nums">
            <span class="rounded px-1 py-px" :class="wpaTone(option.wpa)" :title="t('jev.card.wpaHint')">WPA {{ signed(option.wpa) }}</span>
            <span v-if="option.vsWpa !== null && option.vsWpa !== undefined" class="rounded px-1 py-px" :class="wpaTone(option.vsWpa)" :title="t('jev.card.vsWpaHint', { games: option.vsGames ?? 0 })">{{ t('jev.card.vs') }} {{ signed(option.vsWpa) }}</span>
          </span>

          <!-- The parts of the score, each 0–100, and the needs the option answers. -->
          <span v-if="entry.scored[option.key]" class="flex w-full flex-col gap-0.5 pt-1">
            <span v-for="part in partsOf(entry.scored[option.key]!.parts)" :key="part.part" class="grid grid-cols-[3.4rem_minmax(0,1fr)_1.6rem] items-center gap-1 text-[9px] tabular-nums" :title="t(`jev.part.${part.part}.hint`)">
              <span class="truncate text-left text-muted">{{ t(`jev.part.${part.part}`) }}</span>
              <span class="h-1 overflow-hidden rounded-full bg-accented/70"><span class="block h-full rounded-full" :class="barTone(part.value)" :style="{ width: percent(part.value) }" /></span>
              <span class="text-right text-muted">{{ Math.round(part.value * 100) }}</span>
            </span>
          </span>
          <span v-if="entry.scored[option.key]?.answers.length" class="flex flex-wrap justify-center gap-1 text-[9px] font-semibold">
            <span v-for="answer in entry.scored[option.key]!.answers.slice(0, 3)" :key="answer.need" class="rounded bg-primary/15 px-1 py-px text-primary" :title="t('jev.card.answersHint')">{{ t(`jev.need.${answer.need}`) }}</span>
          </span>

          <span class="mt-auto flex w-full items-center gap-1.5 pt-1">
            <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-accented/70">
              <span class="block h-full rounded-full" :class="option.key === entry.pick.key ? 'bg-primary' : 'bg-(--ui-text-dimmed)'" :style="{ width: percent(entry.scored[option.key]?.total) }" />
            </span>
            <span class="text-[11px] font-semibold tabular-nums" :class="option.key === entry.pick.key ? 'text-primary' : 'text-muted'" :title="t('jev.card.totalHint')">{{ Math.round((entry.scored[option.key]?.total ?? 0) * 100) }}</span>
          </span>
        </li>
      </ul>
    </div>
      </div>
    </div>
  </div>
</template>
