<script setup lang="ts">
import type { RankHistoryEntry } from '#shared/types/rank-history'
import type { ChampionStaticListItem, RuneTreeResponse, StaticItemData, StaticSummonerSpellData } from '#shared/types/static-data'
import type { PlayerGame } from '~/types/record'
import { counted } from '~/utils/player-form'
import { toMatchSummary } from '~/utils/match-summary'
import { lpDeltaOf } from '~/utils/lp-history'
import { MATCH_DETAIL_SOURCE } from '#common/utils/match-detail-source'
import { blitzMatchDetail, withRanks } from '~/utils/blitz/match-detail'

/**
 * The player's match history, ten games a page with the site's pagination,
 * grouped by day on each page. The pager only counts games already read: older
 * ones are read ahead (`loadOlder`) while the player sits on the last full page
 * there is, so a next page shows up once it has games and never as an empty
 * promise — the client keeps a bounded history, and a page offered past its end
 * had nothing to fill it. Remakes count for nothing and the site never lists
 * one, so neither does this.
 */
const props = defineProps<{
  /** Every game read so far in the chosen queue, newest first. */
  games: PlayerGame[]
  /** Every game read so far, all queues — the neighbours an LP gain is measured between. */
  allGames: PlayerGame[]
  rankHistory: RankHistoryEntry[]
  queue: string
  pending: boolean
  hasOlder: boolean
  loadingOlder: boolean
  champions: ChampionStaticListItem[]
  items: Record<number, StaticItemData>
  summonerSpells: Record<number, StaticSummonerSpellData>
  runeTree: RuneTreeResponse | null
  nameTag: string
  /**
   * Set when the games are another player's, read from Blitz on this platform
   * (`BR1`): an opened row reads its game from Blitz too, and no score is asked
   * of TrueMain.
   */
  blitzPlatform?: string | null
}>()

const emit = defineEmits<{ loadOlder: [] }>()

// An open row reads its game from TrueMain's copy when there is one, else from
// the player's own client — the shared detail panel asks through this.
provide(MATCH_DETAIL_SOURCE, (nameTag, matchId) => {
  if (!props.blitzPlatform) return usePlayerGameDetail(nameTag, matchId)
  const data = ref<Awaited<ReturnType<typeof blitzMatchDetail>>>(null)
  const isLoading = ref(true)
  const notFound = ref(false)
  watch(matchId, async (id) => {
    isLoading.value = true
    data.value = await blitzMatchDetail(`${props.blitzPlatform}_${id}`).catch(() => null)
    notFound.value = !data.value
    isLoading.value = false
    // The ranks come after: ten reads, which the scoreboard need not wait for.
    if (data.value && props.blitzPlatform) {
      const ranked = await withRanks(data.value, props.blitzPlatform).catch(() => null)
      if (ranked && toValue(matchId) === id) data.value = ranked
    }
  }, { immediate: true })
  return { data, isLoading, notFound }
})

// A row's score is TrueMain's when it holds the game, else graded from the client's (#2075).
const storedScores = useTruemainScores(() => (props.blitzPlatform ? '' : props.nameTag))

const { t } = useT()
const PAGE_SIZE = 10
const page = ref(1)
watch(() => props.queue, () => (page.value = 1))

const listed = computed(() => counted(props.games))
const total = computed(() => listed.value.length)
// The list shrank under the page (another queue, a fresh read): land on the last one there is.
watch(total, (value) => {
  page.value = Math.min(page.value, Math.max(1, Math.ceil(value / PAGE_SIZE)))
})
const pageMatches = computed(() => listed.value
  .slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE)
  .map(game => toMatchSummary(
    game,
    lpDeltaOf(game, props.allGames, props.rankHistory),
    storedScores.value[String(game.gameId)],
  )))

// Read ahead until the page after this one is full, or the client has none left
// — a filtered queue can take more than one read.
const short = computed(() => listed.value.length < (page.value + 1) * PAGE_SIZE)
watchEffect(() => {
  if (short.value && props.hasOlder && !props.loadingOlder && !props.pending) emit('loadOlder')
})

const section = ref<HTMLElement | null>(null)
watch(page, () => section.value?.scrollIntoView({ block: 'start', behavior: 'smooth' }))

const loadingPage = computed(() => props.pending || (!pageMatches.value.length && props.loadingOlder))
</script>

<template>
  <!-- No visible heading: the rows say what they are; the name stays for assistive tech. -->
  <section ref="section" class="flex min-w-0 scroll-mt-4 flex-col gap-2" :aria-label="t('dash.history.label')">
    <MatchHistoryList
      v-model:page="page"
      :matches="pageMatches"
      :loading="loadingPage"
      :total="total"
      :page-size="PAGE_SIZE"
      :champions="champions"
      :items="items"
      :summoner-spells="summonerSpells"
      :rune-tree="runeTree"
      :name-tag="nameTag"
      :filtered="queue !== 'all'"
      own
    >
    </MatchHistoryList>
  </section>
</template>
