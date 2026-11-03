<script setup lang="ts">
import type { ChampionAnalytics } from '~/utils/sources/analytics'

/** The champion's per-game averages — damage, healing, kills, gold, farm — and its rank among all champions on each. */
defineProps<{ stats: ChampionAnalytics['stats'] }>()
const { t } = useT()
const label = (key: string) => {
  const translated = t(`analytics.stat.${key}`)
  return translated === `analytics.stat.${key}` ? key : translated
}
const value = (number: number) => (Number.isInteger(number) || number >= 100 ? Math.round(number).toLocaleString() : number.toFixed(2))
</script>

<template>
  <table class="w-full text-sm">
    <tbody class="divide-y divide-default/50">
      <tr v-for="stat in stats" :key="stat.key" class="h-8">
        <td class="text-muted">{{ label(stat.key) }}</td>
        <td class="text-right font-semibold tabular-nums text-highlighted">{{ value(stat.value) }}</td>
        <td class="w-14 text-right tabular-nums text-dimmed"><template v-if="stat.rank">#{{ stat.rank }}</template></td>
      </tr>
    </tbody>
  </table>
</template>
