<script setup lang="ts">
import type { StaticItemData } from '#shared/types/static-data'
import { aroundParam } from '~/utils/split-param'

/**
 * The overlay's next item once it is known — or the starter, until one is
 * bought: the item, its name and the gold still to earn. Drawn by `OverlayNextItem` over a game and by the overlay's
 * preview with a sample, so a panel is placed at the size it will have.
 */
const props = defineProps<{
  item: StaticItemData | null
  name: string
  missing: number
  label?: string
  /** What the item costs from here; with it, a thin bar fills as the gold in hand comes up to it. */
  total?: number
}>()

const { t } = useT()
const [beforeMissing, afterMissing] = aroundParam('overlay.nextItem.toGo', 'missing')
const ready = computed(() => props.missing === 0)
const progress = computed(() => (props.total && props.total > 0 ? Math.min(100, Math.max(0, (1 - props.missing / props.total) * 100)) : null))
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center gap-2.5">
      <!-- Keyed on the state, so the icon lights up again each time the gold comes to cover a new item. -->
      <GameTooltipItemIcon
        :key="`${item?.id ?? name}-${ready}`"
        :item="item"
        :width="36"
        :height="36"
        class="size-9 shrink-0 rounded-lg ring-1 transition-[box-shadow] duration-300"
        :class="ready ? 'animate-overlay-ready ring-stat-gold/80' : 'ring-primary/60'"
      />
      <div class="min-w-0 flex-1">
        <!-- One line for the label and the gold, one for the name. -->
        <p class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-dimmed">
          <AppMark class="size-2.5" />
          {{ label ?? t('overlay.nextItem.title') }}
          <span v-if="ready" class="ml-auto flex items-center gap-0.5 normal-case tracking-normal text-stat-gold">
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
    <div v-if="progress !== null" class="h-0.5 overflow-hidden rounded-full bg-white/8" aria-hidden="true">
      <span
        class="block h-full rounded-full transition-[width] duration-700 ease-[var(--tm-ease)]"
        :class="ready ? 'bg-stat-gold shadow-[0_0_6px] shadow-stat-gold/70' : 'bg-stat-gold/55'"
        :style="{ width: `${progress}%` }"
      />
    </div>
  </div>
</template>
