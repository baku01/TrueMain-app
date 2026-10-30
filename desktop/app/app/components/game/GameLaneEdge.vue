<script setup lang="ts">
import { formatCount } from '#shared/utils/counts'
import { formatPercentage } from '#shared/utils/ddragon'
import type { LaneEdge } from '~/utils/lane-edge'

/**
 * The arrow between a lane's two players (#1863): towards the side the lane
 * favours — ours on the left — with that side's chance; doubled from a clear
 * edge on. What it starts from is in its tooltip.
 */
const props = defineProps<{ edge: LaneEdge | null | undefined }>()
const { t } = useT()

/** From this chance on the arrow doubles. */
const CLEAR_EDGE = 0.6

const icon = computed(() => {
  const edge = props.edge
  if (!edge || edge.side === 'even') return 'i-lucide-equal'
  const strong = edge.share >= CLEAR_EDGE
  if (edge.side === 'ally') return strong ? 'i-lucide-chevrons-left' : 'i-lucide-chevron-left'
  return strong ? 'i-lucide-chevrons-right' : 'i-lucide-chevron-right'
})

const tone = computed(() => {
  const side = props.edge?.side
  return side === 'ally' ? 'text-ally' : side === 'enemy' ? 'text-enemy' : 'text-dimmed'
})

const tooltip = computed(() => {
  const edge = props.edge
  if (!edge) return ''
  const start = edge.matchupGames
    ? t('game.edge.matchup', { share: formatPercentage(edge.matchup, 0), games: formatCount(edge.matchupGames) })
    : t('game.edge.noMatchup')
  return t('game.edge.tooltip', { start })
})
</script>

<template>
  <UTooltip v-if="edge" :text="tooltip">
    <div class="flex flex-col items-center leading-none" :class="tone">
      <UIcon :name="icon" class="size-5" />
      <span class="mt-0.5 text-[11px] font-semibold tabular-nums">{{ formatPercentage(edge.side === 'even' ? 0.5 : edge.share, 0) }}</span>
    </div>
  </UTooltip>
</template>
