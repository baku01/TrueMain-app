<script setup lang="ts">
import type { StaticChampionSpellData } from '#shared/types/static-data'

/**
 * An ability of a guide's champion: the app's icon with its tooltip once the
 * champion's data is read, MOBAFire's own picture under it until then — and
 * until the app's icon has loaded, which it covers once decoded. Data
 * Dragon answers one connection at a time per few pictures, so behind a page
 * of icons the app's could be seconds late; the ability order never waits
 * on it.
 */
const props = withDefaults(defineProps<{
  spell: StaticChampionSpellData | null
  /** MOBAFire's picture of the ability. */
  fallback?: string | null
  name?: string
  /** Pixels. */
  size?: number
}>(), { fallback: null, name: '', size: 32 })
const box = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }))
</script>

<template>
  <span class="relative inline-block shrink-0 overflow-hidden rounded-md bg-accented/40 ring-1 ring-default" :style="box">
    <img v-if="fallback" :src="fallback" :alt="spell ? '' : name" :width="size" :height="size" class="absolute inset-0 size-full" decoding="async">
    <GameTooltipChampionSpellIcon v-if="spell" :spell="spell" :width="size" :height="size" transparent class="relative block size-full" />
  </span>
</template>
