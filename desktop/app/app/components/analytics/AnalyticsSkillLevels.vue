<script setup lang="ts">
import type { ChampionStaticData } from '#shared/types/static-data'
import type { SkillLevel } from '~/utils/sources/analytics'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * The first levels skill by skill: at each level, how often each of Q, W, E
 * and R was taken there and its win rate — the most taken lit.
 */
const props = defineProps<{ levels: SkillLevel[], championStatic: ChampionStaticData | null }>()
const { t } = useT()
const KEYS = ['Q', 'W', 'E', 'R'] as const
const spell = (key: string) => props.championStatic?.championSpells[key] ?? null
const top = (level: SkillLevel) => level.skills.reduce((best, skill, index) => ((skill?.pickRate ?? 0) > (level.skills[best]?.pickRate ?? 0) ? index : best), 0)
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full min-w-[30rem] border-separate border-spacing-1 text-center text-xs">
      <thead>
        <tr>
          <th class="stat-label w-14">{{ t('analytics.level') }}</th>
          <th v-for="key in KEYS" :key="key" class="p-0">
            <span class="inline-flex items-center gap-1.5">
              <GameTooltipChampionSpellIcon v-if="spell(key)" :spell="spell(key)" :width="24" :height="24" class="size-6 rounded" />
              <span class="font-semibold text-muted">{{ key }}</span>
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="level in levels" :key="level.level">
          <th class="text-base font-semibold tabular-nums text-highlighted">{{ level.level }}</th>
          <td v-for="(skill, index) in level.skills" :key="index" class="rounded-lg py-1.5" :class="skill && index === top(level) ? 'bg-primary/15 ring-1 ring-inset ring-primary/40' : 'bg-accented/25'">
            <template v-if="skill">
              <span class="block font-semibold tabular-nums text-highlighted">{{ formatPercentage(skill.pickRate, 1) }}</span>
              <span class="block text-[10px] tabular-nums text-dimmed">{{ formatPercentage(skill.winRate, 1) }} · {{ skill.games.toLocaleString() }}</span>
            </template>
            <span v-else class="text-dimmed">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
