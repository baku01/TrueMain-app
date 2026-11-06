<script setup lang="ts">
import type { GameflowPhase, ChampionMastery  } from '~/types/lcu'
import type { QueueFilter } from '~/utils/player-form'
import { QUEUE_FILTERS, championLines, counted, gamesIn, laneLines, mainLane } from '~/utils/player-form'
import { toMatchSummary, toProfileRanked } from '~/utils/match-summary'
import { activityFromGames } from '~/utils/activity-from-games'
import { dailyStandings, latestLpMoves } from '~/utils/lp-history'
import { platformOf, readChampionMastery, regionOfPlatform } from '~/utils/blitz/player'
import { readMasteryPoints } from '~/utils/sources/championmastery'

/**
 * Home: the player, read from their own client, on the profile page the site
 * shows for a true main (`PagePlayerProfile`): the banner on the skin they chose
 * in the client, their form over the latest games, a match history whose rows
 * open the shared detail panel, and their
 * ranked card, day, activity, champions and roles beside it. The banner and the tiles read the latest page
 * of games; the history pages further back. It needs no account on TrueMain:
 * the client knows every player, TrueMain only the true mains (#1682). With no
 * client there is nothing personal to show, so the patch's best picks stand in.
 *
 * Any other player opens here too (`?riotId=Name%23TAG&region=br`): a player
 * clicked in a game, or found by the search — their record read from Blitz
 * (`useViewedPlayer`) on the same page, with "My profile" to come back. Both
 * carry the detailed stats and op.gg's ladder and seasons (`useProfileInsights`).
 *
 * A game that just ended opens here too (`?postMatch=`, set by `app.vue`): the
 * game, opened over the history, with how it went (`DashboardPostMatch`).
 */
const { t } = useT()
const { state } = useLcuState()
const route = useRoute()
const own = usePlayerRecord()
const viewedTarget = computed(() => {
  const riotId = route.query.riotId
  const region = route.query.region
  return typeof riotId === 'string' && riotId ? { riotId, region: typeof region === 'string' && region ? region : null } : null
})
const viewing = computed(() => viewedTarget.value !== null)
const other = useViewedPlayer(viewedTarget)

// Whose profile is on screen: the player's own, from their client, or another's, from Blitz.
const record = computed(() => (viewing.value ? other.record.value : own.record.value))
const loadedGames = computed(() => (viewing.value ? other.games.value : own.games.value))
const rankHistory = computed(() => (viewing.value ? other.rankHistory.value : own.rankHistory.value))
const status = computed(() => (viewing.value ? (other.status.value === 'ready' ? 'ready' : other.status.value === 'pending' || other.status.value === 'idle' ? 'pending' : 'error') : own.status.value))
const hasOlder = computed(() => (viewing.value ? other.hasOlder.value : own.hasOlder.value))
const loadingOlder = computed(() => (viewing.value ? other.loadingOlder.value : own.loadingOlder.value))
const loadOlder = () => (viewing.value ? other.loadOlder() : own.loadOlder())
const refresh = (force = false) => (viewing.value ? other.refresh() : own.refresh(force))
const championsById = useStaticChampionsById()
const { items, summoners, runeTree } = useStaticData()
const { aliasOf, patch } = useChampionStatics()
const backdrop = backdropFraming()

const filter = ref<QueueFilter>('all')
const latest = computed(() => (viewing.value ? loadedGames.value : record.value?.games ?? []))
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
const shownRiotId = computed(() => (viewing.value
  ? other.account.value ? `${other.account.value.gameName}#${other.account.value.tagLine}` : null
  : state.value.riotId))
const nameTag = computed(() => shownRiotId.value?.replace('#', '-') ?? '')
const historyGames = computed(() => gamesIn(loadedGames.value, filter.value))
const activity = computed(() => activityFromGames(loadedGames.value))

const today = useToday(historyGames, loadedGames, rankHistory)

// The form tiles' second yardstick (#2076): the median game of the player's
// Solo/Duo tier on the lane they played most of the games on screen.
const mainRole = computed(() => mainLane(games.value))
const { reference: formReference, benchmark: formBenchmark } = useFormBenchmark(mainRole, computed(() => ranked.value?.tier ?? null))

const identity = computed(() => ({
  gameName: shownRiotId.value?.split('#')[0] ?? (viewing.value ? viewedTarget.value!.riotId.split('#')[0]! : t('app.loggingIn')),
  tagLine: shownRiotId.value?.split('#')[1] ?? null,
  profileIconId: viewing.value ? other.account.value?.profileIconId ?? 0 : state.value.profileIconId,
  platformId: record.value?.platformId ?? null,
}))
const level = computed(() => (viewing.value ? other.account.value?.level ?? null : state.value.summonerLevel))

// Another player's mastery with its exact points (championmastery.gg), Blitz's levels
// where that page has none; the player's own comes with the client's state.
const viewedMastery = ref<ChampionMastery[]>([])
watch(() => (viewing.value && other.account.value ? `${other.region.value}/${other.account.value.gameName}#${other.account.value.tagLine}` : null), async (key) => {
  viewedMastery.value = []
  const account = other.account.value
  const region = other.region.value
  if (!key || !account || !region) return
  const points = await readMasteryPoints(platformOf(region), account.gameName, account.tagLine).catch(() => [])
  const mastery = points.length ? points : await readChampionMastery(region, account.gameName, account.tagLine).catch(() => [])
  if (other.account.value === account) viewedMastery.value = mastery
}, { immediate: true })

// The detail beyond the history, for whoever is on screen.
const insightsQueue = computed(() => filter.value)
const insightsPlayer = computed(() => {
  const riotId = shownRiotId.value
  const region = viewing.value ? other.region.value : record.value?.platformId ? regionOfPlatform(record.value.platformId) : null
  return riotId && region ? { riotId, region } : null
})
const { stats: detailed, opgg, loading: detailLoading } = useProfileInsights(insightsPlayer, insightsQueue)

/** Without a chosen background the client shows the most-mastered champion; so does the app. Another player's: the one they played most of late. */
const splashUrl = computed(() => {
  if (viewing.value) {
    const counts = new Map<number, number>()
    for (const game of loadedGames.value) counts.set(game.championId, (counts.get(game.championId) ?? 0) + 1)
    const most = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
    const alias = most ? aliasOf(most) : backdropAlias()
    return alias ? splashOfAlias(alias) : null
  }
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

onMounted(() => own.refresh())
watch(() => state.value.riotId, () => own.refresh())

// A game that ends reaches the history once the client has its stats: read
// again at the end-of-game screen, and once more on the way back to the lobby.
const POST_GAME: GameflowPhase[] = ['WaitingForStats', 'PreEndOfGame', 'EndOfGame']
watch(() => state.value.phase, (next, previous) => {
  if (next === 'EndOfGame' || (POST_GAME.includes(previous) && !POST_GAME.includes(next))) void own.refresh(true)
})

// The game that just ended, by the moment it did; closed, the URL drops it.
const router = useRouter()
const postMatchAt = computed(() => {
  const at = Number(route.query.postMatch)
  return Number.isFinite(at) && at > 0 ? at : null
})
function closePostMatch() {
  const query = { ...route.query }
  delete query.postMatch
  void router.replace({ query })
}
</script>

<template>
  <div class="flex h-full flex-col gap-4 overflow-y-auto p-5">
    <template v-if="viewing || (state.connected && state.riotId)">
      <PagePlayerProfile
        :identity="identity"
        :patch="patch || null"
        :level="level"
        :ranked="ranked"
        :splash-url="splashUrl"
        :matches="formMatches"
        :form-reference="formReference"
        :loading="pending"
      >
        <template #actions>
          <UButton v-if="viewing" to="/" icon="i-lucide-arrow-left" :label="t('dash.viewing.back')" color="neutral" variant="soft" size="sm" />
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="soft"
            size="sm"
            :label="t('dash.update')"
            :aria-label="t('dash.refresh')"
            :loading="status === 'pending'"
            @click="refresh(true)"
          />
        </template>

        <!-- The queues as Blitz's page tabs, underlined. -->
        <template #tabs>
          <button
            v-for="tab in queueTabs"
            :key="tab.value"
            type="button"
            class="tm-tab shrink-0"
            :data-active="filter === tab.value || undefined"
            :aria-pressed="filter === tab.value"
            @click="filter = tab.value"
          >
            {{ tab.label }}
          </button>
        </template>

        <template #header>
          <UAlert
            v-if="viewing && (other.status.value === 'missing' || other.status.value === 'error')"
            color="neutral"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="other.status.value === 'missing' ? t('dash.viewing.missing') : t('dash.viewing.error')"
          />
          <UAlert
            v-else-if="status === 'error' && !record"
            color="neutral"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="t('dash.error.title')"
            :description="t('dash.error.body')"
            :actions="[{ label: t('dash.error.retry'), color: 'neutral', variant: 'outline', onClick: () => refresh(true) }]"
          />
        </template>

        <template #history>
          <DashboardPostMatch
            v-if="postMatchAt && !viewing"
            :ended-at="postMatchAt"
            :games="loadedGames"
            :tier="ranked?.tier ?? null"
            :name-tag="nameTag"
            :champions="champions"
            :items="items"
            :summoner-spells="summoners"
            :rune-tree="runeTree"
            @close="closePostMatch"
          />
          <DashboardDetailedStats :games="historyGames" :champions="champions" :stats="detailed" :loading="detailLoading" :benchmark="formBenchmark" :tier="ranked?.tier ?? null" />
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
            :blitz-platform="viewing ? record?.platformId ?? null : null"
            @load-older="loadOlder"
          />
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
          <DashboardSeasons :profile="opgg" />
          <DashboardTodayCard v-if="!pending && !viewing" :summary="today" />
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
            <DashboardMasteryCard :mastery="viewing ? viewedMastery : state.championMastery ?? []" :champions="champions" />
            <DashboardRolesCard :lanes="laneLines(games)" />
          </template>
        </template>
      </PagePlayerProfile>
    </template>

    <template v-else>
      <section class="on-art relative flex min-h-60 items-end overflow-hidden rounded-2xl bg-[var(--tm-pane)] p-7">
        <!-- The art on the right, fading into the text on its left: at the banner's whole width a splash shows only a quarter of its height, rarely the face. Each backdrop is framed on its own subject (`backdropFraming`). -->
        <div class="absolute inset-y-0 right-0 w-[62%] [mask-image:linear-gradient(to_right,transparent,black_30%)]">
          <ChampionArt :alias="backdrop.alias" fade="none" :position="backdrop.position" />
        </div>
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
