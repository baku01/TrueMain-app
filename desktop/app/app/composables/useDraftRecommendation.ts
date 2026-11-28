import type { DraftCandidate, DraftRecommendation } from '~/types/draft'
import type { DraftState } from '~/types/lcu'
import { activeProvider } from '~/utils/sources'
import { draftRecommendationFromSource } from '~/utils/sources/draft'

/** Our allies' champions keyed by lane, locked ones or hovered ones. */
export function alliesByLane(draft: DraftState | null, locked: boolean): Record<string, number> {
  return Object.fromEntries((draft?.myTeam ?? [])
    .filter(slot => slot.locked === locked && !slot.isMe && slot.championId !== null && slot.position)
    .map(slot => [slot.position, slot.championId!]))
}

/** Picks and corrections landing together collapse into one request. */
const DEBOUNCE_MS = 120

/** What the endpoint scores in one request (`MaxCandidates` on the API). */
const CANDIDATES_PER_REQUEST = 40

/**
 * The endpoint's own order, restated for answers merged from several requests:
 * the score, then the id. Each candidate's score depends on it alone, so
 * batches merge without distortion. Thin samples are not pushed back any more:
 * the score already discounts a delta by how few games it rests on (#1906).
 */
function byServerOrder(a: DraftCandidate, b: DraftCandidate) {
  return b.score - a.score || a.championId - b.championId
}

/**
 * The draft answer for the current champion select: the enemy lanes, our lane
 * opponent, and the candidates ranked against both.
 *
 * Re-requested whenever the draft, the user's lane corrections or the pool
 * change. The previous enemy placement is sent back so an equally-good
 * re-solve keeps the panel where it is: picks land one at a time, and a panel
 * that reshuffles while it is being read — with a timer running — is worse
 * than one that is slightly wrong.
 */
export function useDraftRecommendation(
  draft: Ref<DraftState | null>,
  pinnedLanes: Ref<Record<number, string>>,
  candidates: Ref<number[]>,
  /** The player's bracket (`useDraftEloBracket`); null reads every bracket. */
  eloBracket: Ref<string | null> = ref(null),
) {
  const recommendation = ref<DraftRecommendation | null>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)
  // The pool is filtered through the tier list (`useDraftCandidates`): asked before it lands, the pool is empty
  // and the answer would say the player has nothing on the lane. A failed one is retried on its own; meanwhile
  // the source's own tier list still places the enemies.
  const { status: tierList } = useTierList()
  const waiting = computed(() => tierList.value === 'idle' || tierList.value === 'pending')

  /** Allies locked in, keyed by the lane the client assigned them — the synergy's input. */
  const allies = computed(() => alliesByLane(draft.value, true))

  /** Allies only hovering, keyed the same way: counted at half weight and never suggested to us (#1906). */
  const hoveredAllies = computed(() => alliesByLane(draft.value, false))

  /** Guards against an older answer landing after a newer one. */
  let latestRequest = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  async function ask(request: object): Promise<DraftRecommendation> {
    // The sources' tier list and matchups (`utils/sources`); TrueMain's model is never asked.
    return await draftRecommendationFromSource(activeProvider(), request as Parameters<typeof draftRecommendationFromSource>[1])
  }

  async function fetchRecommendation() {
    const state = draft.value
    if (!state || !state.myPosition) {
      recommendation.value = null
      return
    }
    if (waiting.value) return

    const requestId = ++latestRequest
    pending.value = true
    error.value = null

    const base = {
      position: state.myPosition,
      enemyChampions: state.enemyChampions,
      pinnedEnemyLanes: pinnedLanes.value,
      previousEnemyLanes: Object.fromEntries(
        (recommendation.value?.enemyLanes ?? []).map(lane => [lane.championId, lane.position]),
      ),
      allies: allies.value,
      hoveredAllies: hoveredAllies.value,
      bans: [...state.allyBans, ...state.enemyBans],
      // No patch: the API reads its newest one, the previous as a per-champion fallback.
      eloBracket: eloBracket.value,
    }
    // A pool wider than one request is split, and the answers merged: the
    // lanes come from the first, the candidates from all of them.
    const batches: number[][] = []
    for (let start = 0; start < candidates.value.length; start += CANDIDATES_PER_REQUEST) {
      batches.push(candidates.value.slice(start, start + CANDIDATES_PER_REQUEST))
    }
    // No candidate still asks once, with none: the enemy lanes come from the answer, and its empty list is
    // what lets the panel say there is nothing to rank.
    if (!batches.length) batches.push([])

    try {
      const answers = await Promise.all(batches.map(batch => ask({ ...base, candidates: batch })))
      const [first] = answers
      // A stale answer must not overwrite a fresher one; champion select fires
      // these faster than they come back.
      if (first && requestId === latestRequest) {
        recommendation.value = { ...first, candidates: answers.flatMap(answer => answer.candidates).sort(byServerOrder) }
      }
    }
    catch (cause) {
      if (requestId !== latestRequest) return
      // The previous answer stays drawn — an empty panel mid-pick helps nobody — and the error marks it as
      // the previous one (`DraftSuggestions`), never as the current draft's.
      error.value = String(cause)
      // Offline in `npm run dev`: a scenario may carry the answer the API gave.
      if (import.meta.dev && !insideTauri()) recommendation.value = useDevScenarios().recommendation.value
    }
    finally {
      if (requestId === latestRequest) pending.value = false
    }
  }

  // Watched as a string: the draft object is replaced on every client push,
  // the timer ticking included, and only a change in what is asked is a reason
  // to ask again.
  const key = computed(() => JSON.stringify([
    draft.value?.enemyChampions,
    draft.value?.myPosition,
    draft.value?.allyBans,
    draft.value?.enemyBans,
    pinnedLanes.value,
    allies.value,
    hoveredAllies.value,
    candidates.value,
    eloBracket.value,
    waiting.value,
  ]))

  watch(key, () => {
    clearTimeout(timer)
    timer = setTimeout(fetchRecommendation, DEBOUNCE_MS)
  }, { immediate: true })

  onScopeDispose(() => clearTimeout(timer))

  return { recommendation, pending, error }
}
