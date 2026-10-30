<script setup lang="ts">
import type { StaticItemData } from '#shared/types/static-data'
import { aroundParam } from '~/utils/split-param'

/**
 * The overlay's next item once it is known — or the starter, until one is
 * bought: the item, its name and the gold still to earn. Drawn by `OverlayNextItem` over a game and by the overlay's
 * preview with a sample, so a panel is placed at the size it will have.
 */
defineProps<{ item: StaticItemData | null, name: string, missing: number, label?: string }>()

const { t } = useT()
const [beforeMissing, afterMissing] = aroundParam('overlay.nextItem.toGo', 'missing')
</script>

<template>
  <div class="flex items-center gap-2.5">
    <GameTooltipItemIcon :item="item" :width="36" :height="36" class="size-9 shrink-0 rounded-lg ring-1 ring-primary/60" />
    <div class="min-w-0 flex-1">
      <!-- One line for the label and the gold, one for the name. -->
      <p class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-dimmed">
        <AppMark class="size-2.5" />
        {{ label ?? t('overlay.nextItem.title') }}
        <span v-if="missing === 0" class="ml-auto flex items-center gap-0.5 normal-case tracking-normal text-stat-gold">
          <UIcon name="i-lucide-circle-check" class="size-3" />
          {{ t('overlay.nextItem.canBuy') }}
        </span>
        <span v-else class="ml-auto normal-case tracking-normal tabular-nums text-muted">
          {{ beforeMissing }}<span class="text-stat-gold">{{ missing }}</span>{{ afterMissing }}
        </span>
      </p>
      <p class="mt-0.5 truncate text-sm font-semibold leading-tight text-highlighted">{{ name }}</p>
    </div>
  </div>
</template>
