<script setup lang="ts">
import type { GameflowPhase } from '~/types/lcu'
import type { QueueFilter } from '~/utils/player-form'
import { QUEUE_FILTERS, championLines, counted, gamesIn, laneLines, mainLane } from '~/utils/player-form'
import { toMatchSummary, toProfileRanked } from '~/utils/match-summary'
import { activityFromGames } from '~/utils/activity-from-games'
import { dailyStandings, latestLpMoves } from '~/utils/lp-history'

/**
 * Home: the player, read from their own client, on the profile page the site
 * shows for a true main (`PagePlayerProfile`): the banner on the skin they chose
 * in the client, their form over the latest games, a match history whose rows
 * open the shared detail panel with their latest clips under it, and their
 * ranked card, day, activity, champions and roles beside it. The banner and the tiles read the latest page
 * of games; the history pages further back. It needs no account on TrueMain:
 * the client knows every player, TrueMain only the true mains (#1682). With no
 * client there is nothing personal to show, so the patch's best picks stand in.
 */
const { t } = useT()
const { state } = useLcuState()
const { record, games: loadedGames, rankHistory, status, refresh, hasOlder, loadingOlder, loadOlder } = usePlayerRecord()
const championsById = useStaticChampionsById()
const { items, summoners, runeTree } = useStaticData()
const { aliasOf, patch } = useChampionStatics()

const filter = ref<QueueFilter>('all')
const latest = computed(() => record.value?.games ?? [])
const games = computed(() => gamesIn(latest.value, filter.value))
const formMatches = computed(() => counted(games.value).map(game => toMatchSummary(game, null)))
const pending = computed(() => !record.value && (status.value === 'pending' || status.value === 'idle'))

const champions = computed(() => [...championsById.value.values()])
const ranked = computed(() => toProfileRanked(record.value?.ranked.find(queue => queue.queueType === 'RANKED_SOLO_5x5') ?? null))
const flex = computed(() => record.value?.ranked.find(queue => queue.queueType === 'RANKED_FLEX_SR') ?? null)
const lpMoves = computed(() => latestLpMoves(loadedGames.value, rankHistory.value))
const rankCurve = computed(() => dailyStandings(rankHistory.value))
// The region's GM / Challenger lines on the LP curve, from TrueMain (#2174).
const apexCutoffs = useApexCutoffs(() => record.value?.platformId)
const nameTag = computed(() => state.value.riotId?.replace('#', '-') ?? '')
const historyGames = computed(() => gamesIn(loadedGames.value, filter.value))
const activity = computed(() => activityFromGames(loadedGames.value))

const today = useToday(historyGames, loadedGames, rankHistory)

// The form tiles' second yardstick (#2076): the median game of the player's
// Solo/Duo tier on the lane they played most of the games on screen.
const mainRole = computed(() => mainLane(games.value))
const { reference: formReference } = useFormBenchmark(mainRole, computed(() => ranked.value?.tier ?? null))

const identity = computed(() => ({
  gameName: state.value.riotId?.split('#')[0] ?? t('app.loggingIn'),
  tagLine: state.value.riotId?.split('#')[1] ?? null,
  profileIconId: state.value.profileIconId,
  platformId: record.value?.platformId ?? null,
}))

/** Without a chosen background the client shows the most-mastered champion; so does the app. */
const splashUrl = computed(() => {
  const skinId = record.value?.backgroundSkinId
    ?? (state.value.championPool[0] ? state.value.championPool[0] * 1000 : null)
  const alias = skinId ? aliasOf(Math.floor(skinId / 1000)) : backdropAlias()
  if (!alias) return null
  return skinId ? splashOfSkin(alias, skinId % 1000) : splashOfAlias(alias)
})

const QUEUE_LABELS = {
  all: 'dash.queue.all',
  solo: 'dash.queue.solo',
  flex: 'dash.queue.flex',
  normal: 'dash.queue.normal',
  aram: 'dash.queue.aram',
} as const satisfies Record<QueueFilter, string>
const queueTabs = computed(() => QUEUE_FILTERS.map(option => ({ label: t(QUEUE_LABELS[option.value]), value: option.value })))

onMounted(() => refresh())
watch(() => state.value.riotId, () => refresh())

// A game that ends reaches the history once the client has its stats: read
// again at the end-of-game screen, and once more on the way back to the lobby.
const POST_GAME: GameflowPhase[] = ['WaitingForStats', 'PreEndOfGame', 'EndOfGame']
watch(() => state.value.phase, (next, previous) => {
  if (next === 'EndOfGame' || (POST_GAME.includes(previous) && !POST_GAME.includes(next))) void refresh(true)
})
</script>

<template>
  <div class="flex h-full flex-col gap-4 overflow-y-auto p-5">
    <template v-if="state.connected && state.riotId">
      <PagePlayerProfile
        :identity="identity"
        :patch="patch || null"
        :level="state.summonerLevel"
        :ranked="ranked"
        :splash-url="splashUrl"
        :matches="formMatches"
        :form-reference="formReference"
        :loading="pending"
      >
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-house" class="size-6 text-primary" />
            <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ t('dash.title') }}</h1>
            <div class="ml-auto flex items-center gap-2">
              <UTabs
                v-model="filter"
                :items="queueTabs"
                :content="false"
                variant="pill"
                color="neutral"
                size="xs"
                :ui="{ list: 'ring ring-default', indicator: 'rounded-md bg-accented shadow-none', trigger: 'px-3 data-[state=active]:text-highlighted' }"
              />
              <UButton
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="ghost"
                size="sm"
                :loading="status === 'pending'"
                :aria-label="t('dash.refresh')"
                @click="refresh(true)"
              />
            </div>
          </div>
          <UAlert
            v-if="status === 'error' && !record"
            color="neutral"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="t('dash.error.title')"
            :description="t('dash.error.body')"
            :actions="[{ label: t('dash.error.retry'), color: 'neutral', variant: 'outline', onClick: () => refresh(true) }]"
          />
        </template>

        <template #history>
          <DashboardMatchHistory
            :games="historyGames"
            :all-games="loadedGames"
            :rank-history="rankHistory"
            :queue="filter"
            :pending="pending"
            :has-older="hasOlder"
            :loading-older="loadingOlder"
            :champions="champions"
            :items="items"
            :summoner-spells="summoners"
            :rune-tree="runeTree"
            :name-tag="nameTag"
            @load-older="loadOlder"
          />
          <!-- Under the history rather than in the column: it evens out the two sides. -->
          <DashboardClipsCard v-if="!pending" />
        </template>

        <template #aside>
          <ProfileRankedCardSkeleton v-if="pending" />
          <ProfileRankedCard v-else :ranked="ranked" :history="rankCurve" :history-loading="apexCutoffs.loading" :cutoffs="apexCutoffs.cutoffs">
            <template #standing>
              <DashboardFlexStanding :queue="flex" />
            </template>
            <template #moves>
              <DashboardLpMoves :moves="lpMoves" />
            </template>
          </ProfileRankedCard>
          <DashboardTodayCard v-if="!pending" :summary="today" />
          <template v-if="pending">
            <USkeleton class="h-40 rounded-lg" />
            <USkeleton class="h-56 rounded-lg" />
            <USkeleton class="h-40 rounded-lg" />
          </template>
          <template v-else>
            <!-- Folded from the client's games: the patch window needs a patch
                 they do not carry, so the dashboard offers day, week and month. -->
            <ProfileActivityHeatmap :data="activity" :modes="['day', 'week', 'month']" />
            <DashboardChampionsCard :lines="championLines(games)" :champions="champions" />
            <DashboardRolesCard :lanes="laneLines(games)" />
          </template>
        </template>
      </PagePlayerProfile>
    </template>

    <template v-else>
      <section class="relative flex min-h-60 items-end overflow-hidden rounded-2xl border border-default p-7">
        <!-- Anchored near the top of the splash, where its face is: a short band would otherwise show the chest. -->
        <ChampionArt :alias="backdropAlias()" fade="x" position="70% 6%" />
        <div class="relative flex max-w-lg flex-col gap-3">
          <span class="flex items-center gap-2">
            <span class="relative flex size-2">
              <span class="absolute inline-flex size-full animate-tm-pulse rounded-full bg-primary" />
              <span class="relative inline-flex size-2 rounded-full bg-primary/80" />
            </span>
            <span class="eyebrow">{{ state.connected ? t('dash.eyebrow.found') : t('dash.eyebrow.companion') }}</span>
          </span>
          <h1 class="text-4xl font-semibold tracking-tight text-balance text-highlighted">
            <template v-if="state.connected">{{ t('dash.loggingIn.lead') }} <span class="text-primary">{{ t('dash.loggingIn.accent') }}</span>…</template>
            <template v-else>{{ t('dash.waiting.lead') }} <span class="text-primary">{{ t('dash.waiting.accent') }}</span>.</template>
          </h1>
          <p class="text-sm text-muted">
            {{ t('dash.waiting.body') }}
          </p>
        </div>
      </section>

      <DashboardMeta />
    </template>

  </div>
</template>
