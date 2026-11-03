<script setup lang="ts">
import type { ChampionStaticData } from '#shared/types/static-data'
import type { SkillLevel, SkillPath } from '~/utils/sources/analytics'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * Skills in detail. Overview: the max orders with their win and pick rates,
 * beside the first levels skill by skill. Level 6+, 10+, 15+: the full paths
 * up to that level, each skill as the game took it.
 */
const props = defineProps<{ paths: { priority: SkillPath[], level6: SkillPath[], level10: SkillPath[], level15: SkillPath[] }, levels: SkillLevel[], championStatic: ChampionStaticData | null }>()
const { t } = useT()
type Tab = 'overview' | 'level6' | 'level10' | 'level15'
const tab = ref<Tab>('overview')
const tabs = computed(() => (['overview', 'level6', 'level10', 'level15'] as const).filter(key => key === 'overview' || props.paths[key].length))
const spell = (key: string) => props.championStatic?.championSpells[key] ?? null
const percent = (value: number) => formatPercentage(value, 1)
const LEVEL: Record<Tab, number> = { overview: 0, level6: 6, level10: 10, level15: 15 }
const COLORS: Record<string, string> = { Q: 'bg-orange-500/20 text-orange-300', W: 'bg-cyan-500/20 text-cyan-300', E: 'bg-blue-500/20 text-blue-300', R: 'bg-yellow-500/20 text-yellow-300' }
</script>

<template>
  <div class="space-y-3">
    <div class="grid overflow-hidden rounded-lg border border-default" :style="{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }" role="tablist">
      <button v-for="key in tabs" :key="key" type="button" role="tab" :aria-selected="tab === key" class="py-2 text-sm font-semibold transition-colors" :class="tab === key ? 'bg-primary/15 text-highlighted' : 'text-muted hover:bg-accented/40'" @click="tab = key">
        {{ key === 'overview' ? t('analytics.skills.overview') : t('analytics.skills.level', { level: LEVEL[key] }) }}
      </button>
    </div>

    <div v-if="tab === 'overview'" class="grid gap-4 @4xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-[10px] uppercase tracking-[0.12em] text-dimmed"><th class="pb-2 text-left">{{ t('analytics.skills.priority') }}</th><th class="pb-2 text-right">{{ t('analytics.skills.win') }}</th><th class="pb-2 text-right">{{ t('analytics.skills.pick') }}</th></tr>
        </thead>
        <tbody class="divide-y divide-default/50">
          <tr v-for="path in paths.priority" :key="path.order.join('')" class="h-12">
            <td>
              <span class="flex items-center gap-1">
                <template v-for="(key, index) in path.order" :key="key">
                  <span class="relative size-8"><GameTooltipChampionSpellIcon :spell="spell(key)" :width="32" :height="32" class="size-8 rounded" /><ItemRankBadge :value="key" /></span>
                  <UIcon v-if="index < path.order.length - 1" name="i-lucide-chevron-right" class="size-3.5 text-dimmed" />
                </template>
              </span>
            </td>
            <td class="text-right font-semibold tabular-nums" :class="path.winRate >= 0.5 ? 'text-primary' : 'text-error'">{{ percent(path.winRate) }}</td>
            <td class="text-right tabular-nums text-muted">{{ percent(path.pickRate) }}<span class="block text-[10px] text-dimmed">{{ path.games.toLocaleString() }}</span></td>
          </tr>
        </tbody>
      </table>
      <AnalyticsSkillLevels v-if="levels.length" :levels="levels" :champion-static="championStatic" />
    </div>

    <table v-else class="w-full text-sm">
      <thead>
        <tr class="text-[10px] uppercase tracking-[0.12em] text-dimmed"><th class="pb-2 text-left">{{ t('analytics.skills.path') }}</th><th class="pb-2 text-right">{{ t('analytics.skills.win') }}</th><th class="pb-2 text-right">{{ t('analytics.skills.pick') }}</th><th class="pb-2 text-right">{{ t('analytics.skills.games') }}</th></tr>
      </thead>
      <tbody class="divide-y divide-default/50">
        <tr v-for="(path, index) in paths[tab]" :key="index" class="h-10">
          <td><span class="flex gap-0.5"><span v-for="(key, level) in path.order" :key="level" class="flex size-6 items-center justify-center rounded text-[11px] font-bold" :class="COLORS[key]">{{ key }}</span></span></td>
          <td class="text-right font-semibold tabular-nums" :class="path.winRate >= 0.5 ? 'text-primary' : 'text-error'">{{ percent(path.winRate) }}</td>
          <td class="text-right tabular-nums text-muted">{{ percent(path.pickRate) }}</td>
          <td class="text-right tabular-nums text-dimmed">{{ path.games.toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
