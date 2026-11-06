import type { RankHistoryEntry } from '#shared/types/rank-history'

/**
 * A player's standing in one ranked queue over time, as the LP curves draw it:
 * the ranked card's, over recent weeks, and the LP history tab's, over all a
 * source keeps. Pure functions over the snapshots; who carries them is
 * `utils/sources/rank-history.ts`.
 */

/** The two queues Riot ranks a player by on the Rift, as the client names them. */
export const RANKED_QUEUES = ['RANKED_SOLO_5x5', 'RANKED_FLEX_SR'] as const
export type RankedQueueType = typeof RANKED_QUEUES[number]

/** One standing, with the season's record at that moment where the source gives it. */
export interface LeagueSnapshot extends RankHistoryEntry {
  wins?: number
  losses?: number
}

/** A row of Blitz's `league_lol`: newest first, the time in epoch seconds, apex tiers on rank `I`. */
export interface BlitzLeagueRow {
  tier: string
  rank: string
  league_points: number
  wins: number
  losses: number
  timestamp: number
}

const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER'])

const sameStanding = (a: LeagueSnapshot, b: LeagueSnapshot) =>
  a.tier === b.tier && a.division === b.division && a.leaguePoints === b.leaguePoints && a.wins === b.wins && a.losses === b.losses

/**
 * Blitz's rows as snapshots, oldest first. Blitz writes a row each time it
 * reads the player, so a row that repeats the one before it says nothing new
 * and is dropped; an unranked row has no place on a curve. A standing that
 * moved with no game played (apex decay) stays.
 */
export function leagueSnapshots(rows: readonly BlitzLeagueRow[]): LeagueSnapshot[] {
  const snapshots: LeagueSnapshot[] = []
  for (const row of [...rows].sort((a, b) => a.timestamp - b.timestamp)) {
    const tier = row.tier?.toUpperCase()
    if (!tier || tier === 'NONE' || !Number.isFinite(row.timestamp)) continue
    const snapshot: LeagueSnapshot = {
      capturedAtUtc: new Date(row.timestamp * 1000).toISOString(),
      tier,
      division: APEX.has(tier) || !row.rank ? 'I' : row.rank,
      leaguePoints: row.league_points,
      wins: row.wins,
      losses: row.losses,
    }
    const last = snapshots.at(-1)
    if (!last || !sameStanding(last, snapshot)) snapshots.push(snapshot)
  }
  return snapshots
}

/**
 * Where a new season begins inside the history: Riot resets every record at a
 * season's start, so the first snapshot with fewer games played than the one
 * before it is the new season's. Read from the record rather than from a list
 * of dates, so a season to come is marked without a release. `index` is that
 * snapshot's; the season is named by its year.
 */
export function seasonStarts(history: readonly LeagueSnapshot[]): { index: number, year: number }[] {
  const starts: { index: number, year: number }[] = []
  for (let index = 1; index < history.length; index++) {
    const before = history[index - 1]!
    const after = history[index]!
    if (before.wins === undefined || after.wins === undefined) continue
    if (after.wins + (after.losses ?? 0) < before.wins + (before.losses ?? 0))
      starts.push({ index, year: new Date(after.capturedAtUtc).getUTCFullYear() })
  }
  return starts
}

const DAY_MS = 86_400_000

/** The snapshots of the last `days` days: the ranked card's window, the tab drawing all of them. */
export function sinceDays<T extends RankHistoryEntry>(history: readonly T[], days: number, now = Date.now()): T[] {
  const cutoff = now - days * DAY_MS
  return history.filter(entry => new Date(entry.capturedAtUtc).getTime() >= cutoff)
}
