<script setup lang="ts">
import type { ChampionStaticListItem, RuneTreeResponse, StaticItemData, StaticSummonerSpellData } from '#shared/types/static-data'
import type { PlayerGame } from '~/types/record'
import { MATCH_DETAIL_SOURCE } from '#common/utils/match-detail-source'
import { formatDuration } from '#common/utils/relativeTime'
import { resultTone } from '#common/utils/result-tone'
import { positionLabel } from '#common/utils/positions'

/**
 * The game just played, opened: the result over the champion's splash, how
 * it went (`DashboardPostMatchInsights`), and the game's whole detail — the
 * shared panel the history's rows open, its overview, timeline, win
 * probability and charts — already open, as Blitz opens its match page when
 * a game ends. The panel and the insights read the game once, together.
 */
const props = defineProps<{
  game: PlayerGame
  /** The player's games, newest first: their own average is the last-resort yardstick. */
  games: PlayerGame[]
  /** The player's Solo/Duo tier (`EMERALD`); null while unranked. */
  tier: string | null
  nameTag: string
  champions: ChampionStaticListItem[]
  items: Record<number, StaticItemData>
  summonerSpells: Record<number, StaticSummonerSpellData>
  runeTree: RuneTreeResponse | null
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useT()
const { nameOf } = useChampionStatics()

const detail = usePlayerGameDetail(() => props.nameTag, () => String(props.game.gameId))
provide(MATCH_DETAIL_SOURCE, () => detail)

const { benchmark, pending, insights } = usePostMatch(toRef(props, 'game'), toRef(props, 'games'), toRef(props, 'tier'), detail.data)
const result = computed(() => resultTone(props.game.win))
</script>

<template>
  <section class="surface overflow-hidden rounded-xl" :aria-label="t('postMatch.label')">
    <header class="relative isolate flex items-center gap-4 overflow-hidden px-4 py-3">
      <span class="pointer-events-none absolute inset-0 -z-10 bg-linear-to-r to-60% to-transparent" :class="result.wash" />
      <!-- The splash on the right, fading into the result on its left, as the profile's banner lays its art. -->
      <div class="absolute inset-y-0 right-0 -z-10 w-2/3 opacity-30 [mask-image:linear-gradient(to_right,transparent,black_45%)]">
        <ChampionArt :champion-id="game.championId" fade="none" position="60% 20%" />
      </div>
      <ChampionPortrait :champion-id="game.championId" size="md" class="shrink-0 ring-2" :class="result.portrait" />
      <div class="min-w-0">
        <span class="eyebrow">{{ t('postMatch.eyebrow') }}</span>
        <p class="flex items-baseline gap-2">
          <span class="text-xl font-semibold" :class="result.text">{{ result.label }}</span>
          <span class="text-sm font-semibold tabular-nums text-highlighted">{{ game.kills }} / {{ game.deaths }} / {{ game.assists }}</span>
        </p>
        <p class="truncate text-xs text-muted">
          {{ nameOf(game.championId) }}<template v-if="positionLabel(game.position)"> · {{ positionLabel(game.position) }}</template> · {{ formatDuration(game.durationSeconds) }}
        </p>
      </div>
      <UButton class="ml-auto self-start" size="xs" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="t('postMatch.close')" @click="emit('close')" />
    </header>

    <div class="border-t border-default px-4 py-3">
      <DashboardPostMatchInsights :insights="insights" :benchmark="benchmark" :pending="pending" :duration-seconds="game.durationSeconds" />
    </div>

    <MatchDetailPanel
      v-if="runeTree"
      :name-tag="nameTag"
      :match-id="String(game.gameId)"
      :champions="champions"
      :items="items"
      :summoner-spells="summonerSpells"
      :rune-tree="runeTree"
      :self-champion-id="game.championId"
    />
  </section>
</template>
