<script setup lang="ts">
import type { JevOption } from '~/utils/jev-build'
import type { RankedSlot } from '~/utils/jev-recommend'
import type { SkillKey } from '~/utils/skill-grid'
import { formatPercentage } from '#shared/utils/ddragon'
import { completeSkillGrid, skillGrid } from '~/utils/skill-grid'

/**
 * The recommended build laid out as Blitz lays a build: the setup — runes,
 * spells, starter, skill order, when the boots come — then the items in the
 * order they are bought, each step its pick large with its score, win rate,
 * games and win probability added, and the other options small under it, the
 * most played marked. A click on a step opens every option of it below, in
 * full (`JevChoices`); the most played build's buy order closes the card.
 */
const props = defineProps<{ ranked: RankedSlot[], championId: number, order: number[], standardOrder: number[] }>()
const { t } = useT()
const { items } = useStaticData()
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const tone = (value: number) => (value >= 0.52 ? 'text-primary' : value < 0.48 ? 'text-muted' : 'text-highlighted')
const signed = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
const wpaTone = (value: number) => (value >= 0.01 ? 'text-primary' : value <= -0.01 ? 'text-error' : 'text-muted')
const has = (value: number | null | undefined): value is number => value !== null && value !== undefined
const score = (entry: RankedSlot, option: JevOption) => Math.round((entry.scored[option.key]?.total ?? 0) * 100)

const SETUP = ['runes', 'spells', 'starter', 'skills', 'bootsAfter']
const setup = computed(() => SETUP.map(name => props.ranked.find(entry => entry.slot.name === name)).filter(entry => !!entry))
/** The item steps in the order they are bought: each item of the build matched to the slot that picked it, the boots where they fall. */
const path = computed(() => {
  const taken = new Set<string>()
  return props.order.map((id) => {
    const entry = props.ranked.find(candidate => (candidate.slot.kind === 'item' || candidate.slot.kind === 'boots') && !taken.has(candidate.slot.name) && candidate.pick.itemIds[0] === id)
    if (entry) taken.add(entry.slot.name)
    return entry
  }).filter(entry => !!entry)
})
/** Items named by their place in the buy order, the boots apart, so the path counts 1, 2, 3 with no gap where a slot had nothing new. */
const labels = computed(() => {
  const named = new Map<string, string>()
  let count = 0
  for (const entry of path.value) named.set(entry.slot.name, entry.slot.kind === 'boots' ? t('jev.slot.boots') : t('jev.slot.item', { slot: ++count }))
  return named
})
const slotLabel = (name: string) => labels.value.get(name) ?? (name.startsWith('item') ? t('jev.slot.item', { slot: name.slice(4) }) : t(`jev.slot.${name}`))
const others = (entry: RankedSlot) => [...entry.slot.options].filter(option => option.key !== entry.pick.key).sort((a, b) => score(entry, b) - score(entry, a))

/** The step opened below: the first where the pick parts from the most played, else the first. */
const chosen = ref<string | null>(null)
const opened = computed(() => {
  const all = [...setup.value, ...path.value]
  return all.find(entry => entry.slot.name === chosen.value) ?? all.find(entry => entry.pick.key !== entry.standard.key) ?? all[0] ?? null
})

const LEVELS = Array.from({ length: 18 }, (_, index) => index + 1)
const levelsOf = (option: JevOption) => {
  if (!option.order) return null
  const opening = option.opening?.slice(0, 3)
  return opening?.length === 3
    ? completeSkillGrid(Object.fromEntries(opening.map((key, index) => [index + 1, key as SkillKey])) as Record<number, SkillKey>, option.order)
    : skillGrid(option.order)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <section class="surface flex flex-col gap-4 rounded-2xl p-4">
      <header class="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 class="flex items-center gap-2 text-sm font-semibold text-primary">
          <UIcon name="i-tabler-sparkles" class="size-4" />{{ t('jev.card.jevBuild') }}
        </h3>
        <span class="flex items-center gap-1 text-[11px] text-muted"><UIcon name="i-tabler-database" class="size-3.5" />{{ t('jev.card.standardPick') }}</span>
        <span class="ml-auto text-[11px] text-dimmed">{{ t('jev.path.hint') }}</span>
      </header>

      <!-- One row for the setup, one for the items in buy order. -->
      <div v-for="row in [{ key: 'setup', label: t('jev.path.setup'), steps: setup }, { key: 'items', label: t('jev.card.order'), steps: path }]" :key="row.key" class="flex flex-col gap-2">
        <p class="stat-label">{{ row.label }}</p>
        <ol class="flex flex-wrap items-stretch gap-1.5">
          <template v-for="(entry, index) in row.steps" :key="entry.slot.name">
            <UIcon v-if="row.key === 'items' && index > 0" name="i-lucide-chevron-right" class="size-4 self-center text-dimmed" aria-hidden="true" />
            <li>
              <button
                type="button"
                class="relative flex h-full min-w-[7.25rem] flex-col items-center gap-1 rounded-xl px-2.5 pb-2 pt-1.5 text-center transition-colors"
                :class="opened?.slot.name === entry.slot.name ? 'bg-primary/12 ring-1 ring-primary/60' : 'bg-accented/25 hover:bg-accented/45'"
                @click="chosen = entry.slot.name"
              >
                <span class="flex w-full items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {{ slotLabel(entry.slot.name) }}
                  <UIcon v-if="entry.pick.key === entry.standard.key" name="i-tabler-database" class="size-3 text-dimmed" :aria-label="t('jev.card.standardPick')" />
                  <span v-else class="size-1.5 rounded-full bg-primary" :title="t('jev.card.differs')" />
                </span>

                <!-- The pick, large, with what decided it. -->
                <JevOptionVisual :option="entry.pick" :champion-id="championId" size="lg" class="justify-center" />
                <ol v-if="entry.slot.kind === 'skills' && levelsOf(entry.pick)" class="grid grid-cols-[repeat(18,0.95rem)] gap-px">
                  <li v-for="level in LEVELS" :key="level" class="flex h-4 items-center justify-center rounded-sm text-[9px] font-bold" :class="levelsOf(entry.pick)![level] === 'R' ? 'bg-primary/30 text-primary' : 'bg-primary/10 text-highlighted'" :title="String(level)">
                    {{ levelsOf(entry.pick)![level] }}
                  </li>
                </ol>
                <span class="flex items-baseline gap-1.5">
                  <span class="text-lg font-bold leading-none tabular-nums text-primary" :title="t('jev.card.totalHint')">{{ score(entry, entry.pick) }}</span>
                  <span v-if="entry.pick.games" class="text-xs font-semibold tabular-nums" :class="tone(entry.pick.winRate)">{{ formatPercentage(entry.pick.winRate, 1) }}</span>
                </span>
                <span v-if="entry.pick.games" class="text-[10px] tabular-nums text-dimmed">{{ formatPercentage(entry.pick.pickRate, 1) }} · {{ compact.format(entry.pick.games) }}</span>
                <span v-if="has(entry.pick.wpa) || has(entry.pick.vsWpa)" class="flex gap-1.5 text-[10px] font-semibold tabular-nums">
                  <span v-if="has(entry.pick.wpa)" :class="wpaTone(entry.pick.wpa)" :title="t('jev.card.wpaHint')">WPA {{ signed(entry.pick.wpa) }}</span>
                  <span v-if="has(entry.pick.vsWpa)" :class="wpaTone(entry.pick.vsWpa)" :title="t('jev.card.vsWpaHint', { games: entry.pick.vsGames ?? 0 })">{{ t('jev.card.vs') }} {{ signed(entry.pick.vsWpa) }}</span>
                </span>
                <UBadge v-if="entry.pick.situational" :label="t('jev.card.situational')" color="warning" variant="subtle" size="xs" />

                <!-- The other options, small, each with its score. -->
                <span v-if="others(entry).length" class="mt-auto flex w-full flex-wrap justify-center gap-1.5 border-t border-default/60 pt-1.5">
                  <span v-for="option in others(entry)" :key="option.key" class="flex flex-col items-center gap-0.5" :class="entry.scored[option.key]?.misfit ? 'opacity-50' : ''">
                    <JevOptionVisual :option="option" :champion-id="championId" size="sm" class="justify-center" />
                    <span class="flex items-center gap-0.5 text-[10px] tabular-nums text-muted">
                      <UIcon v-if="option.key === entry.standard.key" name="i-tabler-database" class="size-3 text-dimmed" :aria-label="t('jev.card.standardPick')" />
                      {{ score(entry, option) }}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          </template>
        </ol>
      </div>

      <!-- The most played build's buy order, to set beside. -->
      <div class="flex flex-wrap items-center gap-2 border-t border-default/60 pt-3">
        <span class="flex items-center gap-1.5 text-xs font-semibold text-muted"><UIcon name="i-tabler-database" class="size-3.5" />{{ t('jev.card.standardBuild') }}</span>
        <ol class="flex flex-wrap items-center gap-1">
          <template v-for="(itemId, index) in standardOrder" :key="`${itemId}-${index}`">
            <UIcon v-if="index > 0" name="i-lucide-chevron-right" class="size-3 text-dimmed" aria-hidden="true" />
            <li><GameTooltipItemIcon :item="items[itemId] ?? null" :width="26" :height="26" class="rounded-md" /></li>
          </template>
        </ol>
      </div>
    </section>

    <!-- Every option of the opened step, in full. -->
    <section v-if="opened" class="surface min-w-0 rounded-2xl p-4">
      <header class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 class="text-sm font-semibold text-highlighted">{{ t('jev.path.details', { slot: slotLabel(opened.slot.name) }) }}</h3>
        <span class="flex items-center gap-1 text-[11px] text-muted"><UIcon name="i-tabler-sparkles" class="size-3.5 text-primary" />{{ t('jev.card.jevPick') }}</span>
        <span class="flex items-center gap-1 text-[11px] text-muted"><UIcon name="i-tabler-database" class="size-3.5" />{{ t('jev.card.standardPick') }}</span>
      </header>
      <p class="mb-3 text-xs text-muted">{{ t('jev.card.choicesHint') }}</p>
      <JevChoices :ranked="[opened]" :champion-id="championId" />
    </section>
  </div>
</template>
