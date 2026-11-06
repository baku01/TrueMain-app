<script setup lang="ts">
import type { WeightKey } from '~/utils/draft-weights'
import { MASTERY_STEPS, PRESET_KEYS, WEIGHT_KEYS } from '~/utils/draft-weights'

/**
 * The pick suggestions' weights, a click away from the Suggestions tab's
 * header, as Blitz offers them in its champion select: the presets as pills,
 * a slider per category (the others give way so the four total 100%), and the
 * mastery floor against the player's top champion. Every change re-ranks the
 * grid at once and is kept for the next champion select (`useSuggestionWeights`).
 */
const { t } = useT()
const { settings, preset, setWeight, applyPreset, setMinMastery, reset } = useSuggestionWeights()
const open = ref(false)

const percent = (value: number) => `${Math.round(value * 100)}%`
const label = computed(() => (preset.value ? t(`draft.weights.preset.${preset.value}`) : t('draft.weights.custom')))

function slide(key: WeightKey, value: number | number[] | undefined) {
  const next = Array.isArray(value) ? value[0] : value
  if (typeof next === 'number') setWeight(key, next / 100)
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'end', sideOffset: 6 }">
    <button
      type="button"
      class="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-inset transition-colors"
      :class="open ? 'bg-accented/70 text-highlighted ring-primary/50' : 'text-muted ring-default hover:text-highlighted'"
      :aria-label="t('draft.weights.title')"
    >
      <UIcon name="i-lucide-sliders-horizontal" class="size-3.5 text-primary" />
      <span class="max-w-28 truncate">{{ label }}</span>
      <UIcon name="i-lucide-chevron-down" class="size-3.5" />
    </button>

    <template #content>
      <div class="flex w-80 flex-col gap-3.5 p-3">
        <header class="flex items-center justify-between gap-2">
          <p class="font-display text-[13px] font-bold uppercase tracking-[0.1em] text-highlighted">{{ t('draft.weights.title') }}</p>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" :label="t('draft.weights.reset')" @click="reset" />
        </header>

        <div class="flex flex-wrap gap-1.5" role="group" :aria-label="t('draft.weights.presets')">
          <UTooltip v-for="key in PRESET_KEYS" :key="key" :text="t(`draft.weights.preset.${key}.hint`)" :delay-duration="250">
            <button
              type="button"
              class="rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition-colors"
              :class="preset === key ? 'bg-primary/15 text-primary ring-primary/50' : 'text-muted ring-default hover:text-highlighted'"
              :aria-pressed="preset === key"
              @click="applyPreset(key)"
            >
              {{ t(`draft.weights.preset.${key}`) }}
            </button>
          </UTooltip>
        </div>

        <div class="flex flex-col gap-2.5">
          <div v-for="key in WEIGHT_KEYS" :key="key" class="flex flex-col gap-1">
            <div class="flex items-baseline justify-between">
              <span class="stat-label" :title="t(`draft.weights.part.${key}.hint`)">{{ t(`draft.weights.part.${key}`) }}</span>
              <span class="text-xs font-semibold tabular-nums text-highlighted">{{ percent(settings.weights[key]) }}</span>
            </div>
            <USlider :model-value="Math.round(settings.weights[key] * 100)" :min="0" :max="100" :step="1" size="xs" @update:model-value="slide(key, $event)" />
          </div>
          <p class="text-[10px] text-dimmed">{{ t('draft.weights.total') }}</p>
        </div>

        <div class="flex flex-col gap-1.5 border-t border-default pt-3">
          <span class="stat-label">{{ t('draft.weights.mastery') }}</span>
          <div class="grid grid-cols-6 gap-1" role="group" :aria-label="t('draft.weights.mastery')">
            <button
              v-for="step in MASTERY_STEPS"
              :key="step"
              type="button"
              class="rounded-md py-1 text-[11px] font-semibold tabular-nums ring-1 ring-inset transition-colors"
              :class="settings.minMastery === step ? 'bg-primary/15 text-primary ring-primary/50' : 'text-muted ring-default hover:text-highlighted'"
              :aria-pressed="settings.minMastery === step"
              @click="setMinMastery(step)"
            >
              {{ step }}%+
            </button>
          </div>
          <p class="text-[10px] text-dimmed">{{ t('draft.weights.masteryHint') }}</p>
        </div>
      </div>
    </template>
  </UPopover>
</template>
