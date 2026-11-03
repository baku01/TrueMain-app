<script setup lang="ts">
import type { StaticItemData } from '#shared/types/static-data'
import type { NextItemOrderStep } from '~/utils/next-item'

/**
 * The build as one row of small icons (#2101): where the game stands in the
 * mains' order — completed items dimmed, the next one ringed, the rest still
 * to come, the boots at the step the mains complete them at. Under the next
 * item in the game page's panel and on the overlay.
 */
const { t } = useT()
withDefaults(defineProps<{ steps: NextItemOrderStep[], statics: Record<number, StaticItemData>, size?: number }>(), { size: 24 })
</script>

<template>
  <ol v-if="steps.length" class="flex items-center gap-1.5" :aria-label="t('game.buildOrder')">
    <li v-for="(step, index) in steps" :key="`${step.itemId}-${index}`" class="relative" :aria-current="step.state === 'Next' ? 'step' : undefined">
      <GameTooltipItemIcon
        :item="statics[step.itemId] ?? null"
        :width="size"
        :height="size"
        class="rounded"
        :class="{
          'opacity-35 grayscale': step.state === 'Completed',
          'ring-2 ring-primary': step.state === 'Next',
          'opacity-80': step.state === 'Upcoming',
        }"
        :style="{ width: `${size}px`, height: `${size}px` }"
      />
      <!-- The boots take two purchases: the base pair first, then the finished ones the row shows. The badge is the pair bought first. -->
      <GameTooltipItemIcon
        v-if="step.isBoots && statics[step.itemId]?.from?.[0]"
        :item="statics[statics[step.itemId]!.from![0]!] ?? null"
        :width="12"
        :height="12"
        class="absolute -right-1 -top-1 size-3 rounded-sm ring-1 ring-default"
      />
    </li>
  </ol>
</template>
