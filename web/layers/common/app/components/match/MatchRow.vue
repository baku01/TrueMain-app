<!--
  The one match row of every match list — the profile's history (site and app),
  the favorites, the player-scoped champion page, the builder's games drawer and
  the app's dashboard. A tile on Blitz's pattern: the result as an edge mark and
  a wash across the tile, the champion's portrait framed and glowing in the
  result's colour, then a title line (result • LP • queue • duration, how long
  ago on the right) over the game's line — `MatchRowLoadout`, `MatchRowKda`, the
  farm, `MatchRowBadges` when the host graded them (`MatchSummaryResponse.badges`)
  — and on the right edge `MatchRowTeams` (named when the tile is wide) and
  `MatchRowPerformance`.
  With a `nameTag` the row is an accordion over the shared `MatchDetailPanel`,
  which reads the game through the page's `MATCH_DETAIL_SOURCE`; without one it
  stays a static article. Host-specific controls (the app's "Watch") go in the
  `actions` slot.
-->
<script setup lang="ts">
import { championDisplayName } from '#shared/utils/champion-name'
import type { MatchSummaryResponse } from '#shared/types/matches'
import type {
  ChampionStaticListItem,
  RuneTreeResponse,
  StaticItemData,
  StaticSummonerSpellData,
} from '#shared/types/static-data'
import { resultTone } from '#common/utils/result-tone'
import { getQueueLabel } from '#common/utils/queues'
import { formatDuration, formatRelativeTime } from '#common/utils/relativeTime'
import { formatSigned } from '#shared/utils/deltas'

const { t } = useT()

const props = defineProps<{
  match: MatchSummaryResponse
  champions: ChampionStaticListItem[]
  items: Record<number, StaticItemData>
  summonerSpells: Record<number, StaticSummonerSpellData>
  runeTree: RuneTreeResponse
  /** The player's Riot ID as the site's slug; the detail is fetched against it, so it gates the accordion. */
  nameTag?: string | null
  /**
   * `champions` keyed by id, built once by a host drawing many rows
   * (`MatchHistoryList`, #2129). Built here from `champions` when absent.
   */
  championById?: Map<number, ChampionStaticListItem>
}>()

const canExpand = computed(() => !!props.nameTag)
const expanded = ref(false)
// Mounted on first open and kept afterwards, so re-opening never re-fetches.
const hasOpened = ref(false)
function toggle() {
  if (!canExpand.value) return
  expanded.value = !expanded.value
  if (expanded.value) hasOpened.value = true
}

// The panel's height is animated from what it measures, then let go: a grid
// row going 0fr → 1fr is animated unevenly across engines (WebKit jumps), and
// a fixed height would clip the detail, which loads after the row opens. Open,
// it sits at `auto` and follows its content; it is pinned to its measured
// height only for the time it moves.
const panel = ref<HTMLElement | null>(null)
const PANEL_MS = 260
let settle: ReturnType<typeof setTimeout> | undefined
watch(expanded, async (open) => {
  await nextTick()
  const el = panel.value
  if (!el) return
  clearTimeout(settle)
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (still) {
    el.style.height = open ? 'auto' : '0px'
    return
  }
  el.style.height = `${open ? 0 : el.scrollHeight}px`
  void el.offsetHeight // the start height, laid out before the move
  el.style.height = `${open ? el.scrollHeight : 0}px`
  if (open) settle = setTimeout(() => (el.style.height = 'auto'), PANEL_MS)
})
onBeforeUnmount(() => clearTimeout(settle))

const self = computed(() => props.match.self)
const championById = computed(() => props.championById ?? new Map(props.champions.map(c => [c.championId, c])))
const champion = computed(() => championById.value.get(self.value.championId))
const championName = computed(() => championDisplayName(self.value.championId, champion.value))

const result = computed(() => resultTone(self.value.win))
const queueLabel = computed(() => getQueueLabel(props.match.queueId, props.match.gameMode))
const ago = computed(() => formatRelativeTime(props.match.gameStartTimeUtc))
const lp = computed(() => self.value.lpDelta ?? null)
const csPerMin = computed(() => (self.value.cs / Math.max(props.match.gameDurationSeconds / 60, 1)).toFixed(1))
</script>

<template>
  <!-- Drawn whether on screen or not: skipping a row off screen
       (`content-visibility: auto`, #2129) saved little on a page of ten and
       showed rows empty for a frame when the list was scrolled fast. -->
  <article
    class="@container surface overflow-hidden rounded-xl"
    :aria-label="t('match.row.label', { result: result.label, champion: championName, kda: `${self.kills}/${self.deaths}/${self.assists}` })"
  >
    <!-- The row sizes off its own width, not the viewport (#967): it sits
         full-width on a page, in a ~33rem drawer and on a phone. Columns come
         back as it widens — compositions first (they are what a provenance row
         is read for), then how long ago, the queue, the farm and the duration,
         then the badges, and the players' names beside the compositions last.
         The skeleton mirrors these tiers (`MatchRowSkeleton`). `isolate` keeps the wash and the edge under
         the content without positioning every column. -->
    <div
      :role="canExpand ? 'button' : undefined"
      :tabindex="canExpand ? 0 : undefined"
      :aria-expanded="canExpand ? expanded : undefined"
      class="group/row relative isolate flex items-center gap-3 py-2.5 pl-3 pr-2 transition-all duration-200 ease-out @sm:gap-4 @sm:pl-4 @sm:pr-3"
      :class="canExpand ? 'cursor-pointer hover:bg-white/[0.035] active:bg-white/[0.05]' : ''"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
      <span class="pointer-events-none absolute inset-0 -z-10 bg-linear-to-r to-60% to-transparent opacity-80 transition-opacity duration-200 group-hover/row:opacity-100" :class="result.wash" />
      <span class="absolute inset-y-2 left-0 -z-10 w-[3px] rounded-r-full transition-all duration-200 group-hover/row:w-1" :class="result.edge" />

      <div class="shrink-0 rounded-lg ring-2" :class="result.portrait">
        <MatchRowPortrait
          :icon-url="champion?.iconUrl ?? null"
          :champion-name="championName"
          :position="self.position ?? null"
          :champion-level="self.championLevel"
          :size="48"
        />
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <!-- The title line: what the game was. The queue and the duration are
             the first things a narrow tile drops; the result never. -->
        <p class="flex min-w-0 items-baseline gap-1.5 text-xs text-muted">
          <span class="shrink-0 text-sm font-semibold" :class="result.text">{{ result.label }}</span>
          <template v-if="lp !== null">
            <span class="text-dimmed" aria-hidden="true">•</span>
            <span class="shrink-0 font-semibold tabular-nums" :class="lp >= 0 ? 'text-data-good' : 'text-data-bad'">{{ formatSigned(lp) }} LP</span>
          </template>
          <span class="hidden text-dimmed @[30rem]:inline" aria-hidden="true">•</span>
          <span class="hidden truncate @[30rem]:inline" :title="queueLabel">{{ queueLabel }}</span>
          <span class="hidden text-dimmed @[36rem]:inline" aria-hidden="true">•</span>
          <span class="hidden shrink-0 tabular-nums @[36rem]:inline">{{ formatDuration(match.gameDurationSeconds) }}</span>
          <span v-if="ago" class="ml-auto hidden shrink-0 pl-2 text-dimmed @[26rem]:inline">{{ ago }}</span>
        </p>

        <div class="flex min-w-0 items-center gap-3 @sm:gap-4">
          <MatchRowLoadout
            :self="self"
            :items="items"
            :summoner-spells="summonerSpells"
            :rune-tree="runeTree"
          />
          <MatchRowKda :self="self" />
          <div class="hidden w-14 shrink-0 leading-tight tabular-nums @[33rem]:block">
            <p class="text-sm font-semibold text-highlighted">{{ t('match.row.cs', { value: self.cs }) }}</p>
            <p class="text-[11px] text-dimmed">{{ t('match.row.csPerMin', { value: csPerMin }) }}</p>
          </div>
          <div v-if="match.badges?.length" class="hidden min-w-0 flex-1 @[44rem]:block">
            <MatchRowBadges :badges="match.badges" />
          </div>
        </div>
      </div>

      <!-- Right edge. The chevron is the first thing a phone drops: the whole tile is the toggle. -->
      <div class="flex shrink-0 items-center gap-1.5 @sm:gap-3">
        <div v-if="match.participants.length" class="hidden @[29rem]:block">
          <MatchRowTeams
            :participants="match.participants"
            :self-team-id="self.teamId"
            :champion-by-id="championById"
            :self-champion-id="self.championId"
          />
        </div>
        <!-- A game nobody graded (a remake, or a client game whose scoreboard
             could not be read) carries no score. -->
        <MatchRowPerformance v-if="self.performanceScore" :self="self" />
        <slot name="actions" />
        <UIcon
          v-if="canExpand"
          name="i-lucide-chevron-down"
          class="hidden size-4 text-dimmed transition-all duration-200 ease-out @[22rem]:block"
          :class="expanded ? 'rotate-180 text-primary' : 'group-hover/row:text-default'"
          aria-hidden="true"
        />
      </div>
    </div>

    <!-- Its height animated from what it measures (`panel` above); `inert`
         takes the collapsed panel's tabs and links out of the keyboard order. -->
    <div
      v-if="canExpand"
      ref="panel"
      class="h-0 overflow-hidden transition-[height] duration-[260ms] ease-[cubic-bezier(0.2,0,0,1)]"
    >
      <div :inert="!expanded">
        <MatchDetailPanel
          v-if="hasOpened"
          :name-tag="nameTag ?? ''"
          :match-id="match.matchId"
          :champions="champions"
          :items="items"
          :summoner-spells="summonerSpells"
          :rune-tree="runeTree"
          :self-champion-id="self.championId"
        />
      </div>
    </div>
  </article>
</template>
