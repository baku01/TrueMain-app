<script setup lang="ts">
import type { Confidence } from '~/utils/nerd-stats/insights'

/**
 * How far a finding can be trusted, in a word and three bars like a signal's
 * — strong, moderate, weak, uncertain (`confidenceOf`) — with what the word
 * means and the technical figure it rests on (a p- or q-value) on hover.
 */
const props = defineProps<{
  level: Confidence
  /** The figure behind the word, e.g. `q = 0,003`. */
  detail?: string
}>()

const { t } = useT()
const BARS: Record<Confidence, number> = { strong: 3, moderate: 2, weak: 1, uncertain: 0 }
const tip = computed(() => [t(`nerd.confidence.${props.level}Hint`), props.detail].filter(Boolean).join(' · '))
</script>

<template>
  <UTooltip :text="tip">
    <span class="nerd-confidence" :data-level="level" tabindex="0" :aria-label="`${t('nerd.confidence.label')}: ${t(`nerd.confidence.${level}`)}. ${tip}`">
      <span class="flex items-end gap-[2px]" aria-hidden="true">
        <span v-for="bar in 3" :key="bar" class="nerd-confidence-bar" :style="{ height: `${3 + bar * 2}px` }" :data-on="bar <= BARS[level] || undefined" />
      </span>
      {{ t(`nerd.confidence.${level}`) }}
    </span>
  </UTooltip>
</template>

<style scoped>
.nerd-confidence {
  --level: var(--ui-text-dimmed);
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.1rem;
  white-space: nowrap;
  color: var(--level);
  background: color-mix(in oklch, var(--level) 13%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--level) 28%, transparent);
  cursor: help;
}

.nerd-confidence[data-level='strong'],
.nerd-confidence[data-level='moderate'] {
  --level: var(--ui-primary);
}

.nerd-confidence[data-level='weak'] {
  --level: var(--ui-warning);
}

.nerd-confidence-bar {
  width: 3px;
  border-radius: 1px;
  background: color-mix(in oklch, var(--level) 30%, transparent);
}

.nerd-confidence-bar[data-on] {
  background: var(--level);
}
</style>
