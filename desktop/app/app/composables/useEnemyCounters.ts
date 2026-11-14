import type { ChampionMatchups } from '#shared/types/champions/matchups'
import type { TeamRow } from '~/types/draft'
import type { DraftState } from '~/types/lcu'
import type { EnemyCounter } from '~/utils/draft-counters'
import { enemyCounters } from '~/utils/draft-counters'
import { combineMatchups } from '~/utils/sources/combined'
import { lolalyticsMatchups } from '~/utils/sources/lolalytics'
import { matchupsFromBlitz } from '~/utils/blitz/stats'

/**
 * Each enemy's counters on the lane it holds, keyed by the enemy's champion id:
 * its matchups read from lolalytics and Blitz pooled (`combineMatchups`),
 * whatever source Settings picked — not TrueMain's — once per champion, lane
 * and bracket and kept for the session, and the counters re-read from them as
 * champions are picked and banned. An enemy with no lane yet has none.
 */
export function useEnemyCounters(
  draft: Ref<DraftState>,
  enemyRows: Ref<TeamRow[]>,
  eloBracket: Ref<string | null>,
) {
  /** By `enemy-lane-bracket`; null once asked and not answered. */
  const answers = useState<Record<string, ChampionMatchups | null>>('draft-enemy-matchups', () => ({}))

  const asked = computed(() => enemyRows.value.flatMap(row =>
    row.championId !== null && row.lane
      ? [{ championId: row.championId, key: `${row.championId}-${row.lane}-${eloBracket.value ?? ''}`, lane: row.lane }]
      : []))

  watch(asked, (current) => {
    for (const { championId, key, lane } of current) {
      if (key in answers.value) continue
      answers.value = { ...answers.value, [key]: null }
      const query = { position: lane, eloBracket: eloBracket.value ?? undefined }
      void Promise.all([lolalyticsMatchups(championId, query).catch(() => null), matchupsFromBlitz(championId, query).catch(() => null)])
        .then(([lolalytics, blitz]) => {
          if (!lolalytics && !blitz) return
          answers.value = { ...answers.value, [key]: combineMatchups(championId, lane, [lolalytics, blitz]) }
        })
    }
  }, { immediate: true })

  const unavailable = computed(() => new Set([
    ...draft.value.allyChampions,
    ...draft.value.enemyChampions,
    ...draft.value.allyBans,
    ...draft.value.enemyBans,
    ...draft.value.myTeam.flatMap(slot => (slot.championId && slot.locked ? [slot.championId] : [])),
  ]))

  return computed(() => new Map<number, EnemyCounter[]>(asked.value.flatMap(({ championId, key }) => {
    const answer = answers.value[key]
    return answer ? [[championId, enemyCounters(answer.matchups, unavailable.value)]] : []
  })))
}
