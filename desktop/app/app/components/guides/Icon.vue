<script setup lang="ts">
import type { GuideIcon } from '~/utils/mobafire'

/** An item, a rune or a spell of a guide: MOBAFire's picture with its name under it. */
withDefaults(defineProps<{
  icon: GuideIcon
  /** Pixels. */
  size?: number
  round?: boolean
  /** The name under the picture; else only on hover. */
  named?: boolean
  lit?: boolean
}>(), { size: 44, round: false, named: true, lit: false })
</script>

<template>
  <figure class="flex flex-col items-center gap-1.5 text-center" :style="{ width: named ? `${size + 28}px` : undefined }" :title="icon.name">
    <img
      v-if="icon.image"
      :src="icon.image"
      :alt="icon.name"
      :width="size"
      :height="size"
      loading="lazy"
      class="img-skeleton shrink-0 object-cover ring-1"
      :class="[round ? 'rounded-full' : 'rounded-lg', lit ? 'ring-primary/70' : 'ring-white/10']"
      :style="{ width: `${size}px`, height: `${size}px` }"
    >
    <span v-else class="shrink-0 bg-accented" :class="round ? 'rounded-full' : 'rounded-lg'" :style="{ width: `${size}px`, height: `${size}px` }" />
    <figcaption v-if="named" class="line-clamp-2 text-[11px] leading-tight text-toned">{{ icon.name }}</figcaption>
  </figure>
</template>
