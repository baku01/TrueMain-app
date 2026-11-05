<script setup lang="ts">
import type {
  ChampionStaticListItem,
  RuneTreeResponse,
  StaticItemData,
  StaticSummonerSpellData,
} from '#shared/types/static-data'
import { resolveWinProbability } from '#common/utils/win-probability-swing'
import { hasTimelineCurves } from '#common/utils/timeline-curves'
import { MATCH_DETAIL_SOURCE } from '#common/utils/match-detail-source'

const { t } = useT()

/**
 * Inline match-detail body rendered inside an expanded match row, on the site's
 * profile and the desktop dashboard alike. Reads the game through the page's
 * `MATCH_DETAIL_SOURCE` (TrueMain's copy by default) and lays out the
 * scoreboard, the timeline (the players' gold / XP / CS curves and the win
 * probability, desktop only), a per-player build and skill order
 * (behind a player selector), every player's rune page with what its runes did,
 * and a table of every measure, across Blitz's underlined tabs with the bans
 * on their right. Static-data maps are passed down from the
 * surrounding page so they hit the shared caches instead of being re-fetched
 * per open row.
 */
const props = defineProps<{
  nameTag: string
  matchId: string
  champions: ChampionStaticListItem[]
  items: Record<number, StaticItemData>
  summonerSpells: Record<number, StaticSummonerSpellData>
  runeTree: RuneTreeResponse
  /** Champion of the row's owner — preselects that player in the Build tab. */
  selfChampionId?: number | null
}>()

const readDetail = inject(MATCH_DETAIL_SOURCE, useMatchDetail)
const { data: detail, isLoading, notFound } = readDetail(
  () => props.nameTag,
  () => props.matchId,
)

const participants = computed(() => detail.value?.participants ?? [])
const championsById = useChampionsById(() => props.champions)
const blueTeam = computed(() => participants.value.filter(p => p.teamId === 100))
const redTeam = computed(() => participants.value.filter(p => p.teamId === 200))
const blueWin = computed(() => blueTeam.value[0]?.win ?? false)

// ─── Timeline tab: the win-probability curve (#1911) and the curves (#2102) ──
// Desktop only: built from the client's timeline the app attaches (the API sends
// no curve, #2009); a short game gets no tab rather than an empty chart. Read
// for the row owner's side.
const winProbability = computed(() => (detail.value ? resolveWinProbability(detail.value) : null))
const owner = computed(() => (props.selfChampionId ? participants.value.find(p => p.championId === props.selfChampionId) ?? null : null))
const ownerTeamId = computed(() => owner.value?.teamId ?? 100)
// Above it, the ten players' gold / XP / CS curves (#2102), from the same
// timeline: only when it carries them, so a game without one shows neither.
/** The kills and objectives, wherever the source kept the timeline's events. */
const eventsTimeline = computed(() => (detail.value?.winProbabilityTimeline?.events.length ? detail.value.winProbabilityTimeline : null))
const curvesTimeline = computed(() => {
  const timeline = detail.value?.winProbabilityTimeline
  return hasTimelineCurves(timeline) ? timeline : null
})

type Tab = 'general' | 'stats' | 'events' | 'charts' | 'winProbability' | 'details' | 'runes'
const tabItems = computed(() => [
  { value: 'general' as Tab, label: t('match.panel.overview') },
  { value: 'stats' as Tab, label: t('match.panel.stats') },
  ...(eventsTimeline.value ? [{ value: 'events' as Tab, label: t('match.panel.events') }] : []),
  ...(curvesTimeline.value ? [{ value: 'charts' as Tab, label: t('match.panel.charts') }] : []),
  ...(winProbability.value ? [{ value: 'winProbability' as Tab, label: t('match.panel.winProbability') }] : []),
  { value: 'details' as Tab, label: t('match.panel.build') },
  { value: 'runes' as Tab, label: t('match.panel.runes') },
])
const tab = ref<Tab>('general')

// Each side's bans and objectives, where the source counted them (the app's).
const teamOf = (teamId: number) => detail.value?.teams?.find(team => team.teamId === teamId) ?? null
const canonicalIcon = useCanonicalIcon()
const banIcons = (teamId: number) => (teamOf(teamId)?.bans ?? []).map(id => ({ id, src: canonicalIcon(championsById.value.get(id)?.iconUrl) }))
</script>

<template>
  <!-- Fully opaque body so the expanded panel reads as one card with the row
       header instead of showing page through the tabs and the gaps between
       cards. This used to be `bg-default/90` plus a heavy backdrop-blur to hide
       the animated eclipse behind it; the backdrop no longer renders outside
       the home hero, so the fill can simply be solid.
       `bg-muted` rather than `bg-default`: the body is the *recessed* step of
       the ladder, a well the `surface` panels inside it sit up out of. Painting
       it at the page colour would punch a hole through the row instead. -->
  <div class="border-t border-default bg-muted px-3 pb-3 pt-3">
    <!-- Detailed skeleton, not a spinner: the accordion opens straight to
         ~the loaded height and the real content swaps in without the row
         lurching once the (large) detail fetch resolves. -->
    <MatchDetailSkeleton v-if="isLoading && !detail" />

    <UEmpty
      v-else-if="notFound || !detail"
      size="sm"
      icon="i-lucide-file-question"
      :description="t('match.panel.unavailable')"
    />

    <!-- Blitz's tabs: underlined, the game's bans on the right. Every panel is
         kept once drawn (`v-show`), so going back to one never redraws it. -->
    <div v-else class="@container">
      <div class="flex items-center justify-between gap-4 border-b border-default">
        <nav class="-mb-px flex overflow-x-auto">
          <button
            v-for="item in tabItems"
            :key="item.value"
            type="button"
            class="relative h-10 shrink-0 px-3 text-sm font-medium transition-colors @[40rem]:px-4"
            :class="tab === item.value ? 'text-highlighted' : 'text-muted hover:text-highlighted'"
            :aria-pressed="tab === item.value"
            @click="tab = item.value"
          >
            {{ item.label }}
            <span v-if="tab === item.value" class="absolute bottom-0 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-t-sm bg-primary" />
          </button>
        </nav>
        <div v-if="detail.teams?.some(team => team.bans.length)" class="hidden shrink-0 items-center gap-2 @[62rem]:flex">
          <span class="flex gap-0.5">
            <img v-for="ban in banIcons(100)" :key="ban.id" :src="ban.src ?? undefined" alt="" width="22" height="22" class="img-skeleton size-[22px] rounded">
          </span>
          <span class="text-[11px] font-medium uppercase text-muted">{{ t('match.scoreboard.bans') }}</span>
          <span class="flex gap-0.5">
            <img v-for="ban in banIcons(200)" :key="ban.id" :src="ban.src ?? undefined" alt="" width="22" height="22" class="img-skeleton size-[22px] rounded">
          </span>
        </div>
      </div>

      <div v-show="tab === 'general'" class="mt-3 flex flex-col gap-2">
        <MatchDetailScoreboard
          v-for="side in [{ id: 100, players: blueTeam, win: blueWin }, { id: 200, players: redTeam, win: !blueWin }]"
          :key="side.id"
          :participants="side.players"
          :team-id="side.id"
          :win="side.win"
          :team="teamOf(side.id)"
          :self-participant-id="owner?.participantId ?? null"
          :champions="champions"
          :items="items"
          :summoner-spells="summonerSpells"
          :rune-tree="runeTree"
        />
      </div>

      <MatchDetailStatsTable
        v-show="tab === 'stats'"
        class="mt-3"
        :blue-team="blueTeam"
        :red-team="redTeam"
        :champions="champions"
        :self-participant-id="owner?.participantId ?? null"
      />

      <MatchDetailEventTimeline
        v-if="eventsTimeline"
        v-show="tab === 'events'"
        class="mt-3"
        :timeline="eventsTimeline"
        :perspective-team-id="ownerTeamId"
        :participants="participants"
        :champions="champions"
      />

      <MatchDetailTimelineCurves
        v-if="curvesTimeline"
        v-show="tab === 'charts'"
        class="mt-3"
        :timeline="curvesTimeline"
        :perspective-team-id="ownerTeamId"
        :self-participant-id="owner?.participantId ?? null"
        :participants="participants"
        :champions="champions"
      />

      <MatchDetailWinProbability
        v-if="winProbability"
        v-show="tab === 'winProbability'"
        class="mt-3"
        :win-probability="winProbability"
        :perspective-team-id="ownerTeamId"
        :participants="participants"
        :champions="champions"
      />

      <MatchDetailBuildTab
        v-show="tab === 'details'"
        class="mt-3"
        :blue-team="blueTeam"
        :red-team="redTeam"
        :champions="champions"
        :items="items"
        :self-champion-id="selfChampionId"
      />

      <!-- Container-sized like the Build tab's selector: on a 1440px
           viewport `lg:` matched inside the 2xl drawer too, packing five rune
           pages into a 624px box. -->
      <div v-show="tab === 'runes'" class="mt-3 grid grid-cols-2 gap-2 @md:grid-cols-3 @2xl:grid-cols-5">
        <MatchDetailRunePage
          v-for="p in participants"
          :key="`runes-${p.participantId}`"
          :participant="p"
          :champion="championsById.get(p.championId) ?? null"
          :rune-tree="runeTree"
        />
      </div>
    </div>
  </div>
</template>
