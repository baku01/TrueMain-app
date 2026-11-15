<script setup lang="ts">
/**
 * The square of a skin a MOBAFire picture names — a listing's or an author's
 * avatar — drawn from the game's tile of it (`useGuideSkin`), 380 pixels to
 * the site's squeezed hundred: the champion's base tile where the skin's
 * fails, the site's picture where the app knows no champion in it. The
 * attributes go to the picture.
 */
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  picture: string | null
  /** The champion by its English name, where the picture's word names none. */
  champion?: string | null
}>()
const { tile, baseTile } = useGuideSkin(() => props.picture, () => props.champion)
</script>

<template>
  <GuidesArt v-bind="$attrs" :sources="[tile, baseTile, picture]" />
</template>
