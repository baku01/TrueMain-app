<script setup lang="ts">
import type { Parts, RankedSlot } from '~/utils/jev-recommend'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * Every choice of the build as a table, one panel per choice and one row per
 * option, the recommended first — the most played unless another has a
 * reason (`DEVIATE`), so not always the best score — then best score first,
 * the columns the same in every panel so options compare at a glance: the
 * option (its icons with their tooltips), its score, what lolalytics and
 * Blitz measured (win rate, pick rate and games, win probability added on the
 * lane and against the opponent), the parts of the score and the needs it
 * answers. The recommended row stands out in the
 * accent, the most played carries its mark, and a panel where the two part
 * says so.
 */
const props = defineProps<{ ranked: RankedSlot[], championId: number }>()
const { t } = useT()
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const tone = (value: number) => (value >= 0.52 ? 'text-primary' : value < 0.48 ? 'text-muted' : 'text-highlighted')
const percent = (value: number | undefined) => `${Math.round((value ?? 0) * 100)}%`
const signed = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
const wpaTone = (value: number) => (value >= 0.01 ? 'text-primary' : value <= -0.01 ? 'text-error' : 'text-muted')
const slotLabel = (name: string) => (name.startsWith('item') ? t('jev.slot.item', { slot: name.slice(4) }) : t(`jev.slot.${name}`))
/** The parts in three fixed places, so they line up down the table: the statistics, the team or the lane, the kit. */
const partsOf = (parts: Parts) => ([['stats'], ['draft', 'lane'], ['kit']] as (keyof Parts)[][]).map((places) => {
  const part = places.find(name => parts[name] !== undefined)
  return part ? { part, value: parts[part]! } : null
})
const barTone = (value: number) => (value >= 0.6 ? 'bg-primary' : value <= 0.35 ? 'bg-error/70' : 'bg-(--ui-text-dimmed)')
const has = (value: number | null | undefined): value is number => value !== null && value !== undefined
/** Each slot's options, the recommended first, then best score first. */
const rows = computed(() => props.ranked.map(entry => ({
  entry,
  options: [...entry.slot.options].sort((a, b) => Number(b.key === entry.pick.key) - Number(a.key === entry.pick.key) || (entry.scored[b.key]?.total ?? 0) - (entry.scored[a.key]?.total ?? 0)),
})))
/** The columns every panel shares: marks, option, score, win rate, pick rate and games, WPA, score parts, answers. */
const COLUMNS = 'grid grid-cols-[1.5rem_11rem_5.5rem_3.5rem_5.5rem_6.5rem_20.5rem_minmax(8rem,1fr)] items-center gap-x-2'
</script>

<template>
  <div class="overflow-x-auto">
    <div class="flex min-w-[66rem] flex-col gap-2">
      <!-- The column names, once over every panel. -->
      <div :class="COLUMNS" class="px-2 text-[10px] font-semibold uppercase tracking-wide text-dimmed">
        <span />
        <span>{{ t('jev.col.option') }}</span>
        <span>{{ t('jev.col.score') }}</span>
        <span class="text-right">{{ t('jev.col.winRate') }}</span>
        <span class="text-right">{{ t('jev.col.pick') }}</span>
        <span class="text-right">{{ t('jev.col.wpa') }}</span>
        <span>{{ t('jev.col.parts') }}</span>
        <span>{{ t('jev.col.answers') }}</span>
      </div>

      <section v-for="{ entry, options } in rows" :key="entry.slot.name" class="rounded-xl bg-accented/15 p-1.5">
        <header v-if="ranked.length > 1" class="flex items-center gap-2 px-2 pb-1 pt-0.5">
          <h4 class="text-sm font-semibold text-highlighted">{{ slotLabel(entry.slot.name) }}</h4>
          <UBadge v-if="entry.pick.key !== entry.standard.key" :label="t('jev.card.differs')" color="primary" variant="soft" size="sm" />
        </header>
        <ul class="flex flex-col gap-0.5">
          <li
            v-for="option in options"
            :key="option.key"
            :class="[COLUMNS, option.key === entry.pick.key ? 'bg-primary/10 ring-1 ring-primary/40' : '']"
            class="rounded-lg px-2 py-1.5"
          >
            <!-- Marks: recommended, most played. -->
            <span class="flex flex-col items-center gap-0.5">
              <UIcon v-if="option.key === entry.pick.key" name="i-tabler-chess-knight" class="size-4 text-primary" :aria-label="t('jev.card.jevPick')" />
              <UIcon v-if="option.key === entry.standard.key" name="i-tabler-database" class="size-3.5 text-dimmed" :aria-label="t('jev.card.standardPick')" />
            </span>

            <!-- The option itself, every icon with its tooltip. -->
            <span class="flex min-w-0 flex-wrap items-center gap-1">
              <JevOptionVisual :option="option" :champion-id="championId" />
              <UBadge v-if="option.situational" :label="t('jev.card.situational')" color="warning" variant="subtle" size="xs" />
              <UBadge v-if="entry.scored[option.key]?.misfit" :label="t('jev.card.misfit')" color="error" variant="subtle" size="xs" :title="t('jev.card.misfitHint')" />
            </span>

            <!-- The score. -->
            <span class="flex items-center gap-2" :title="t('jev.card.totalHint')">
              <span class="w-7 text-right text-base font-semibold tabular-nums" :class="option.key === entry.pick.key ? 'text-primary' : 'text-muted'">{{ Math.round((entry.scored[option.key]?.total ?? 0) * 100) }}</span>
              <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-accented/70">
                <span class="block h-full rounded-full" :class="option.key === entry.pick.key ? 'bg-primary' : 'bg-(--ui-text-dimmed)'" :style="{ width: percent(entry.scored[option.key]?.total) }" />
              </span>
            </span>

            <!-- What was measured. -->
            <span class="text-right text-sm font-semibold tabular-nums" :class="option.games ? tone(option.winRate) : 'text-dimmed'">{{ option.games ? formatPercentage(option.winRate, 1) : '—' }}</span>
            <span class="text-right text-xs tabular-nums text-muted">{{ option.games ? `${formatPercentage(option.pickRate, 1)} · ${compact.format(option.games)}` : '—' }}</span>
            <span class="flex flex-col items-end text-xs font-semibold tabular-nums">
              <span v-if="has(option.wpa)" :class="wpaTone(option.wpa)" :title="t('jev.card.wpaHint')">{{ signed(option.wpa) }}</span>
              <span v-if="has(option.slotWpa)" class="text-[10px]" :class="wpaTone(option.slotWpa)" :title="t('jev.card.slotWpaHint', { games: option.slotGames ?? 0 })">{{ t('jev.card.slot') }} {{ signed(option.slotWpa) }}</span>
              <span v-if="has(option.vsWpa)" class="text-[10px]" :class="wpaTone(option.vsWpa)" :title="t('jev.card.vsWpaHint', { games: option.vsGames ?? 0 })">{{ t('jev.card.vs') }} {{ signed(option.vsWpa) }}</span>
              <span v-if="!has(option.wpa) && !has(option.vsWpa)" class="text-dimmed">—</span>
            </span>

            <!-- The parts of the score. -->
            <span class="grid grid-cols-3 gap-x-2">
              <template v-for="(part, index) in partsOf(entry.scored[option.key]?.parts ?? {})" :key="index">
                <span v-if="part" class="grid grid-cols-[3.1rem_1.75rem_1.25rem] items-center gap-1 text-[10px] tabular-nums" :title="t(`jev.part.${part.part}.hint`)">
                  <span class="truncate text-muted">{{ t(`jev.part.${part.part}`) }}</span>
                  <span class="h-1 overflow-hidden rounded-full bg-accented/70"><span class="block h-full rounded-full" :class="barTone(part.value)" :style="{ width: percent(part.value) }" /></span>
                  <span class="text-right text-default">{{ Math.round(part.value * 100) }}</span>
                </span>
                <span v-else />
              </template>
            </span>

            <!-- The needs it answers. -->
            <span class="flex flex-wrap gap-1 text-[10px] font-semibold">
              <span v-for="answer in entry.scored[option.key]?.answers.slice(0, 3) ?? []" :key="answer.need" class="rounded bg-primary/15 px-1.5 py-px text-primary" :title="t('jev.card.answersHint')">{{ t(`jev.need.${answer.need}`) }}</span>
            </span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
