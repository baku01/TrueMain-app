<script setup lang="ts">
import type { CompositionBuildRequest } from '~/types/build'
import DraftItemAdvice from '~/components/draft/DraftItemAdvice.vue'

/**
 * The build for a draft, read on its own (`useDraftItemAdvice`) — for a page
 * that has a draft but not the champion select's state: the matchup tool. The
 * same card and the same logic as champion select: the source Settings
 * picked, read against the enemy team and the pros.
 */
const props = defineProps<{ championId: number, request: CompositionBuildRequest }>()
const subject = computed(() => ({ championId: props.championId, request: props.request }))
const { pushes, build, buildPending } = useDraftItemAdvice(subject)
</script>

<template>
  <DraftItemAdvice :pushes="pushes" :build="build" :pending="buildPending" />
</template>
