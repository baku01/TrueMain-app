<!--
  The one match row of every match list — the profile's history (site and app),
  the favorites, the player-scoped champion page, the builder's games drawer and
  the app's dashboard. A 54 px line: the result as an edge mark and a wash, then
  one component per column (`MatchRowPortrait`, `MatchRowResult`, `MatchRowKda`,
  `MatchRowStats`, `MatchRowLoadout`, `MatchRowTeams`, `MatchRowPerformance`).
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
</script>

<template>
  <!-- Drawn whether on screen or not: skipping a row off screen
       (`content-visibility: auto`, #2129) saved little on a page of ten and
       showed rows empty for a frame when the list was scrolled fast. -->
  <article
    class="@container surface overflow-hidden rounded-lg"
    :aria-label="t('match.row.label', { result: result.label, champion: championName, kda: `${self.kills}/${self.deaths}/${self.assists}` })"
  >
    <!-- The row sizes off its own width, not the viewport (#967): it sits
         full-width on a page, in a ~33rem drawer and on a phone. Columns come
         back as it widens — compositions first (they are what a provenance row
         is read for), then CS/m and duration, then the result and queue label,
         which only repeat the edge mark at a glance. The skeleton mirrors these
         tiers (`MatchRowSkeleton`). `isolate` keeps the wash and the edge under
         the content without positioning every column. -->
    <div
      :role="canExpand ? 'button' : undefined"
      :tabindex="canExpand ? 0 : undefined"
      :aria-expanded="canExpand ? expanded : undefined"
      class="group/row relative isolate flex h-[54px] items-center gap-1.5 pl-3 pr-2 transition-all duration-200 ease-out @sm:gap-2.5 @sm:pl-4 @sm:pr-3"
      :class="canExpand ? 'cursor-pointer hover:bg-white/[0.035] active:bg-white/[0.05]' : ''"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
      <span class="pointer-events-none absolute inset-y-0 left-0 -z-10 w-40 bg-linear-to-r to-transparent transition-opacity duration-200 group-hover/row:opacity-100" :class="result.wash" />
      <span class="absolute inset-y-2 left-0 -z-10 w-[3px] rounded-r-full transition-all duration-200 group-hover/row:w-1" :class="result.edge" />

      <MatchRowPortrait
        :icon-url="champion?.iconUrl ?? null"
        :champion-name="championName"
        :position="self.position ?? null"
        :champion-level="self.championLevel"
      />
      <div class="hidden shrink-0 @[39rem]:block">
        <MatchRowResult :win="self.win" :queue-id="match.queueId" :game-mode="match.gameMode" />
      </div>
      <MatchRowKda :self="self" />
      <div class="hidden shrink-0 @[33rem]:block">
        <MatchRowStats :self="self" :duration-seconds="match.gameDurationSeconds" />
      </div>
      <MatchRowLoadout
        :self="self"
        :items="items"
        :summoner-spells="summonerSpells"
        :rune-tree="runeTree"
      />

      <!-- Right edge, one flex item pushed out by `ml-auto`. The chevron is
           the first thing a phone drops: the whole line is the toggle. -->
      <div class="ml-auto flex shrink-0 items-center gap-1.5 @sm:gap-2.5">
        <div v-if="match.participants.length" class="hidden @[29rem]:block">
          <MatchRowTeams
            :participants="match.participants"
            :self-team-id="self.teamId"
            :champion-by-id="championById"
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
