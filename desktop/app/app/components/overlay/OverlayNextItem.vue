<script setup lang="ts">
import type { GameState } from '~/types/game'
import { basketName } from '~/utils/next-item'

/**
 * The overlay's build path (#2183): the next item and whether the gold in
 * hand buys it, then its recipe and the build as a row (#2101) —
 * `OverlayNextItemPath`, which the preview's sample draws too. No runners-up: a glance over the
 * game takes in one decision. Until a starter is bought, the starter stands
 * in for it: it is what the shop is open for at the start. The game page's
 * panel (`GameNextItem`) keeps the full answer; both read `useNextItemPanel`.
 */
const props = defineProps<{ game: GameState }>()

const { failure, bootsDue, statics, order, top, remaining, path, state, name, starter, starterGold, questReward, fromKit } = useNextItemPanel(toRef(props, 'game'))

/** The gold still to earn before it can be bought; 0 once the gold in hand covers it. */
const { t } = useT()
const missing = computed(() => Math.max(0, remaining.value - props.game.gold))

/** The basket's face: its first item that is not a potion. */
const starterItem = computed(() => {
  const ids = starter.value?.itemIds ?? []
  const face = ids.find(id => !statics.value[id]?.tags?.includes('Consumable')) ?? ids[0]
  return face === undefined ? null : statics.value[face] ?? null
})

const message = computed(() => {
  switch (state.value) {
    case 'unmeasured': return t('overlay.nextItem.unmeasured')
    case 'complete': return t('overlay.nextItem.complete')
    case 'offline': return t('overlay.nextItem.offline')
    default: return null
  }
})
</script>

<template>
  <OverlayNextItemCard v-if="starter" :label="t('overlay.nextItem.starter')" :item="starterItem" :name="basketName(starter.itemIds, name)" :missing="Math.max(0, starterGold - game.gold)" :total="starterGold" />
  <div v-else-if="state === 'ready' && top" class="space-y-2.5">
    <!-- The player's active kit (#2185) answers under its own label: its next step, not the mains'. -->
    <OverlayNextItemCard :item="statics[top.itemId] ?? null" :name="name(top.itemId)" :missing="missing" :total="remaining" :label="fromKit ? t('overlay.nextItem.kit') : bootsDue ? t('overlay.nextItem.boots') : t('overlay.nextItem.title')" />
    <OverlayNextItemPath :path="path" :order="order" :statics="statics" :gold="game.gold" />
  </div>
  <div v-else class="flex items-center gap-2.5">
    <USkeleton v-if="!message" class="size-9 shrink-0 rounded-md" />
    <AppMark v-else class="size-4 shrink-0" />
    <div class="min-w-0 flex-1">
      <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">{{ t('overlay.nextItem.title') }}</p>
      <USkeleton v-if="!message" class="mt-1 h-3 w-28" />
      <p v-else class="text-[11px] text-muted">{{ message }}</p>
      <p v-if="state === 'offline' && failure" class="mt-0.5 line-clamp-3 break-all text-[9px] leading-tight text-dimmed">{{ failure }}</p>
    </div>
  </div>
  <!-- A support's quest reward, to pick when the quest is done: picked, never bought (`useStarter`). -->
  <p v-if="questReward" class="mt-2.5 flex items-center gap-1.5 border-t border-default pt-2">
    <GameTooltipItemIcon :item="statics[questReward.itemIds[0]!] ?? null" :width="20" :height="20" class="size-5 shrink-0 rounded" />
    <span class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">{{ t('overlay.nextItem.questReward') }}</span>
    <span class="min-w-0 truncate text-[11px] font-semibold text-highlighted">{{ name(questReward.itemIds[0]!) }}</span>
  </p>
</template>
