import type { QueueFilter } from '~/utils/player-form'
import { QUEUE_FILTERS } from '~/utils/player-form'

/**
 * The player's season, champion by champion and lane by lane — the profile's
 * Champion pool tab, laid out as Blitz's: a card per lane with its games,
 * record and LP, and in it each champion's win rate, record, KDA and LP.
 * Pure folds over a source's rows; who carries them is
 * `utils/sources/champion-pool.ts`.
 */

/** One champion on one lane in one queue over the season, as a source counts it. */
export interface PoolRow {
  championId: number
  /** `TOP` … `UTILITY`; empty where the source has no lane (a mode without lanes, or a source that does not split them). */
  role: string
  queueId: number
  games: number
  wins: number
  kills: number
  deaths: number
  assists: number
  /** The LP these games moved, over `lpGames` of them: a source measures it only for the games it saw end. */
  lp: number
  lpGames: number
}

export interface PoolChampion {
  championId: number
  games: number
  wins: number
  kills: number
  deaths: number
  assists: number
  /** Null where no game of it was measured. */
  lp: number | null
}

export interface PoolRole {
  role: string
  games: number
  wins: number
  lp: number | null
  champions: PoolChampion[]
}

/** The rows of one queue filter of the profile's (`QUEUE_FILTERS`). */
export function rowsIn(rows: readonly PoolRow[], filter: QueueFilter): PoolRow[] {
  const queues = QUEUE_FILTERS.find(entry => entry.value === filter)?.queues
  return queues ? rows.filter(row => queues.includes(row.queueId)) : [...rows]
}

const measured = (lp: number, games: number) => (games > 0 ? lp : null)

/**
 * The rows folded lane by lane, each lane's champions summed over the queues
 * the rows span; the lanes and the champions in each, most played first.
 */
export function poolRoles(rows: readonly PoolRow[]): PoolRole[] {
  const roles = new Map<string, { games: number, wins: number, lp: number, lpGames: number, champions: Map<number, PoolRow> }>()
  for (const row of rows) {
    if (row.games <= 0) continue
    const role = roles.get(row.role) ?? { games: 0, wins: 0, lp: 0, lpGames: 0, champions: new Map() }
    roles.set(row.role, role)
    role.games += row.games
    role.wins += row.wins
    role.lp += row.lp
    role.lpGames += row.lpGames
    const champion = role.champions.get(row.championId) ?? { ...row, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, lp: 0, lpGames: 0 }
    role.champions.set(row.championId, champion)
    champion.games += row.games
    champion.wins += row.wins
    champion.kills += row.kills
    champion.deaths += row.deaths
    champion.assists += row.assists
    champion.lp += row.lp
    champion.lpGames += row.lpGames
  }
  return [...roles]
    .map(([role, line]) => ({
      role,
      games: line.games,
      wins: line.wins,
      lp: measured(line.lp, line.lpGames),
      champions: [...line.champions.values()]
        .map(champion => ({
          championId: champion.championId,
          games: champion.games,
          wins: champion.wins,
          kills: champion.kills,
          deaths: champion.deaths,
          assists: champion.assists,
          lp: measured(champion.lp, champion.lpGames),
        }))
        .sort((a, b) => b.games - a.games || b.wins - a.wins),
    }))
    .sort((a, b) => b.games - a.games)
}
