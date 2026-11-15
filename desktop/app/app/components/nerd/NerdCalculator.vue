<script setup lang="ts">
import type { ModelReport } from '~/utils/nerd-stats/analysis'
import { naturalUnit, niceStep } from '~/utils/nerd-stats/formula-insights'
import { sigmoid } from '~/utils/nerd-stats/logistic'

/**
 * The formula as a calculator: the player sets a game in the units the game
 * shows — CS a minute, deaths and vision a game of their average length, the
 * lead at 15 minutes — and reads its chance of winning, beside the chance of
 * their average game. Every slider runs over the middle 90% of their own
 * games (5th to 95th percentile) and starts at their average.
 */
const props = defineProps<{
  model: ModelReport
  /** The player's average game length, in minutes: a per-minute rate is set per game of this length. */
  minutes: number
}>()

const { t } = useT()
const f = useNerdFormat()

const rows = computed(() => props.model.features.map((feature) => {
  const unit = naturalUnit(feature.key, props.minutes)
  const binary = unit.format === 'binary'
  const min = binary ? 0 : feature.p5 * unit.scale
  const max = binary ? 1 : feature.p95 * unit.scale
  return { feature, unit, binary, min, max, step: binary ? 1 : niceStep((max - min) / 40), mean: binary ? Math.round(feature.mean) : feature.mean * unit.scale }
}))

// Every metric starts at the player's mean: their "typical game".
const inputs = ref<Record<string, number>>({})
function reset() {
  inputs.value = Object.fromEntries(rows.value.map(row => [row.feature.key, row.mean]))
}
watch(rows, reset, { immediate: true })

const probability = computed(() => sigmoid(rows.value.reduce((total, row) => {
  const value = (inputs.value[row.feature.key] ?? row.mean) / row.unit.scale
  return total + row.feature.beta * (value - row.feature.mean) / row.feature.sd
}, props.model.intercept)))
const typical = computed(() => sigmoid(props.model.intercept))
</script>

<template>
  <div class="nerd-calculator min-w-0 rounded-lg p-3.5">
    <div class="flex items-center gap-3">
      <h3 class="stat-label flex-1">{{ t('nerd.formula.calculator') }}</h3>
      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" :label="t('nerd.formula.reset')" @click="reset" />
    </div>
    <div class="mt-2 flex items-center gap-4">
      <div class="w-28 shrink-0">
        <p class="font-display text-4xl font-semibold leading-none" :class="probability >= typical ? 'text-(--nerd-win)' : 'text-(--nerd-loss)'">{{ f.percent(probability, 0) }}</p>
        <p class="mt-1 text-[10px] text-dimmed">{{ t('nerd.formula.probability') }}</p>
      </div>
      <div class="min-w-0 flex-1">
        <div class="relative h-2.5 rounded-full bg-(--nerd-loss)/25">
          <div class="absolute inset-y-0 left-0 rounded-full bg-(--nerd-win) transition-[width] duration-300" :style="{ width: `${probability * 100}%` }" />
          <span class="absolute inset-y-[-3px] left-1/2 w-px bg-(--ui-text-dimmed)" />
          <span class="absolute inset-y-[-4px] w-0.5 rounded-full bg-(--ui-text-highlighted)" :style="{ left: `${typical * 100}%` }" />
        </div>
        <div class="relative mt-1 h-3 text-[10px] tabular-nums text-dimmed">
          <span class="absolute left-0">0%</span>
          <span class="absolute -translate-x-1/2" :style="{ left: `${typical * 100}%` }">{{ t('nerd.formula.typical', { rate: f.percent(typical) }) }}</span>
          <span class="absolute right-0">100%</span>
        </div>
      </div>
    </div>
    <div class="mt-3 grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
      <label v-for="row in rows" :key="row.feature.key" :for="`nerd-calc-${row.feature.key}`" class="block text-xs">
        <span class="flex justify-between gap-2">
          <span class="truncate text-muted">{{ t(`nerd.natural.${row.feature.key}`) }}</span>
          <span class="shrink-0 tabular-nums text-highlighted">{{ row.binary ? (inputs[row.feature.key] ? t('nerd.yes') : t('nerd.no')) : f.unit(row.unit.format, inputs[row.feature.key] ?? row.mean) }}</span>
        </span>
        <input
          :id="`nerd-calc-${row.feature.key}`"
          v-model.number="inputs[row.feature.key]"
          type="range"
          :min="row.min"
          :max="row.max"
          :step="row.step"
          class="nerd-range mt-1 w-full"
        >
      </label>
    </div>
    <div class="mt-3">
      <NerdHowTo :text="t('nerd.formula.calculatorHow')" />
    </div>
  </div>
</template>

<style scoped>
.nerd-calculator {
  background:
    linear-gradient(135deg, color-mix(in oklch, var(--ui-primary) 7%, transparent), transparent 60%),
    var(--tm-pane-2);
  box-shadow: inset 0 0 0 1px var(--ui-border);
}

.nerd-range {
  accent-color: var(--ui-primary);
  height: 1rem;
}
</style>
