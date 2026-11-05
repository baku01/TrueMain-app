<script setup lang="ts">
import type { MatchDetailParticipant } from '#shared/types/match-detail'
import { truemainNameTag, truemainProfilePath } from '#shared/utils/truemain-path'

// A scoreboard player's name, linked to their profile when the Riot ID is whole;
// the row's owner in gold, as Blitz marks the local player. The rank has its
// own column (`MatchDetailScoreboardRow`).
const props = defineProps<{
  participant: MatchDetailParticipant
  self?: boolean
}>()

// Profile link for a tracked participant — only when BOTH gameName and tagLine
// are present. A null tagLine would otherwise produce a trailing-dash slug
// (`Name-`) that NameTagParser can't resolve, yielding a 404 link.
const profilePath = computed(() => {
  const { gameName, tagLine } = props.participant
  return gameName && tagLine ? truemainProfilePath(truemainNameTag(gameName, tagLine)) : null
})
const name = computed(() => props.participant.gameName ?? props.participant.summonerName)
</script>

<template>
  <NuxtLink
    v-if="profilePath"
    :to="profilePath"
    class="block truncate text-xs font-semibold transition-colors hover:text-primary"
    :class="self ? 'text-gold' : 'text-default'"
    :title="name"
    @click.stop
  >
    {{ name }}
  </NuxtLink>
  <span v-else class="block truncate text-xs font-semibold" :class="self ? 'text-gold' : 'text-muted'" :title="name">{{ name }}</span>
</template>
