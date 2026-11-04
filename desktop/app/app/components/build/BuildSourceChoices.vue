<script setup lang="ts">
import type { StaticItemData, StaticSummonerSpellData } from '#shared/types/static-data'
import type { Measure } from '~/utils/blitz/options'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * One group of the Blitz build panel as compact choices, the most played
 * first: each choice's icons with its win rate under them and, smaller, its
 * share and games. `tiles` lays them side by side, sized to their icons, so a
 * group of three takes the width of three icons rather than of the card;
 * `rows` stacks them, for a core path drawn with `arrows`. `selectable` makes
 * a choice a button (the core whose follow-ups show). A choice with a `note`
 * is the draft's recommendation: lit, its reason in its tooltip and under the
 * group. `bare` drops the card, for a group set inside another.
 */
const props = defineProps<{
  title: string
  options: (Measure & { itemIds?: number[], spellIds?: number[], note?: string })[]
  layout?: 'tiles' | 'rows'
  items?: Record<number, StaticItemData>
  summoners?: Record<number, StaticSummonerSpellData>
  selectable?: boolean
  arrows?: boolean
  bare?: boolean
  iconSize?: number
  /** Tiles that share the group's width in equal columns, as many as fit at a legible width, rather than sizing to their icons. */
  fill?: boolean
}>()

const selected = defineModel<number>('selected', { default: 0 })

const { t } = useT()
const size = computed(() => props.iconSize ?? 32)
const icon = computed(() => ({ width: `${size.value}px`, height: `${size.value}px` }))
const note = computed(() => props.options.find(option => option.note)?.note ?? null)
const percent = (value: number, digits = 1) => formatPercentage(value, digits)
/** Hundreds of thousands of games read as `396.9K`: the figure is a sample size, not a count to read digit by digit. */
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const tone = (value: number) => (value >= 0.52 ? 'text-primary' : value < 0.48 ? 'text-muted' : 'text-highlighted')
/** The win rate's chip in a row: the accent above even, muted below. */
const chip = (value: number) => (value >= 0.52 ? 'bg-primary/15 text-primary' : value < 0.48 ? 'bg-accented text-muted' : 'bg-accented text-highlighted')
const lit = (index: number, option: { note?: string }) => !!option.note || (props.selectable && selected.value === index)
</script>

<template>
  <section :class="bare ? 'min-w-0' : 'surface min-w-0 rounded-2xl p-3'">
    <h3 class="mb-2 stat-label">{{ title }}</h3>
    <p v-if="!options.length" class="text-xs text-dimmed">{{ t('common.noData') }}</p>

    <ul
      :class="layout === 'rows' ? 'space-y-1' : fill ? 'grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-1.5' : 'flex flex-wrap gap-1.5'"
    >
      <li v-for="(option, index) in options" :key="index">
        <component
          :is="selectable ? 'button' : 'div'"
          :type="selectable ? 'button' : undefined"
          :title="option.note || undefined"
          class="relative rounded-lg transition-colors"
          :class="[
            layout === 'rows' ? 'flex w-full items-center gap-3 px-2.5 py-2 text-left' : 'flex flex-col items-center gap-1 px-2 pb-1.5 pt-2',
            fill && layout !== 'rows' ? 'w-full px-1' : '',
            lit(index, option) ? 'bg-primary/10 ring-1 ring-inset ring-primary/50' : index === 0 && !selectable ? 'bg-accented/50' : 'bg-accented/20',
            selectable ? 'hover:bg-accented/60' : '',
          ]"
          @click="selectable && (selected = index)"
        >
          <UIcon v-if="option.note" name="i-lucide-sparkles" class="absolute -right-1 -top-1 size-3.5 rounded-full bg-default text-primary" />
          <span class="flex items-center gap-1" :class="layout === 'rows' ? 'shrink-0' : ''">
            <template v-for="(id, position) in option.itemIds ?? []" :key="`i-${position}`">
              <GameTooltipItemIcon :item="items?.[id] ?? null" :width="size" :height="size" class="shrink-0 rounded-md" :style="icon" />
              <UIcon v-if="arrows && position < (option.itemIds?.length ?? 0) - 1" name="i-lucide-chevron-right" class="size-3.5 shrink-0 text-dimmed" />
            </template>
            <GameTooltipSummonerSpellIcon v-for="id in option.spellIds ?? []" :key="`s-${id}`" :spell="summoners?.[id] ?? null" :width="size" :height="size" class="shrink-0 rounded-md" :style="icon" />
          </span>
          <!-- A row reads like Blitz's: the win rate in a chip, then the games and the share. -->
          <span v-if="layout === 'rows'" class="ml-auto flex min-w-0 items-center gap-2 whitespace-nowrap">
            <span class="rounded px-1.5 py-0.5 text-xs font-bold tabular-nums" :class="chip(option.winRate)">{{ percent(option.winRate) }}</span>
            <span class="min-w-[4.75rem] text-right text-[11px] leading-tight tabular-nums text-muted">
              {{ t('panel.games', { games: compact.format(option.games) }) }}
              <span class="block text-[10px] text-dimmed">{{ percent(option.pickRate, 0) }}</span>
            </span>
          </span>
          <span v-else class="whitespace-nowrap text-center leading-tight">
            <span class="block text-[13px] font-semibold tabular-nums" :class="tone(option.winRate)">{{ percent(option.winRate) }}</span>
            <span class="block text-[10px] tabular-nums text-dimmed">{{ percent(option.pickRate, 0) }} · {{ compact.format(option.games) }}</span>
          </span>
        </component>
      </li>
    </ul>

    <p v-if="note" class="mt-2 flex items-start gap-1 text-[11px] leading-snug text-primary">
      <UIcon name="i-lucide-sparkles" class="mt-px size-3.5 shrink-0" />{{ t('panel.recommended') }} · {{ note }}
    </p>
  </section>
</template>
