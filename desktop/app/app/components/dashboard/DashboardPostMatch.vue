<script setup lang="ts">
import type { ChampionStaticListItem, RuneTreeResponse, StaticItemData, StaticSummonerSpellData } from '#shared/types/static-data'
import type { PlayerGame } from '~/types/record'
import { finishedGame } from '~/utils/post-match'

/**
 * The post-match on the dashboard: the game that ended at `endedAt`, opened
 * (`DashboardPostMatchGame`), found among the player's games once the client
 * has its stats — until then a line saying they are on their way, as the
 * history is read again at the end-of-game screen (`pages/index.vue`).
 */
const props = defineProps<{
  /** Epoch ms the app saw the game end at (`?postMatch=`, `app.vue`). */
  endedAt: number
  games: PlayerGame[]
  tier: string | null
  nameTag: string
  champions: ChampionStaticListItem[]
  items: Record<number, StaticItemData>
  summonerSpells: Record<number, StaticSummonerSpellData>
  runeTree: RuneTreeResponse | null
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useT()
const game = computed(() => finishedGame(props.games, props.endedAt))
</script>

<template>
  <DashboardPostMatchGame
    v-if="game"
    :key="game.gameId"
    :game="game"
    :games="games"
    :tier="tier"
    :name-tag="nameTag"
    :champions="champions"
    :items="items"
    :summoner-spells="summonerSpells"
    :rune-tree="runeTree"
    @close="emit('close')"
  />
  <div v-else class="surface flex items-center gap-3 rounded-xl px-4 py-3">
    <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin text-dimmed" />
    <p class="text-sm text-muted">{{ t('postMatch.waiting') }}</p>
    <UButton class="ml-auto" size="xs" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="t('postMatch.close')" @click="emit('close')" />
  </div>
</template>
