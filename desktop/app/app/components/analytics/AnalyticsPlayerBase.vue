<script setup lang="ts">
import type { ChampionAnalytics } from '~/utils/sources/analytics'

/**
 * Where the champion sits among all: across, how much it is picked (breadth,
 * log scale, 1 the average); up, how many games each of its players plays on
 * it (depth). Four quarters — niche, popular, unpopular, broad.
 */
const props = defineProps<{ base: NonNullable<ChampionAnalytics['playerBase']> }>()
const { t } = useT()
// Breadth from 0.1 to 10, logarithmic; depth from 0.5 to 2, logarithmic: 1 sits in the middle of both.
const x = computed(() => Math.min(100, Math.max(0, ((Math.log10(props.base.breadth) + 1) / 2) * 100)))
const y = computed(() => Math.min(100, Math.max(0, ((Math.log2(props.base.depth) + 1) / 2) * 100)))
</script>

<template>
  <div>
    <div class="relative aspect-[4/3] rounded-lg border border-default">
      <div class="absolute inset-x-0 top-1/2 border-t border-default" />
      <div class="absolute inset-y-0 left-1/2 border-l border-default" />
      <span class="absolute left-[25%] top-[25%] -translate-x-1/2 -translate-y-1/2 text-xs text-dimmed">{{ t('analytics.playerBase.niche') }}</span>
      <span class="absolute left-[75%] top-[25%] -translate-x-1/2 -translate-y-1/2 text-xs text-dimmed">{{ t('analytics.playerBase.popular') }}</span>
      <span class="absolute left-[25%] top-[75%] -translate-x-1/2 -translate-y-1/2 text-xs text-dimmed">{{ t('analytics.playerBase.unpopular') }}</span>
      <span class="absolute left-[75%] top-[75%] -translate-x-1/2 -translate-y-1/2 text-xs text-dimmed">{{ t('analytics.playerBase.broad') }}</span>
      <span class="absolute size-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--ui-primary)_25%,transparent)]" :style="{ left: `${x}%`, bottom: `${y}%` }" />
    </div>
    <div class="mt-1.5 flex justify-between text-[10px] text-dimmed"><span>{{ t('analytics.playerBase.breadth') }}</span><span class="tabular-nums">{{ base.breadth.toFixed(2) }} · {{ base.depth.toFixed(2) }}</span></div>
    <p class="text-[10px] text-dimmed">{{ t('analytics.playerBase.depth') }} · {{ t('analytics.playerBase.players', { players: base.players.toLocaleString() }) }}</p>
  </div>
</template>
