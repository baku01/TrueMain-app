<!-- Where the Jev integration is tried: the matchup tool's draft board
     (`BuilderDraftBoard`) — our champion and role, the lane opponent, both
     teams — and under it the build Jev picks for that draft, beside the
     selected source's most played (`JevBuildAdvice`). In champion select the
     board fills itself from the client (`useJevClientDraft`). -->
<script setup lang="ts">
import type { CompositionBuildRequest } from '~/types/build'
import { POSITION_OPTIONS, type ChampionPosition } from '#common/utils/positions'
import JevBuildAdvice from '~/components/jev/JevBuildAdvice.vue'

const { t } = useT()

const emptySlots = (): Record<ChampionPosition, number | null> => ({ TOP: null, JUNGLE: null, MIDDLE: null, BOTTOM: null, UTILITY: null })

const playedChampionId = ref<number | null>(null)
const playedPosition = ref<ChampionPosition | null>(null)
const opponentChampionId = ref<number | null>(null)
const allySlots = ref(emptySlots())
const enemySlots = ref(emptySlots())

// Our own lane's slots belong to us and our opponent, not to the teams around us.
watch(playedPosition, (position) => {
  if (position) {
    allySlots.value[position] = null
    enemySlots.value[position] = null
  }
})

// In champion select the board follows the client — our pick, our lane, both teams — until the player turns it off.
const { inDraft, board } = useJevClientDraft()
const following = ref(true)
watch([board, following], ([read, follow]) => {
  if (!read || !follow) return
  if (read.position) playedPosition.value = read.position
  playedChampionId.value = read.championId
  opponentChampionId.value = read.opponentId
  allySlots.value = { ...read.allies }
  enemySlots.value = { ...read.enemies }
}, { immediate: true })

const { data: staticList } = useChampionStaticList()
const champions = computed(() => staticList.value ?? [])

const hasPicks = computed(() => POSITION_OPTIONS.some(option => allySlots.value[option.value] !== null || enemySlots.value[option.value] !== null))

/** The draft as the build reads it: the opponent on our lane among the enemies. */
const request = computed<CompositionBuildRequest | null>(() => {
  const position = playedPosition.value
  if (playedChampionId.value === null || !position) return null
  const filled = (slots: Record<ChampionPosition, number | null>) => POSITION_OPTIONS
    .filter(option => option.value !== position && slots[option.value] !== null)
    .map(option => ({ championId: slots[option.value]!, position: option.value }))
  return {
    position,
    allies: filled(allySlots.value),
    enemies: [...(opponentChampionId.value !== null ? [{ championId: opponentChampionId.value, position }] : []), ...filled(enemySlots.value)],
  }
})
</script>

<template>
  <SharedPage :eyebrow="t('app.page.drafttools')" :title="t('app.page.jev')">
    <div class="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader :title="t('app.page.jev')" :description="t('jev.page.description')" />

      <div v-if="inDraft" class="surface flex flex-wrap items-center gap-3 rounded-xl px-4 py-2.5">
        <span class="relative flex size-2.5">
          <span v-if="following" class="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
          <span class="relative inline-flex size-2.5 rounded-full" :class="following ? 'bg-primary' : 'bg-(--ui-text-dimmed)'" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-highlighted">{{ following ? t('jev.client.reading') : t('jev.client.paused') }}</p>
          <p class="text-xs text-muted">{{ t('jev.client.hint') }}</p>
        </div>
        <USwitch v-model="following" :label="t('jev.client.follow')" />
      </div>

      <BuilderDraftBoard
        :champions="champions"
        :played-champion-id="playedChampionId"
        :played-position="playedPosition"
        :opponent-champion-id="opponentChampionId"
        :ally-slots="allySlots"
        :enemy-slots="enemySlots"
        :has-picks="hasPicks"
        :lane="null"
        :lane-loading="false"
        @update:played-champion-id="playedChampionId = $event"
        @update:played-position="playedPosition = $event"
        @update:opponent-champion-id="opponentChampionId = $event"
        @update:ally="(position, id) => (allySlots[position] = id)"
        @update:enemy="(position, id) => (enemySlots[position] = id)"
        @clear="allySlots = emptySlots(); enemySlots = emptySlots()"
      />

      <DraftTeamDamageMeter v-if="request && playedChampionId !== null" :allies="[{ championId: playedChampionId, position: request.position }, ...request.allies]" :enemies="request.enemies" class="surface rounded-xl px-4 py-3" />
      <JevBuildAdvice v-if="request && playedChampionId !== null" :champion-id="playedChampionId" :request="request" />
      <p v-else class="surface rounded-xl p-6 text-center text-sm text-muted">{{ t('jev.page.pick') }}</p>
    </div>
  </SharedPage>
</template>
