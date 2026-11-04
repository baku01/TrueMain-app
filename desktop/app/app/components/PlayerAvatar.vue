<script setup lang="ts">
import { accountIconOf } from '~/utils/sources/players'
/**
 * A player's picture — a pro's from Blitz, a ranked player's from op.gg — or,
 * when there is none or it does not load (Blitz lists pictures it no longer
 * has), the player's initials on a tile of the same size, never the
 * webview's broken-image mark.
 */
const props = defineProps<{
  src: string | null | undefined
  name: string
  size: number
  /** The player's region: with a `Name#TAG` and no picture, the account's icon is read for this avatar alone (`accountIconOf`). */
  region?: string | null
}>()

const looked = ref<string | null>(null)
watch(() => [props.src, props.name, props.region] as const, ([src, name, region]) => {
  looked.value = null
  if (src || !region || !name.includes('#')) return
  void accountIconOf(name, region.toLowerCase()).then((url) => {
    if (props.name === name) looked.value = url
  })
}, { immediate: true })
const picture = computed(() => props.src || looked.value)

const failed = ref(false)
watch(() => props.src, () => (failed.value = false))
watch(looked, () => (failed.value = false))

const initials = computed(() => {
  const words = props.name.replace(/#.*$/, '').trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
})
</script>

<template>
  <img
    v-if="picture && !failed"
    :src="picture!"
    alt=""
    :width="size"
    :height="size"
    class="img-skeleton shrink-0 object-cover"
    :style="{ width: `${size}px`, height: `${size}px` }"
    @error="failed = true"
  >
  <span
    v-else
    class="flex shrink-0 items-center justify-center bg-accented font-semibold text-muted"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.max(8, Math.round(size * 0.36))}px` }"
    aria-hidden="true"
  >{{ initials }}</span>
</template>
