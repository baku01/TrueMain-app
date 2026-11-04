<script setup lang="ts">
import type { BuildSkillOrder } from '#shared/types/champions'
import type { ChampionStaticData } from '#shared/types/static-data'
import { formatCount } from '#shared/utils/counts'
import { formatPercentage } from '#shared/utils/ddragon'
import { winRateTone } from '#common/utils/rate-tone'
import AbilityHover from '~/components/Champion/AbilityHover.vue'
import { SKILL_ROWS, completeSkillGrid, skillGrid } from '~/utils/skill-grid'
import type { SkillKey } from '~/utils/skill-grid'

/**
 * The skill order the way Blitz lays it out: on the left the max order — each
 * ability's icon ringed in its colour, its key in the corner — over its win
 * rate and games; on the right a compact grid of the four skills against
 * levels 1–18, each point a small square lettered in the ability's colour.
 * The grid is the measured order when the source has one (completed to 18
 * by the game's rules), else derived from the priority (`utils/skill-grid`),
 * and says so.
 */
const props = defineProps<{
  skillOrder: BuildSkillOrder | null
  championStatic: ChampionStaticData
  /** The skill taken at each level (1 Q … 4 R), when the source measured it: drawn as is, instead of derived from the priority. */
  points?: number[] | null
  /** The grid alone, without the priority beside it — where the page shows the priority already. */
  gridOnly?: boolean
  /** A line under the grid, from the caller: what its numbers count. */
  note?: string | null
  /** The champion, when the caller knows it: each ability's icon then shows its clip and figures under the pointer (`AbilityHover`). */
  championId?: number | null
}>()

const { t } = useT()
const KEY_BY_SLOT: Record<number, SkillKey> = { 1: 'Q', 2: 'W', 3: 'E', 4: 'R' }
// A measured order covers the levels the source counted (fifteen at most): the rest are completed by the game's rules.
const measured = computed(() => (props.points?.length
  ? completeSkillGrid(Object.fromEntries(props.points.slice(0, 18).map((slot, index) => [index + 1, KEY_BY_SLOT[slot]!])) as Record<number, SkillKey>, props.skillOrder?.sequence ?? null)
  : null))
const grid = computed(() => measured.value ?? (props.skillOrder ? skillGrid(props.skillOrder.sequence) : null))
const spell = (key: string) => props.championStatic.championSpells[key] ?? null
const LEVELS = Array.from({ length: 18 }, (_, index) => index + 1)

/** Each skill keeps its colour everywhere it shows, as in the game's own skill bar. */
const COLORS: Record<SkillKey, { text: string, cell: string, ring: string }> = {
  Q: { text: 'text-orange-400', cell: 'bg-orange-500/15 ring-orange-400/40', ring: 'ring-orange-400/70' },
  W: { text: 'text-cyan-300', cell: 'bg-cyan-500/15 ring-cyan-300/40', ring: 'ring-cyan-300/70' },
  E: { text: 'text-blue-400', cell: 'bg-blue-500/15 ring-blue-400/40', ring: 'ring-blue-400/70' },
  R: { text: 'text-yellow-300', cell: 'bg-yellow-500/15 ring-yellow-300/40', ring: 'ring-yellow-300/70' },
}
const colorOf = (key: string) => COLORS[key as SkillKey] ?? COLORS.R
/** A key of the max order as an ability's (`Q`, `W`, `E`): the max order holds the basic abilities only. */
const abilityKey = (key: string) => key as SkillKey
</script>

<template>
  <!-- Side by side and centred where there is room; the max order over the grid, both centred, where there is not. -->
  <div class="@container w-full">
    <div class="flex flex-col items-center gap-5 @3xl:flex-row @3xl:justify-center @3xl:gap-10">
      <div v-if="!gridOnly" class="flex shrink-0 flex-col items-center gap-3 text-center @3xl:items-start @3xl:text-left">
        <h3 class="text-sm font-semibold text-highlighted">{{ t('build.skillGrid.maxOrder') }}</h3>
        <p v-if="skillOrder && skillOrder.games > 0" class="flex items-center gap-2 text-xs">
          <span class="rounded px-1.5 py-0.5 font-bold tabular-nums ring-1 ring-inset ring-current/25" :class="winRateTone(skillOrder.winRate)">{{ formatPercentage(skillOrder.winRate, 1) }}</span>
          <span class="uppercase tracking-wide text-muted">{{ t('build.skillGrid.games', { games: formatCount(skillOrder.games) }) }}</span>
        </p>
        <div v-if="skillOrder?.sequence.length" class="flex items-center gap-1.5">
          <template v-for="(key, index) in skillOrder.sequence" :key="`${key}-${index}`">
            <div class="relative size-10 shrink-0 rounded-lg ring-2" :class="colorOf(key).ring">
              <AbilityHover v-if="championId && spell(key)" :champion-id="championId" :spell-key="abilityKey(key)">
                <img :src="spell(key)!.iconUrl" :alt="spell(key)!.name" width="40" height="40" class="size-10 cursor-help rounded-lg">
              </AbilityHover>
              <GameTooltipChampionSpellIcon v-else :spell="spell(key)" :width="40" :height="40" class="size-10 rounded-lg" />
              <span class="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded bg-default text-[10px] font-extrabold" :class="colorOf(key).text">{{ key }}</span>
            </div>
            <UIcon v-if="index < skillOrder.sequence.length - 1" name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed" />
          </template>
        </div>
        <p v-else class="text-sm text-muted">{{ t('common.noData') }}</p>
      </div>

      <div v-if="grid" class="w-full min-w-0 max-w-[60rem] overflow-x-auto @3xl:flex-1">
        <div
          class="mx-auto grid w-full min-w-[23rem] grid-flow-row gap-1 text-[10px] font-bold @lg:text-[11px] @xl:gap-1.5 @xl:text-xs"
          style="grid-template-columns: 1.75rem repeat(18, minmax(1rem, 1fr))"
          role="table"
          :aria-label="t('build.skillGrid.label')"
        >
          <span role="columnheader" />
          <span v-for="level in LEVELS" :key="`level-${level}`" role="columnheader" class="grid h-6 place-items-center font-medium tabular-nums text-dimmed">{{ level }}</span>
          <template v-for="key in SKILL_ROWS" :key="key">
            <span role="rowheader" class="grid place-items-center">
              <AbilityHover v-if="championId && spell(key)" :champion-id="championId" :spell-key="key">
                <img :src="spell(key)!.iconUrl" :alt="spell(key)!.name" width="32" height="32" class="size-6 cursor-help rounded-md @lg:size-7 @xl:size-8">
              </AbilityHover>
              <GameTooltipChampionSpellIcon v-else-if="spell(key)" :spell="spell(key)" :width="32" :height="32" class="size-6 rounded-md @lg:size-7 @xl:size-8" />
              <span v-else class="text-muted">{{ key }}</span>
            </span>
            <span
              v-for="level in LEVELS"
              :key="`${key}-${level}`"
              role="cell"
              class="grid aspect-square max-h-9 w-full max-w-9 place-items-center self-center justify-self-center rounded-md"
              :class="grid[level] === key ? [colorOf(key).text, colorOf(key).cell, 'ring-1 ring-inset'] : 'bg-accented/40'"
            >{{ grid[level] === key ? key : '' }}</span>
          </template>
        </div>
      </div>
    </div>
    <!-- What the numbers count, centred under the whole block, as the header over it is. -->
    <p v-if="note" class="mx-auto mt-4 max-w-[48rem] text-center text-[11px] leading-relaxed text-dimmed">{{ note }}</p>
    <p v-else-if="grid && !measured" class="mx-auto mt-3 text-center text-[11px] text-dimmed">{{ t('build.skillGrid.derived') }}</p>
  </div>
</template>
