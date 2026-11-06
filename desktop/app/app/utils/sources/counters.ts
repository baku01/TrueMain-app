import type { DataSource } from '~/utils/data-source'
import type { CounterRow } from '~/utils/counters'
import { dataSource } from '~/utils/data-source'
import { matchupsFromBlitz } from '~/utils/blitz/stats'
import { lolalyticsLane, readLolalyticsBuild } from '~/utils/sources/lolalytics'
import { readFirst, standInOrder } from '~/utils/sources/stand-in'

/**
 * A champion's counters on a lane (`ChampionCounters`), ranked by each
 * matchup's score — its win rate minus what the two champions' own rates
 * predict. Who measures that score:
 * - Blitz (`champion_matchups_stats`): `matchup_score`, and the lane's own,
 *   `lane_matchup_score` with `lane_win_rate`.
 * - lolalytics (`build-full`'s `enemy` rows): its delta 2, the same reading in
 *   points; no lane.
 * Who does not: TrueMain (a win rate and a lane win rate per opponent, no
 * score), op.gg (three strong and three weak counters, no score), Tencent
 * (a win rate per opponent). With one of those picked, Blitz stands in, then
 * lolalytics (`standInOrder`).
 */
export const COUNTER_SOURCES: readonly DataSource[] = ['blitz', 'lolalytics']

export interface CounterRead { source: DataSource, patch: string | null, rows: CounterRow[] }

const READERS: Partial<Record<DataSource, (championId: number, position: string) => Promise<Omit<CounterRead, 'source'>>>> = {
  blitz: async (championId, position) => {
    const read = await matchupsFromBlitz(championId, { position })
    return {
      patch: read.patch,
      rows: read.matchups.map(entry => ({
        championId: entry.opponentChampionId,
        games: entry.games,
        winRate: entry.winRate,
        score: entry.matchupScore,
        laneWinRate: entry.laneWinRate,
        laneScore: entry.laneMatchupScore,
      })),
    }
  },
  lolalytics: async (championId, position) => {
    const build = await readLolalyticsBuild(championId, position)
    return {
      patch: build?.header.patch ?? null,
      // `[id, win rate, delta 1, delta 2, pick rate, games]`, the rates in percent, the deltas in points.
      rows: (build?.enemy?.[lolalyticsLane(position)] ?? []).map(([id, wr, , delta2, , games]) => ({
        championId: id,
        games,
        winRate: wr / 100,
        score: delta2 / 100,
        laneWinRate: null,
        laneScore: null,
      })),
    }
  },
}

export async function readCounters(championId: number, position: string): Promise<CounterRead> {
  const { source, answer } = await readFirst(
    standInOrder(dataSource.value, COUNTER_SOURCES),
    source => READERS[source]!(championId, position),
    answer => !answer.rows.length,
  )
  return { source, ...answer }
}
