<script setup lang="ts">
import type { DraftSelection } from '~/composables/useDraftAutoImport'
import type { DraftSuggestionItem } from '~/types/draft'
import type { DraftState } from '~/types/lcu'
import type { ViewedPick } from '~/composables/useDraftSubject'
import type { PickSubject } from '~/composables/useJevPick'

/**
 * Champion select, composed as Blitz composes it, top to bottom: each side's
 * bans and the clock; a tabbed card — Suggestions while our pick or ban is
 * open (the side lists beside the grid of suggestions), Builds once there is
 * a build to show — whose header holds who ranks (the source or Jev), our
 * lane's duel and the lock; both teams' damage split; then the two teams, ours
 * over theirs. Jev reorders the same suggestions and lays the build in the
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

const pickSuggestions = computed<DraftSuggestionItem[]>(() => (recommendation.value?.candidates ?? []).map(candidate => ({
  championId: candidate.championId,
  reasons: candidate.reasons ?? [],
  thin: candidate.thinSample,
})))

const banSuggestions = computed<DraftSuggestionItem[]>(() => (bans.value?.candidates ?? []).map(candidate => ({
  championId: candidate.championId,
  reasons: candidate.reasons,
  thin: false,
})))

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
const jevBuild = useJevBuild(jevBuildSubject)
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

/** The picks in the grid: Jev's order once it answered, else the source's. */
const shownPicks = computed<DraftSuggestionItem[]>(() => {
  if (suggestionKind.value === 'ban') return banSuggestions.value
  const scores = jevScores.value
  if (!scores) return pickSuggestions.value
  const byId = new Map(pickSuggestions.value.map(item => [item.championId, item]))
  return jevPicks.ranked.value.map(pick => byId.get(pick.championId) ?? { championId: pick.championId, reasons: [], thin: false })
})
const jevStatus = computed(() => (tab.value === 'builds' ? jevBuild.status.value : jevPicks.status.value))
const askJev = () => (tab.value === 'builds' ? jevBuild.ask() : jevPicks.ask())
const jevReadings = computed(() => (!withJev.value ? null : tab.value === 'builds' ? (jevBuild.enemies.value.length ? jevBuild.enemies.value : null) : jevPicks.assessment.value?.readings ?? null))
const subtitle = computed(() => {
  if (!withJev.value) return t('draft.sugg.fromSource')
  return jevStatus.value === 'ready' ? t('draft.sugg.fromJev') : t('draft.sugg.askJev')
})

const suggested = computed(() => (recommendation.value?.candidates ?? []).filter(candidate => !candidate.thinSample).map(candidate => candidate.championId))
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto flex max-w-[70rem] flex-col gap-5 px-4 pb-6 pt-3">
      <DraftTopStrip :ally-bans="draft.allyBans" :enemy-bans="draft.enemyBans" :seconds-left="draft.secondsLeft" :label="turnLabel ?? label ?? t('draft.screen.title')" />

      <!-- The card the draft is for, as Blitz tabs it: suggestions while our pick or ban is open, the build once there is one. -->
      <section class="surface rounded-2xl">
        <header class="flex flex-wrap items-center justify-between gap-3 p-3 pb-0">
          <div class="flex overflow-hidden rounded-lg ring-1 ring-inset ring-default" role="tablist">
            <button
              v-for="entry in ([{ key: 'suggestions', icon: 'i-lucide-sparkle', label: t('draft.tab.suggestions'), disabled: !byLane }, { key: 'builds', icon: 'i-lucide-scroll-text', label: t('draft.tab.builds'), disabled: !subject && draft.myChampion === null }] as const)"
              :key="entry.key"
              type="button"
              role="tab"
              :aria-selected="tab === entry.key"
              :disabled="entry.disabled"
              class="flex h-9 items-center gap-1.5 border-default pl-2.5 pr-3.5 text-sm font-semibold transition-colors not-first:border-l disabled:opacity-40"
              :class="tab === entry.key ? 'bg-accented/70 text-highlighted' : 'text-muted hover:text-highlighted'"
              @click="openTab(entry.key)"
            >
              <UIcon :name="entry.icon" class="size-4" />{{ entry.label }}
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2">
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

        <!-- Suggestions: the side lists beside the grid. -->
        <div v-if="tab === 'suggestions'" class="grid gap-3 p-3 lg:grid-cols-[minmax(15rem,1fr)_minmax(0,2.15fr)]">
          <DraftSideLists
            class="max-h-[38rem] overflow-y-auto"
            :position="draft.myPosition"
            :opponent-id="duel.opponentId"
            :opponent-counters="duel.opponentId !== null ? enemyCounters.get(duel.opponentId) ?? [] : []"
            :jev-readings="jevReadings"
            @preview="previewed = $event"
          />
          <div class="rounded-xl bg-accented/10 p-5">
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
              :subtitle="suggestionKind === 'pick' ? subtitle : null"
              @preview="previewed = $event"
            />
          </div>
        </div>

        <!-- Builds: Jev's, or the source's. -->
        <div v-else class="p-4">
          <template v-if="withJev">
            <UAlert v-if="jevStatus === 'noKey'" color="warning" variant="subtle" icon="i-lucide-key-round" :title="t('jev.card.noKey')" :actions="[{ label: t('jev.card.openSettings'), to: '/settings', color: 'warning', variant: 'outline' }]" />
            <UAlert v-else-if="jevStatus === 'error'" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.card.error')" :description="jevBuild.error.value ?? undefined" />
            <JevBuildBody
              v-if="jevStatus === 'ready' && subject"
              :champion-id="subject.championId"
              :ranked="jevBuild.ranked.value"
              :needs="jevBuild.needs.value"
              :enemies="jevBuild.enemies.value"
              :jev-build="jevBuild.jevBuild.value"
              :standard-build="jevBuild.standardBuild.value"
            />
            <div v-else-if="jevStatus === 'loading'" class="flex flex-col gap-3">
              <USkeleton class="h-40 rounded-2xl" />
              <USkeleton class="h-64 rounded-2xl" />
            </div>
            <div v-else class="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
              <UIcon name="i-tabler-chess-knight" class="size-6 text-dimmed" />
              <p class="max-w-md text-sm text-muted">{{ t('jev.coach.idleBuild') }}</p>
            </div>
          </template>

          <BuildView
            v-else-if="subject"
            :kit-id="kitId"
            :champion-id="subject.championId"
            :position="subject.request.position"
            :draft="{ build, pending: buildPending, error: buildError, opponentId: duel.opponentId, label: t('draft.screen.thisDraft'), request: subject.request }"
            :kits="kits"
            :item-advice="itemAdvice"
            compact
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
        </div>
      </section>

      <!-- Both teams' damage split, as Blitz shows it between the card and the teams. -->
      <DraftTeamDamageMeter :allies="allyDamagePicks" :enemies="enemyDamagePicks" class="surface rounded-2xl px-4 py-3" />

      <!-- The teams, ours over theirs. -->
      <div class="flex flex-col gap-4">
        <DraftTeamColumn
          team="ally"
          :rows="allyRows"
          :selected-cell="selectedCell.ally"
          :opponent-cell="opponentCell.ally"
          :suggested="suggested"
          :counters="null"
          @view="view('ally', $event)"
        />
        <DraftTeamColumn
          team="enemy"
          :rows="enemyRows"
          :selected-cell="selectedCell.enemy"
          :opponent-cell="opponentCell.enemy"
          :correctable="recommendation !== null"
          :has-corrections="hasCorrections"
          :counters="enemyCounters"
          @view="view('enemy', $event)"
          @swap="swap"
          @reset="reset"
        />
      </div>
    </div>
  </div>
</template>
