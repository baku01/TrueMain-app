<script setup lang="ts">
import type { DraftSelection } from '~/composables/useDraftAutoImport'
import type { DraftState } from '~/types/lcu'
import type { ViewedPick } from '~/composables/useDraftSubject'
import type { PickSubject } from '~/composables/useJevPick'

/**
 * Champion select on one screen, no page scroll: each side's bans and the
 * clock over three columns — our team and its damage split, a tabbed card,
 * theirs with who counters each. The card, as Blitz tabs it: — Suggestions while our pick or ban is
 * open (the side lists beside the grid of suggestions), Builds once there is
 * a build to show — whose header holds who ranks (the source or Jev), our
 * lane's duel and the lock; only its body scrolls when it outgrows the
 * window. Jev reorders the same suggestions and lays the build in the
 * same card, on the player's click.
 */
const props = defineProps<{
  draft: DraftState
  /** What the strip says the draft is waiting for. */
  label?: string
}>()

const draft = toRef(props, 'draft')
const { t } = useT()

// Hover, lock and ban, on the player's click (#1909): one instance for every control under this screen.
const { turnLabel } = provideChampSelectActions(draft)

// ─── The pool, and the answer for it ────────────────────────────────────────

const { myPool, hasPool, lanePool, candidates } = useDraftCandidates(draft)

const pinnedLanes = ref<Record<number, string>>({})
// The player's record (standing, latest games) feeds the bracket and the comfort lines; held
// for the session, read again only when stale.
const { refresh: readRecord } = usePlayerRecord()
onMounted(() => void readRecord())
const eloBracket = useDraftEloBracket()
const { recommendation, pending: ranking, error: rankError } = useDraftRecommendation(draft, pinnedLanes, candidates, eloBracket)

/**
 * Bans are the question on our ban turn, and in the planning phase once the
 * player has declared a pick — the one the bans then protect (#1906).
 */
const banTime = computed(() => {
  const action = props.draft.myAction
  if (action?.kind === 'ban' && action.inProgress) return true
  return props.draft.timerPhase === 'PLANNING' && props.draft.myChampion !== null && !props.draft.myChampionLocked
})
const { bans, pending: banPending, error: banError } = useDraftBans(draft, lanePool, banTime, eloBracket)

const enemyLanes = computed(() => recommendation.value?.enemyLanes ?? [])
const { slots, pinned, hasCorrections, swap, reset } = useLaneAssignment(enemyLanes)
watch(pinned, value => (pinnedLanes.value = value), { deep: true })

// ─── The two teams ──────────────────────────────────────────────────────────

const { byLane, allyRows, enemyRows } = useDraftTeamRows(draft, recommendation, slots)

// ─── Whose build, and which half of the screen ──────────────────────────────

const viewed = ref<ViewedPick | null>(null)
const previewed = ref<number | null>(null)
const { subject, shownView, duel } = useDraftSubject(draft, enemyLanes, viewed, previewed)
const { build, pending: buildPending, error: buildError } = useDraftBuild(subject)
// The build selected for our locked pick written into the client on its own, when Settings say so (`useAutoImport`).
const importSelection = shallowRef<DraftSelection | null>(null)
useDraftAutoImport(draft, importSelection)
// The items this draft moves the build toward: shown over the build, and marked inside the Blitz build panel.
const { pushes: itemAdvice, build: draftBuild, buildPending: draftBuildPending } = useDraftItemAdvice(subject)

// ─── The player's own kits (#2185, #2205) ───────────────────────────────────

/** Our pick and lane, while our own build is the one on screen. */
const ownPick = computed(() => {
  const current = subject.value
  if (!current || shownView.value !== null || current.championId !== props.draft.myChampion) return null
  return { championId: current.championId, position: current.request.position }
})
const { kits, kitId, pickKit } = useDraftKits(ownPick)

/** A click reads that champion's build; a second click on it goes back. */
function view(team: 'ally' | 'enemy', championId: number) {
  const isMe = team === 'ally' && championId === props.draft.myChampion
  if (isMe) {
    // Our own card toggles our build while the pick is open; once it is
    // locked the build is already the default, and the click only comes back to it.
    const onMine = mode.value === 'build' && shownView.value === null && previewed.value === null
    viewed.value = null
    previewed.value = null
    showBuild.value = !props.draft.myChampionLocked && !onMine
    return
  }
  viewed.value = shownView.value?.championId === championId ? null : { team, championId }
}

/** Our own build, opened by hand while the pick is still open. */
const showBuild = ref(false)
// A lock, or a new hover, is a new moment in the draft: back to what it calls for.
watch(() => [props.draft.myChampion, props.draft.myChampionLocked].join(':'), () => {
  showBuild.value = false
  previewed.value = null
})

/** Bans on our ban turn, picks while ours is open, with a lane to rank for; the build otherwise. */
const mode = computed<'pick' | 'ban' | 'build'>(() => {
  if (shownView.value || previewed.value !== null || showBuild.value) return 'build'
  if (!byLane.value) return 'build'
  if (banTime.value) return 'ban'
  return !props.draft.myChampionLocked ? 'pick' : 'build'
})

const canGoBack = computed(() => shownView.value !== null || previewed.value !== null || showBuild.value)

/**
 * The one card ringed: the champion whose build and lane are on screen. It is
 * ours by default — our slot, even empty, since the picks ranked are for it —
 * and the clicked champion while its build is shown.
 */
const selectedCell = computed(() => {
  const shown = shownView.value
  if (!shown) return { ally: allyRows.value.findIndex(row => row.me), enemy: -1 }
  const rows = shown.team === 'ally' ? allyRows.value : enemyRows.value
  const index = rows.findIndex(row => row.championId === shown.championId)
  return shown.team === 'ally' ? { ally: index, enemy: -1 } : { ally: -1, enemy: index }
})

/** Its lane opponent, marked on the other side so the duel reads across the board. */
const opponentCell = computed(() => {
  const id = duel.value.opponentId
  if (id === null) return { ally: -1, enemy: -1 }
  const onAllies = shownView.value?.team === 'enemy'
  const index = (onAllies ? allyRows.value : enemyRows.value).findIndex(row => row.championId === id)
  return onAllies ? { ally: index, enemy: -1 } : { ally: -1, enemy: index }
})
function back() {
  viewed.value = null
  previewed.value = null
  showBuild.value = false
}

// ─── The damage mix (#1907) ─────────────────────────────────────────────────

// Who beats each enemy on its lane, under its card.
const enemyCounters = useEnemyCounters(draft, enemyRows, eloBracket)

const { allyDamagePicks, enemyDamagePicks, lockedAllies } = useDraftDamagePicks(draft, allyRows, enemyRows, previewed)

// ─── Jev, in the same screen ────────────────────────────────────────────────

/** The source or Jev ranks the picks and lays the build; kept for the session. Jev only answers a click — its calls are paid. */
const withJev = useState('draft-with-jev', () => false)

/** What a pick with Jev is chosen for: our lane, its opponent, the teams so far, the source's measured candidates. */
const jevPick = computed<PickSubject | null>(() => {
  const candidates = (recommendation.value?.candidates ?? []).filter(candidate => !candidate.thinSample).map(candidate => ({ championId: candidate.championId, score: candidate.score }))
  if (!candidates.length || !props.draft.myPosition) return null
  return {
    position: props.draft.myPosition,
    opponentId: duel.value.opponentId,
    allies: lockedAllies.value.map(ally => ally.championId),
    enemies: props.draft.enemyChampions.map(championId => ({ championId, position: enemyLanes.value.find(lane => lane.championId === championId)?.position ?? null })),
    candidates,
  }
})
const jevPicks = useJevPick(jevPick)
const jevBuildSubject = computed(() => (subject.value ? { championId: subject.value.championId, request: subject.value.request } : null))
// The family Jev ranks within (the lane, the matchup, a playstyle, the one-tricks), read while Jev is on.
const jevBases = useJevBases(jevBuildSubject, withJev)
const jevBuild = useJevBuild(jevBuildSubject, jevBases.chosen)
const jevScores = computed(() => (withJev.value && jevPicks.status.value === 'ready' ? new Map(jevPicks.ranked.value.map(pick => [pick.championId, pick])) : null))

// ─── The tabs ───────────────────────────────────────────────────────────────

/** Suggestions while our pick or ban is open, Builds once there is a build to show — as Blitz tabs its card. */
const tab = ref<'suggestions' | 'builds'>('suggestions')
watch(mode, next => (tab.value = next === 'build' ? 'builds' : 'suggestions'), { immediate: true })
function openTab(next: 'suggestions' | 'builds') {
  if (next === 'builds' && mode.value !== 'build') showBuild.value = true
  if (next === 'suggestions') back()
  tab.value = next
}
const suggestionKind = computed<'pick' | 'ban'>(() => (banTime.value ? 'ban' : 'pick'))

/** The cards in the grid: the bans, Jev's picks once it answered, else the source's re-ranked by the player's weights. */
const { shownPicks, weighted } = useDraftSuggestionItems(draft, recommendation, bans, suggestionKind, { scores: jevScores, ranked: jevPicks.ranked })
const jevStatus = computed(() => (tab.value === 'builds' ? jevBuild.status.value : jevPicks.status.value))
const askJev = () => (tab.value === 'builds' ? jevBuild.ask() : jevPicks.ask())
const jevReadings = computed(() => (!withJev.value ? null : tab.value === 'builds' ? (jevBuild.enemies.value.length ? jevBuild.enemies.value : null) : jevPicks.assessment.value?.readings ?? null))
const subtitle = computed(() => {
  if (!withJev.value) return t('draft.weights.subtitle')
  return jevStatus.value === 'ready' ? t('draft.sugg.fromJev') : t('draft.sugg.askJev')
})

const suggested = computed(() => (recommendation.value?.candidates ?? []).filter(candidate => !candidate.thinSample).map(candidate => candidate.championId))
</script>

<template>
  <!-- One screen, no page scroll: the bans and clock over three columns — our team, the card, theirs. -->
  <div class="relative isolate flex h-full flex-col gap-3 overflow-hidden px-4 pb-3 pt-3">
    <!-- The room: our champion's splash far behind, the two sides' colours rising from their edges. -->
    <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <ChampionArt v-if="duel.championId" :key="duel.championId" :champion-id="duel.championId" kind="splash" fade="none" position="50% 25%" :skeleton="false" class="absolute inset-0 scale-110 opacity-[0.09] blur-2xl transition-opacity duration-700" />
      <div class="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-ally/[0.09] to-transparent" />
      <div class="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-l from-enemy/[0.09] to-transparent" />
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,var(--ui-bg)_100%)]" />
    </div>
      <DraftTopStrip :ally-bans="draft.allyBans" :enemy-bans="draft.enemyBans" :seconds-left="draft.secondsLeft" :label="turnLabel ?? label ?? t('draft.screen.title')" />

    <div class="grid min-h-0 flex-1 grid-cols-[minmax(12rem,19%)_minmax(0,1fr)_minmax(12rem,19%)] gap-3">
      <aside class="flex min-h-0 flex-col gap-3">
        <DraftTeamColumn
          team="ally"
          vertical
          :rows="allyRows"
          :selected-cell="selectedCell.ally"
          :opponent-cell="opponentCell.ally"
          :suggested="suggested"
          :counters="null"
          :damage-picks="allyDamagePicks"
          @view="view('ally', $event)"
        />
        <DraftSideLists class="min-h-0 flex-1" :groups="['favorites', 'tiers']" :position="draft.myPosition" :opponent-id="duel.opponentId" :opponent-counters="[]" :jev-readings="null" @preview="previewed = $event" />
      </aside>

      <!-- The card the draft is for, as Blitz tabs it: suggestions while our pick or ban is open, the build once there is one. -->
      <section class="flex min-h-0 flex-col rounded-xl bg-default/60 ring-1 ring-white/[0.06]">
        <header class="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4">
          <div class="flex gap-5 self-stretch" role="tablist">
            <button
              v-for="entry in ([{ key: 'suggestions', icon: 'i-lucide-sparkle', label: t('draft.tab.suggestions'), disabled: !byLane }, { key: 'builds', icon: 'i-lucide-scroll-text', label: t('draft.tab.builds'), disabled: !subject && draft.myChampion === null }] as const)"
              :key="entry.key"
              type="button"
              role="tab"
              :aria-selected="tab === entry.key"
              :disabled="entry.disabled"
              class="-mb-px flex h-11 items-center gap-1.5 border-b-2 font-display text-[13px] font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-40"
              :class="tab === entry.key ? 'border-primary text-highlighted' : 'border-transparent text-muted hover:text-highlighted'"
              @click="openTab(entry.key)"
            >
              <UIcon :name="entry.icon" class="size-4" />{{ entry.label }}
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2 py-2">
            <!-- Who ranks and builds: the source, or Jev. -->
            <div class="flex overflow-hidden rounded-lg ring-1 ring-inset ring-default">
              <button
                v-for="entry in [{ jev: false, label: t('draft.source.source'), icon: 'i-lucide-database' }, { jev: true, label: 'Jev', icon: 'i-tabler-chess-knight' }]"
                :key="entry.label"
                type="button"
                class="flex h-9 items-center gap-1.5 border-default px-3 text-sm font-semibold transition-colors not-first:border-l disabled:opacity-40"
                :class="withJev === entry.jev ? 'bg-accented/70 text-highlighted' : 'text-muted hover:text-highlighted'"
                :disabled="entry.jev && suggestionKind === 'ban' && tab === 'suggestions'"
                :title="entry.jev ? t('jev.pick.description') : undefined"
                @click="withJev = entry.jev"
              >
                <UIcon :name="entry.icon" class="size-4" :class="entry.jev && withJev ? 'text-primary' : ''" />{{ entry.label }}
              </button>
            </div>
            <UButton
              v-if="withJev && !(suggestionKind === 'ban' && tab === 'suggestions')"
              icon="i-tabler-chess-knight"
              :label="jevStatus === 'ready' ? t('jev.card.again') : t('jev.card.ask')"
              :loading="jevStatus === 'loading'"
              :disabled="tab === 'builds' ? !jevBuildSubject : !jevPick"
              color="neutral"
              variant="soft"
              @click="askJev()"
            />

            <!-- Our lane: us against the one we face, and how often the lane is won. -->
            <div v-if="duel.position" class="flex h-9 items-center gap-1.5 rounded-lg px-2 ring-1 ring-inset ring-default">
              <ChampionPortrait v-if="duel.championId" :champion-id="duel.championId" size="sm" class="size-6! rounded-md! ring-1 ring-ally/60" />
              <span v-else class="size-6 rounded-md border border-dashed border-default" />
              <span class="stat-label">{{ t('draft.duel.vs') }}</span>
              <ChampionPortrait v-if="duel.opponentId" :champion-id="duel.opponentId" size="sm" class="size-6! rounded-md! ring-1 ring-enemy/60" />
              <span v-else class="size-6 rounded-md border border-dashed border-default" />
              <span v-if="build && build.championId === duel.championId && build.lane?.winRate != null" class="text-xs font-semibold tabular-nums text-highlighted" :title="t('draft.duel.laneWinRate')">{{ `${(build.lane.winRate * 100).toFixed(1)}%` }}</span>
            </div>

            <DraftLockButton />
          </div>
        </header>

        <!-- Suggestions: the grid; the side lists live under the teams. -->
        <div v-if="tab === 'suggestions'" class="@container min-h-0 flex-1 overflow-y-auto p-4">
          <div class="min-w-0">
            <UAlert v-if="withJev && jevStatus === 'noKey'" class="mb-4" color="warning" variant="subtle" icon="i-lucide-key-round" :title="t('jev.card.noKey')" :actions="[{ label: t('jev.card.openSettings'), to: '/settings', color: 'warning', variant: 'outline' }]" />
            <UAlert v-else-if="withJev && jevStatus === 'error'" class="mb-4" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.card.error')" />
            <DraftSuggestions
              v-model:my-pool="myPool"
              :mode="suggestionKind"
              :has-pool="hasPool"
              :suggestions="shownPicks"
              :target="suggestionKind === 'ban' && bans ? { kind: bans.target, championIds: bans.targetChampionIds } : null"
              :pending="suggestionKind === 'ban' ? banPending : ranking"
              :error="suggestionKind === 'ban' ? banError : rankError"
              :position="draft.myPosition"
              :allies="lockedAllies"
              :jev-scores="suggestionKind === 'pick' ? jevScores : null"
              :weighted="weighted"
              :subtitle="suggestionKind === 'pick' ? subtitle : null"
              @preview="previewed = $event"
            />
          </div>
        </div>

        <!-- Builds: Jev's, or the source's. -->
        <div v-else class="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          <!-- Jev's: the family it ranks within, then its answer, told to the automatic import like a picked row. -->
          <DraftJevBuild v-if="withJev" :subject="subject" :jev="jevBuild" :bases="jevBases" @selection="importSelection = shownView === null && previewed === null ? $event : importSelection" />

          <BuildView
            v-else-if="subject"
            :kit-id="kitId"
            :champion-id="subject.championId"
            :position="subject.request.position"
            :draft="{ build, pending: buildPending, error: buildError, opponentId: duel.opponentId, label: t('draft.screen.thisDraft'), request: subject.request }"
            :kits="kits"
            :item-advice="itemAdvice"
            :jev-needs="jevBuild.status.value === 'ready' ? jevBuild.needs.value?.team ?? null : null"
            :draft-optionals="jevBuild.status.value === 'ready' ? jevBuild.optionals.value : null"
            compact
            class="flex-1"
            @update:kit-id="pickKit"
            @selection="importSelection = shownView === null && previewed === null ? $event : importSelection"
          >
            <template #advice>
              <DraftItemAdvice :pushes="itemAdvice" :build="draftBuild" :pending="draftBuildPending" />
            </template>
            <template #header>
              <DraftBuildHeader
                :champion-id="subject.championId"
                :position="subject.request.position"
                :can-go-back="canGoBack"
                @back="back"
              />
            </template>
          </BuildView>

          <div v-else class="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
            <UIcon name="i-lucide-scroll-text" class="size-6 text-dimmed" />
            <p class="text-sm text-muted">{{ t('draft.screen.buildEmpty') }}</p>
          </div>
          <!-- A jungler's paths under the build (op.gg), the clear to open the game on. -->
          <JunglePaths v-if="subject && subject.request.position === 'JUNGLE'" :champion-id="subject.championId" class="mt-3" />
        </div>
      </section>

      <aside class="flex min-h-0 flex-col gap-3">
        <DraftTeamColumn
          team="enemy"
          vertical
          :rows="enemyRows"
          :selected-cell="selectedCell.enemy"
          :opponent-cell="opponentCell.enemy"
          :correctable="recommendation !== null"
          :has-corrections="hasCorrections"
          :counters="enemyCounters"
          :damage-picks="enemyDamagePicks"
          @view="view('enemy', $event)"
          @swap="swap"
          @reset="reset"
        />
        <DraftSideLists
          class="min-h-0 flex-1"
          :groups="['counters', 'jev']"
          :position="draft.myPosition"
          :opponent-id="duel.opponentId"
          :opponent-counters="duel.opponentId !== null ? enemyCounters.get(duel.opponentId) ?? [] : []"
          :jev-readings="jevReadings"
          @preview="previewed = $event"
        />
      </aside>
    </div>
  </div>
</template>
