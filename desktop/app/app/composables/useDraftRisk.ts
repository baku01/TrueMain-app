import type { DraftRecommendation } from '~/types/draft'
import type { DraftState } from '~/types/lcu'
import type { CounterRow } from '~/utils/counters'
import { counterRisk, laneOdds, unknownOpponent } from '~/utils/draft-risk'
import { readCounters } from '~/utils/sources/counters'

/**
 * Each candidate's counter-pick risk (`utils/draft-risk`), by champion, on the
 * 0–1 scale — none while the lane opponent is known. A candidate's matchups
 * are read of the counters' source (`readCounters`: the picked one when it
 * scores matchups, else Blitz, then lolalytics) once per champion and lane and
 * kept for the session, and only while the risk counts: `enabled` off (Jev
 * ranks the picks) or the lane opponent in, nothing is asked.
 */
export function useDraftRisk(draft: Ref<DraftState>, recommendation: Ref<DraftRecommendation | null>, enabled: Ref<boolean>) {
  const { laneEntries } = useTierList()
  /** By `champion-lane`; null once asked and not answered. */
  const answers = useState<Record<string, CounterRow[] | null>>('draft-risk-matchups', () => ({}))

  const unknown = computed(() => {
    const answer = recommendation.value
    const opponent = answer?.laneOpponentChampionId ?? null
    const lane = answer?.enemyLanes.find(entry => entry.championId === opponent)
    return unknownOpponent(draft.value.enemyChampions.length, opponent === null ? null : { confidence: answer!.laneOpponentConfidence, pinned: lane?.pinned ?? false })
  })

  const position = computed(() => draft.value.myPosition)
  const asked = computed(() => (enabled.value && unknown.value > 0 && position.value
    ? (recommendation.value?.candidates ?? []).map(candidate => ({ championId: candidate.championId, key: `${candidate.championId}-${position.value}` }))
    : []))

  watch(asked, (current) => {
    for (const { championId, key } of current) {
      if (key in answers.value) continue
      answers.value = { ...answers.value, [key]: null }
      readCounters(championId, position.value)
        .then(read => (answers.value = { ...answers.value, [key]: read.rows }))
        .catch(() => {})
    }
  }, { immediate: true })

  /** Who the lane may still bring: neither side's picks nor the bans. */
  const odds = computed(() => laneOdds(laneEntries(position.value), new Set([
    ...draft.value.allyChampions,
    ...draft.value.enemyChampions,
    ...draft.value.allyBans,
    ...draft.value.enemyBans,
    ...draft.value.myTeam.flatMap(slot => (slot.championId && slot.locked ? [slot.championId] : [])),
  ])))

  return computed(() => new Map<number, number>(asked.value.flatMap(({ championId, key }) => {
    const rows = answers.value[key]
    return rows ? [[championId, counterRisk(championId, odds.value, rows, unknown.value)]] : []
  })))
}
