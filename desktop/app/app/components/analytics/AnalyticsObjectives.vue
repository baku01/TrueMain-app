<script setup lang="ts">
import type { Objective } from '~/utils/sources/analytics'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * Objectives: how often the champion's team took each first, and its win
 * rate when it did — and, where the source measures it, when the enemy did.
 */
defineProps<{ objectives: Objective[] }>()
const { t } = useT()
const label = (key: string) => {
  const translated = t(`analytics.objective.${key}`)
  return translated === `analytics.objective.${key}` ? key : translated
}
const tone = (value: number) => (value >= 0.52 ? 'text-primary' : value < 0.48 ? 'text-error' : 'text-highlighted')
</script>

<template>
  <table class="w-full text-sm">
    <thead>
      <tr class="stat-label">
        <th class="pb-2 text-left">{{ t('analytics.objectives.objective') }}</th>
        <th colspan="2" class="pb-2 text-right">{{ t('analytics.objectives.secured') }}</th>
        <th colspan="2" class="pb-2 text-right">{{ t('analytics.objectives.conceded') }}</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-default/50">
      <tr v-for="objective in objectives" :key="objective.key" class="h-8">
        <td class="text-muted">{{ label(objective.key) }}</td>
        <td class="text-right tabular-nums text-dimmed">{{ objective.secure ? formatPercentage(objective.secure.pickRate, 1) : '—' }}</td>
        <td class="w-16 text-right font-semibold tabular-nums" :class="objective.secure ? tone(objective.secure.winRate) : ''">{{ objective.secure ? formatPercentage(objective.secure.winRate, 1) : '—' }}</td>
        <td class="text-right tabular-nums text-dimmed">{{ objective.conceded ? formatPercentage(objective.conceded.pickRate, 1) : '—' }}</td>
        <td class="w-16 text-right font-semibold tabular-nums" :class="objective.conceded ? tone(objective.conceded.winRate) : ''">{{ objective.conceded ? formatPercentage(objective.conceded.winRate, 1) : '—' }}</td>
      </tr>
    </tbody>
  </table>
</template>
