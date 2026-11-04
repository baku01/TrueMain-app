<script setup lang="ts">
import type { Measure } from '~/utils/sources/model'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * Win rate by game length, shortest games on the left: a bar per length
 * band, its height the win rate around 50%, its share of games under it, and
 * its minutes under that when the source says (lolalytics); otherwise the
 * axis reads short to long.
 */
const props = defineProps<{ bands: (Measure & { minutes?: [number, number | null] })[] }>()
const { t } = useT()
const range = computed(() => {
  const rates = props.bands.map(band => band.winRate)
  return { min: Math.min(...rates, 0.45), max: Math.max(...rates, 0.55) }
})
const timed = computed(() => props.bands.some(band => band.minutes))
const minutes = (band: { minutes?: [number, number | null] }) => (band.minutes ? (band.minutes[1] === null ? `${band.minutes[0]}+` : `${band.minutes[0]}–${band.minutes[1]}`) : '')
const height = (value: number) => `${Math.max(6, ((value - range.value.min) / (range.value.max - range.value.min)) * 100)}%`
</script>

<template>
  <div>
    <div class="flex h-36 items-end gap-2">
      <div v-for="(band, index) in bands" :key="index" class="flex h-full flex-1 flex-col justify-end text-center">
        <span class="mb-1 text-[11px] font-semibold tabular-nums" :class="band.winRate >= 0.5 ? 'text-primary' : 'text-error'">{{ formatPercentage(band.winRate, 1) }}</span>
        <div class="rounded-t-md" :class="band.winRate >= 0.5 ? 'bg-primary/60' : 'bg-error/50'" :style="{ height: height(band.winRate) }" />
        <span v-if="timed" class="mt-1 text-[11px] font-medium tabular-nums text-muted">{{ minutes(band) }}</span>
        <span v-if="band.pickRate" class="text-[10px] tabular-nums text-dimmed" :title="t('analytics.gameLength.share')">{{ formatPercentage(band.pickRate, 1) }}</span>
      </div>
    </div>
    <p v-if="timed" class="mt-1.5 text-center text-[10px] text-dimmed">{{ t('analytics.gameLength.axis') }}</p>
    <div v-else class="mt-1 flex justify-between text-[10px] text-dimmed"><span>{{ t('analytics.gameLength.shortest') }}</span><span>{{ t('analytics.gameLength.longest') }}</span></div>
  </div>
</template>
