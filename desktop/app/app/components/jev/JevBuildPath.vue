<script setup lang="ts">
import type { ItemSetBlocks } from '~/composables/useItemSetImport'
import type { JevOption, LaidBuild } from '~/utils/jev-build'
import type { BuildStep, DeviationReason, RankedSlot } from '~/utils/jev-recommend'
import type { DraftOptional } from '~/utils/jev-optionals'
import type { SkillKey } from '~/utils/skill-grid'
import { formatPercentage } from '#shared/utils/ddragon'
import { getActiveLocale } from '#common/utils/i18n'
import { completeSkillGrid, skillGrid } from '~/utils/skill-grid'
import { buildSteps, itemSetOf, reasonMessage, stepOthers } from '~/utils/jev-recommend'
import { draftBlocks } from '~/utils/jev-optionals'

/**
 * One build of the Jev page — the recommended or the most played — laid out
 * as Blitz lays a build: the setup (runes, spells, starter, skill order, when
 * the boots come) then the items in the order they are bought, each step its
 * option large with its score, win rate, pick rate, games and win probability
 * added, the slot's other options small under it with their scores — and,
 * where the recommended parts from the most played, a line saying why
 * (`RankedSlot.reason`). The steps share the width the same way in both
 * builds, so the two stacked line up step for step. A click
 * on a step selects it: the page opens every option of it below. Under Jev's
 * build, the items that answer each need of the draft (`JevDraftOptionals`).
 * The header's buttons put the build's rune page and item set into the
 * client, the draft's answers as a block per need.
 */
export interface OpenedStep { name: string, label: string }

const props = defineProps<{ ranked: RankedSlot[], championId: number, position?: string, importName?: string, build: LaidBuild, side: 'jev' | 'standard', /** The heading, when the base names it ("Jev · Lethality"). */ title?: string, /** The draft's needs and the items that answer them (`useJevBuild`'s `optionals`). */ optionals?: DraftOptional[] }>()
const opened = defineModel<OpenedStep | null>('opened', { default: null })
const { t } = useT()
const { nameOf } = useChampionStatics()
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const tone = (value: number) => (value >= 0.52 ? 'text-primary' : value < 0.48 ? 'text-muted' : 'text-highlighted')
const signed = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
const wpaTone = (value: number) => (value >= 0.01 ? 'text-primary' : value <= -0.01 ? 'text-error' : 'text-muted')
const has = (value: number | null | undefined): value is number => value !== null && value !== undefined
const score = (entry: RankedSlot, option: JevOption) => Math.round((entry.scored[option.key]?.total ?? 0) * 100)
const recommended = computed(() => props.side === 'jev')
/** Why a pick parts from the most played, as one line (`reasonMessage`). */
const why = (reason: DeviationReason) => {
  const message = reasonMessage(reason, getActiveLocale())
  return t(message.key, message.params)
}

interface Step extends Pick<BuildStep, 'entry' | 'option'> { label: string }

/** The setup in fixed places, each its share of the width, the same in both builds. */
const SETUP: { name: string, width: string }[] = [
  { name: 'runes', width: 'min-w-[10.5rem] grow-[3]' },
  { name: 'spells', width: 'min-w-[7.25rem] grow-[2]' },
  { name: 'starter', width: 'min-w-[7.25rem] grow-[2]' },
  { name: 'skills', width: 'min-w-[19.5rem] grow-[4]' },
  { name: 'bootsAfter', width: 'min-w-[9rem] grow-[2]' },
]
const chosenOf = (entry: RankedSlot) => (recommended.value ? entry.pick : entry.standard)
const setup = computed(() => SETUP.flatMap(({ name, width }) => {
  const entry = props.ranked.find(candidate => candidate.slot.name === name)
  return entry ? [{ entry, option: chosenOf(entry), label: t(`jev.slot.${name}`), width }] : []
}))
/** The items in buy order, each matched to the slot that offers it (`buildSteps`), named by its place (the boots apart). */
const path = computed((): Step[] => buildSteps(props.ranked, props.build).map(step => ({ ...step, label: step.place === 0 ? t('jev.slot.boots') : t('jev.slot.item', { slot: step.place }) })))
/** The build as the client's item set (`itemSetOf`), the draft's answers a block per need. */
const itemSet = computed((): ItemSetBlocks => ({ championId: props.championId, champion: props.importName ?? nameOf(props.championId), position: props.position, blocks: { ...itemSetOf(props.ranked, props.build), draft: draftBlocks(props.optionals ?? [], nameOf) } }))

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
  <section class="surface flex flex-col gap-3 rounded-2xl p-4" :class="recommended ? 'ring-1 ring-primary/30' : ''">
    <header class="flex items-center gap-2">
      <UIcon :name="recommended ? 'i-tabler-chess-knight' : 'i-tabler-database'" class="size-4" :class="recommended ? 'text-primary' : 'text-muted'" />
      <h3 class="text-sm font-semibold" :class="recommended ? 'text-primary' : 'text-highlighted'">{{ title ?? (recommended ? t('jev.card.jevBuild') : t('jev.card.standardBuild')) }}</h3>
      <!-- Into the client, on a click: this build's rune page and its item set. -->
      <span class="ml-auto flex items-center gap-1.5">
        <BuildRuneImport v-if="build.runePage" :page="build.runePage" :champion="importName ?? nameOf(championId)" labeled />
        <BuildItemSetImport :subject="itemSet" labeled />
      </span>
    </header>

    <div v-for="row in [{ key: 'setup', label: t('jev.path.setup'), steps: setup }, { key: 'items', label: t('jev.card.order'), steps: path }]" :key="row.key" class="flex flex-col gap-1.5">
      <p class="stat-label">{{ row.label }}</p>
      <ol class="flex flex-wrap items-stretch gap-1.5">
        <template v-for="(step, index) in row.steps" :key="step.entry.slot.name">
          <UIcon v-if="row.key === 'items' && index > 0" name="i-lucide-chevron-right" class="size-3.5 self-center text-dimmed" aria-hidden="true" />
          <li :class="'width' in step ? step.width : 'min-w-[7.25rem]'" class="flex-1 basis-0">
            <button
              type="button"
              class="flex h-full w-full flex-col items-center gap-1 rounded-xl px-2 pb-2 pt-1.5 text-center transition-colors"
              :class="opened?.name === step.entry.slot.name ? 'bg-primary/12 ring-1 ring-primary/60' : 'bg-accented/25 hover:bg-accented/45'"
              @click="opened = { name: step.entry.slot.name, label: step.label }"
            >
              <!-- The step's name, and how it stands to the other build. -->
              <span class="flex w-full items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {{ step.label }}
                <UIcon v-if="recommended && step.option.key === step.entry.standard.key" name="i-tabler-database" class="size-3 text-dimmed" :aria-label="t('jev.card.standardPick')" />
                <UIcon v-else-if="!recommended && step.option.key === step.entry.pick.key" name="i-tabler-chess-knight" class="size-3 text-primary" :aria-label="t('jev.card.jevPick')" />
                <span v-else-if="recommended" class="size-1.5 rounded-full bg-primary" :title="t('jev.card.differs')" />
              </span>

              <!-- The option, large, with what decided it. -->
              <span class="flex min-h-10 items-center"><JevOptionVisual :option="step.option" :champion-id="championId" size="lg" class="justify-center" /></span>
              <ol v-if="step.entry.slot.kind === 'skills' && levelsOf(step.option)" class="grid grid-cols-[repeat(18,0.95rem)] gap-px">
                <li v-for="level in LEVELS" :key="level" class="flex h-4 items-center justify-center rounded-sm text-[9px] font-bold" :class="levelsOf(step.option)![level] === 'R' ? 'bg-primary/30 text-primary' : 'bg-primary/10 text-highlighted'" :title="String(level)">
                  {{ levelsOf(step.option)![level] }}
                </li>
              </ol>
              <span class="flex items-baseline gap-1.5">
                <span class="text-lg font-bold leading-none tabular-nums" :class="step.option.key === step.entry.pick.key ? 'text-primary' : 'text-highlighted'" :title="t('jev.card.totalHint')">{{ score(step.entry, step.option) }}</span>
                <span v-if="step.option.games" class="text-xs font-semibold tabular-nums" :class="tone(step.option.winRate)">{{ formatPercentage(step.option.winRate, 1) }}</span>
              </span>
              <span v-if="step.option.games" class="text-[10px] tabular-nums text-dimmed">{{ formatPercentage(step.option.pickRate, 1) }} · {{ compact.format(step.option.games) }}</span>
              <span v-if="has(step.option.wpa) || has(step.option.vsWpa)" class="flex flex-wrap justify-center gap-x-1.5 text-[10px] font-semibold tabular-nums">
                <span v-if="has(step.option.wpa)" :class="wpaTone(step.option.wpa)" :title="t('jev.card.wpaHint')">WPA {{ signed(step.option.wpa) }}</span>
                <span v-if="has(step.option.slotWpa)" :class="wpaTone(step.option.slotWpa)" :title="t('jev.card.slotWpaHint', { games: step.option.slotGames ?? 0 })">{{ t('jev.card.slot') }} {{ signed(step.option.slotWpa) }}</span>
                <span v-if="has(step.option.vsWpa)" :class="wpaTone(step.option.vsWpa)" :title="t('jev.card.vsWpaHint', { games: step.option.vsGames ?? 0 })">{{ t('jev.card.vs') }} {{ signed(step.option.vsWpa) }}</span>
              </span>
              <UBadge v-if="step.option.situational" :label="t('jev.card.situational')" color="warning" variant="subtle" size="xs" />
              <UBadge v-if="step.entry.scored[step.option.key]?.misfit" :label="t('jev.card.misfit')" color="error" variant="subtle" size="xs" :title="t('jev.card.misfitHint')" />
              <!-- Why Jev parts here from the most played. -->
              <span v-if="recommended && step.entry.reason && step.option.key === step.entry.pick.key" class="text-[10px] font-medium leading-tight text-primary" :title="t('jev.reason.hint')">{{ why(step.entry.reason) }}</span>

              <!-- The slot's other options, small, each with its score. -->
              <span v-if="stepOthers(step).length" class="mt-auto flex w-full flex-wrap justify-center gap-1.5 border-t border-default/60 pt-1.5">
                <span v-for="option in stepOthers(step)" :key="option.key" class="flex flex-col items-center gap-0.5" :class="step.entry.scored[option.key]?.misfit ? 'opacity-50' : ''">
                  <JevOptionVisual :option="option" :champion-id="championId" size="sm" class="justify-center" />
                  <span class="flex items-center gap-0.5 text-[10px] tabular-nums text-muted">
                    <UIcon v-if="option.key === step.entry.pick.key" name="i-tabler-chess-knight" class="size-3 text-primary" :aria-label="t('jev.card.jevPick')" />
                    <UIcon v-else-if="option.key === step.entry.standard.key" name="i-tabler-database" class="size-3 text-dimmed" :aria-label="t('jev.card.standardPick')" />
                    {{ score(step.entry, option) }}
                  </span>
                </span>
              </span>
            </button>
          </li>
        </template>
      </ol>
    </div>

    <!-- What answers the draft, beside the build: Jev's build only. -->
    <JevDraftOptionals v-if="recommended && optionals?.length" :optionals="optionals" />
  </section>
</template>
