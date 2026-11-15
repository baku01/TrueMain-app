<script setup lang="ts">
/**
 * A picture with its fallbacks, the best first: one that fails to load gives
 * way to the next (a skin's splash, then the champion's own, then MOBAFire's
 * banner), and nothing is drawn once none is left. The attributes go to the
 * picture.
 */
defineOptions({ inheritAttrs: false })
const props = defineProps<{ sources: (string | null | undefined)[] }>()
const list = computed(() => props.sources.filter((source): source is string => !!source))
const at = ref(0)
watch(list, (next, previous) => {
  if (next.join('|') !== previous?.join('|')) at.value = 0
})
const source = computed(() => list.value[at.value] ?? null)
</script>

<template>
  <img v-if="source" v-bind="$attrs" :key="source" :src="source" alt="" decoding="async" @error="at++">
</template>
