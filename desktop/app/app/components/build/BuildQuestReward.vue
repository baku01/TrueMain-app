<script setup lang="ts">
import type { BuildItemSet } from '#shared/types/champions'
import type { StaticItemData } from '#shared/types/static-data'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * A support's quest reward (`utils/support-quest`): the item to pick when the
 * quest is done, named, with its share of the picks — apart from the starting
 * items and the buying order, as it is picked, never bought. Laid as the
 * starting items' block it sits beside.
 */
const { t } = useT()
defineProps<{ reward: BuildItemSet, itemsMap: Record<number, StaticItemData> }>()
</script>

<template>
  <div :title="t('build.questReward.hint')">
    <h2 class="text-sm font-medium text-muted">{{ t('build.questReward.title') }}</h2>
    <div v-for="id in reward.itemIds" :key="id" class="mt-2 flex h-9 items-center gap-2">
      <GameTooltipItemIcon :item="itemsMap[id] ?? null" :width="36" :height="36" class="size-9 shrink-0 rounded" />
      <span class="flex min-w-0 flex-col leading-tight">
        <span class="truncate text-sm font-medium text-highlighted">{{ itemsMap[id]?.name ?? id }}</span>
        <span v-if="reward.games > 0" class="text-xs tabular-nums text-muted">{{ formatPercentage(reward.pickRate, 0) }}</span>
      </span>
    </div>
  </div>
</template>
