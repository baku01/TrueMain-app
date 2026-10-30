<script setup lang="ts">
import type { BuildSkillOrder } from '#shared/types/champions'
import type { ChampionStaticData } from '#shared/types/static-data'
import { SKILL_ROWS, skillGrid } from '~/utils/skill-grid'
import type { SkillKey } from '~/utils/skill-grid'

/**
 * The skill order as the clients draw it: the priority chain on the left, and
 * on the right a grid of the four skills against levels 1–18 with the level
 * each is learned at. The grid is derived from the priority (`utils/skill-grid`),
 * since the aggregate carries no per-level data, and says so.
 */
const props = defineProps<{
  skillOrder: BuildSkillOrder | null
  championStatic: ChampionStaticData
}>()

const { t } = useT()
const grid = computed(() => (props.skillOrder ? skillGrid(props.skillOrder.sequence) : null))
const spell = (key: string) => props.championStatic.championSpells[key] ?? null
const LEVELS = Array.from({ length: 18 }, (_, index) => index + 1)

/** Each skill keeps its colour from the first column to the last, as in the game's own skill bar. */
const COLORS: Record<SkillKey, string> = {
  Q: 'bg-orange-500/20 text-orange-400',
  W: 'bg-cyan-500/20 text-cyan-300',
  E: 'bg-blue-500/20 text-blue-400',
  R: 'bg-yellow-500/20 text-yellow-300',
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-8 gap-y-4">
    <div class="shrink-0">
      <h3 class="text-sm font-medium text-muted">{{ t('champion.core.skillOrder') }}</h3>
      <div v-if="skillOrder?.sequence.length" class="mt-2 flex items-center gap-1">
        <template v-for="(key, index) in skillOrder.sequence" :key="`${key}-${index}`">
          <div class="relative size-10 shrink-0">
            <GameTooltipChampionSpellIcon :spell="spell(key)" :width="40" :height="40" class="size-10 rounded" />
            <ItemRankBadge :value="key" />
          </div>
          <UIcon v-if="index < skillOrder.sequence.length - 1" name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed" />
        </template>
      </div>
      <p v-else class="mt-2 text-sm text-muted">{{ t('common.noData') }}</p>
    </div>

    <div v-if="grid" class="min-w-0 flex-1 overflow-x-auto">
      <table class="w-full min-w-[34rem] table-fixed border-separate border-spacing-1 text-center text-xs" :aria-label="t('build.skillGrid.label')">
        <thead>
          <tr>
            <th class="w-8" />
            <th v-for="level in LEVELS" :key="level" scope="col" class="font-medium tabular-nums text-muted">{{ level }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="key in SKILL_ROWS" :key="key">
            <th scope="row" class="p-0">
              <GameTooltipChampionSpellIcon v-if="spell(key)" :spell="spell(key)" :width="28" :height="28" class="mx-auto size-7 rounded" />
              <span v-else class="font-semibold text-muted">{{ key }}</span>
            </th>
            <td v-for="level in LEVELS" :key="level" class="h-7 rounded" :class="grid[level] === key ? `${COLORS[key]} font-bold` : 'bg-accented/50'">
              {{ grid[level] === key ? key : '' }}
            </td>
          </tr>
        </tbody>
      </table>
      <p class="mt-1.5 text-[11px] text-dimmed">{{ t('build.skillGrid.derived') }}</p>
    </div>
  </div>
</template>
