<script setup lang="ts">
import type { ChartTip } from '~/composables/useChartTip'

/**
 * A chart's hover card (`useChartTip`): the value leads and the label follows,
 * each series keyed by a short stroke of its colour, never a filled box.
 */
defineProps<{ tip: ChartTip | null }>()
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0 translate-y-1"
    leave-active-class="transition duration-100 ease-in"
    leave-to-class="opacity-0"
  >
    <div
      v-if="tip"
      class="pointer-events-none absolute z-20 w-max max-w-64 rounded-md bg-default/95 px-2.5 py-1.5 text-xs shadow-lg ring-1 ring-default backdrop-blur-sm"
      :style="{ left: `${tip.x}px`, top: `${tip.y}px`, transform: `translate(${tip.flip ? 'calc(-100% - 12px)' : '12px'}, -50%)` }"
      role="status"
    >
      <p class="mb-0.5 font-medium text-muted">{{ tip.title }}</p>
      <p v-for="line in tip.lines" :key="line.label" class="flex items-center gap-1.5 whitespace-nowrap">
        <span v-if="line.swatch" class="h-0.5 w-3 shrink-0 rounded-full" :style="{ background: line.swatch }" />
        <span class="font-semibold tabular-nums text-highlighted">{{ line.value }}</span>
        <span class="text-muted">{{ line.label }}</span>
      </p>
    </div>
  </Transition>
</template>
