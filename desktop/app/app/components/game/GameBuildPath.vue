<script setup lang="ts">
import type { StaticItemData } from '#shared/types/static-data'
import type { BuildPath } from '~/utils/build-path'

/**
 * The build path (#2183): the next item's components in the order the
 * champion's mains buy them, each owned, bought now with the gold in hand, or
 * later. An intermediate being started (Lost Chapter) opens into its own parts
 * under its small icon. Under the next item on the game page's panel and on
 * the overlay, both from `useNextItemPanel`.
 */
const { t } = useT()
withDefaults(defineProps<{ path: BuildPath, statics: Record<number, StaticItemData>, size?: number }>(), { size: 24 })
</script>

<template>
  <ol v-if="path.entries.length" class="flex flex-wrap items-start gap-x-3 gap-y-2.5" :aria-label="t('game.buildPath')">
    <li v-for="(entry, index) in path.entries" :key="`${entry.itemId}-${index}`">
      <div
        v-if="entry.parts.length"
        class="relative mt-1.5 flex gap-2 rounded-lg px-2 pt-2.5 pb-1 ring-1"
        :class="entry.state === 'buy' ? 'bg-primary/5 ring-primary/30' : 'ring-default'"
        :aria-label="statics[entry.itemId]?.name"
      >
        <GameTooltipItemIcon
          :item="statics[entry.itemId] ?? null"
          :width="16"
          :height="16"
          class="absolute -top-2 left-1.5 size-4 rounded-sm bg-default ring-1 ring-default"
        />
        <GameBuildPathTile v-for="(part, partIndex) in entry.parts" :key="`${part.itemId}-${partIndex}`" :tile="part" :statics="statics" :size="size" />
      </div>
      <GameBuildPathTile v-else :tile="entry" :statics="statics" :size="size" />
    </li>
  </ol>
</template>
