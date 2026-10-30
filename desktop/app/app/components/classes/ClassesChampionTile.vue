<script setup lang="ts">
/** A champion on the classes page: portrait and name, a link to its page. */
defineProps<{
  championId: number
  /** The hover title; the champion's name when the page has nothing to add. */
  title?: string
}>()

const { nameOf, portraitOf } = useChampionStatics()
</script>

<template>
  <NuxtLink
    :to="`/champions/${championId}`"
    :title="title ?? nameOf(championId)"
    class="group flex min-w-0 flex-col items-center gap-1 rounded-lg p-1 transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
  >
    <img
      v-if="portraitOf(championId)"
      :src="portraitOf(championId)!"
      alt=""
      width="48"
      height="48"
      loading="lazy"
      class="img-skeleton size-12 rounded-lg ring-1 ring-default transition group-hover:ring-primary"
    >
    <span v-else class="img-skeleton size-12 rounded-lg" />
    <span class="w-full truncate text-center text-[11px] leading-tight text-muted group-hover:text-highlighted">{{ nameOf(championId) }}</span>
  </NuxtLink>
</template>
