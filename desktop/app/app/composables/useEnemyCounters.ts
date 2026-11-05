import type { ChampionMatchups } from '#shared/types/champions/matchups'
import type { TeamRow } from '~/types/draft'
import type { DraftState } from '~/types/lcu'
import type { EnemyCounter } from '~/utils/draft-counters'
import { enemyCounters } from '~/utils/draft-counters'

/**
 * Each enemy's counters on the lane it holds, keyed by the enemy's champion id:
 * its matchups are asked of the active source (TrueMain or the one Settings
 * picked) once per champion, lane and bracket and kept for the session, and the
 * counters are re-read from them as champions are picked and banned. An enemy
 * with no lane yet has none.
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
      apiGet<ChampionMatchups>(`/champions/${championId}/matchups`, { position: lane, eloBracket: eloBracket.value ?? undefined }, { background: true })
        .then(answer => (answers.value = { ...answers.value, [key]: answer }))
        .catch(() => {})
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
