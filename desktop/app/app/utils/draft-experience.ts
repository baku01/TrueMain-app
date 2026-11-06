import type { BlitzMasteryRow } from '~/utils/blitz/mastery'
import { masteryStatsFromBlitz } from '~/utils/blitz/mastery'
import { truemainPosition } from '~/utils/blitz/client'

/**
 * A champion's strength with the experience of who plays it taken out —
 * LoLTheory's "Fixed Experience" reading ("assuming 25 games played on each
 * champion, to ensure a fair comparison among all champions"; their blog:
 * Gragas junglers averaged 14.6 games on him, Shaco junglers 47.3). A raw win
 * rate rewards the champions one-tricks flock to: their players win more
 * because they know the champion, not because it is strong.
 *
 * Blitz measures what it takes (`champion_postmatch_stats`' `mastery_stats`):
 * per champion and lane, the games and win rate of the players at mastery
 * level 1 and up, 5 and up, 20, 50, 100 and 200 and up — a bracket left out
 * under 500 games (the least it lists is 501). Cut apart, those are disjoint
 * brackets, [1, 5), [5, 20) …, each with its own win rate. Every champion is
 * then read with one experience mix, the lane's: each bracket's win rate
 * weighed by the share of the lane's games played at that mastery, every
 * champion pooled — Blitz's own benchmark is that pool (its
 * `benchmark_win_rate` matched the pooled rate to four decimals on every
 * lane and bracket of 16.22). A count of games cannot be read off those
 * brackets: at 1,252 points a game (LoL Value's median), 25 games are mastery
 * level 5 (21,600 points, the League wiki's table), but the [5, 20) bracket
 * runs from about 17 games to 148, and other queues' games count too. So the
 * common level is the lane's average player rather than LoLTheory's 25 games —
 * every champion compared at one experience, which is what their reading is for.
 *
 * Measured on 16.22, Emerald+, the 271 champion-lanes played at least 10% of
 * their games there: the reading moves a champion 0.63 points (root mean
 * square), at most 2.8 (Neeko mid, 989 games) — Shaco jungle 50.4% → 48.2%,
 * Evelynn 50.0% → 48.1%, Katarina mid 51.0% → 49.4%, Yasuo mid 48.9% → 47.4%
 * down; Qiyana jungle 46.1% → 47.8%, Orianna 48.6% → 50.0%, Taliyah jungle
 * 50.0% → 51.3% up. Its noise is the raw rate's, 1.05 times its standard
 * error at the median, so the suggestions shrink it by the same games.
 */

interface Bracket { from: number, games: number, wins: number }

/** A row's cumulative brackets (level `from` and up), lowest first; the ones Blitz left empty dropped. */
function cumulative(row: BlitzMasteryRow): Bracket[] {
  return Object.entries(row.mastery_stats ?? {})
    .flatMap(([key, entry]) => {
      const from = Number(key)
      const games = entry?.num_games ?? 0
      return Number.isFinite(from) && games > 0 && typeof entry?.win_rate === 'number' ? [{ from, games, wins: games * entry.win_rate }] : []
    })
    .sort((a, b) => a.from - b.from)
}

/** The same cut apart: each bracket's games up to the next one the row lists, the last open-ended. */
function disjoint(brackets: Bracket[]): Bracket[] {
  return brackets.map((bracket, index) => {
    const next = brackets[index + 1]
    return { from: bracket.from, games: bracket.games - (next?.games ?? 0), wins: bracket.wins - (next?.wins ?? 0) }
  })
}

const keyOf = (championId: number, position: string) => `${championId}:${position}`

/**
 * By `championId:position`, how far the champion's win rate moves when its
 * players are given the lane's experience mix, on the 0–1 scale (−0.02 is
 * two points down). A champion Blitz splits no further than one bracket is
 * absent: nothing to reweigh.
 */
export function experienceShifts(rows: BlitzMasteryRow[]): Record<string, number> {
  const lanes = rows.filter(row => row.individual_position !== 'ALL')
  // The lane's games at each level and up, every champion pooled — what a bracket's share is read from.
  const pooled = new Map<string, Map<number, number>>()
  for (const row of lanes) {
    const lane = pooled.get(row.individual_position) ?? new Map<number, number>()
    for (const bracket of cumulative(row)) lane.set(bracket.from, (lane.get(bracket.from) ?? 0) + bracket.games)
    pooled.set(row.individual_position, lane)
  }

  const shifts: Record<string, number> = {}
  for (const row of lanes) {
    const brackets = cumulative(row)
    const lane = pooled.get(row.individual_position)!
    const parts = disjoint(brackets).flatMap((bracket, index) => {
      // The lane's share at this bracket, up to the next one the champion lists: a bracket it lacks folds into the one below.
      const next = brackets[index + 1]
      const share = (lane.get(bracket.from) ?? 0) - (next ? lane.get(next.from) ?? 0 : 0)
      return bracket.games > 0 && share > 0 ? [{ share, rate: bracket.wins / bracket.games, games: bracket.games, wins: bracket.wins }] : []
    })
    if (parts.length < 2) continue
    const shares = parts.reduce((sum, part) => sum + part.share, 0)
    const fixed = parts.reduce((sum, part) => sum + part.share * part.rate, 0) / shares
    const own = parts.reduce((sum, part) => sum + part.wins, 0) / parts.reduce((sum, part) => sum + part.games, 0)
    shifts[keyOf(row.champion_id, truemainPosition(row.individual_position))] = fixed - own
  }
  return shifts
}

/** The shift of one champion on one lane; 0 where Blitz measured none. */
export const shiftOf = (shifts: Record<string, number>, championId: number, position: string) => shifts[keyOf(championId, position)] ?? 0

/**
 * Blitz's shifts at its own bracket (Emerald+, the tier list's): read
 * whatever source Settings picked, since only Blitz measures win rate by
 * mastery (`utils/sources/mastery`). The shift is added to the picked
 * source's own rate — the experience of a champion's players is the
 * player base's, not one site's.
 */
export async function experienceFromBlitz(): Promise<Record<string, number>> {
  return experienceShifts(await masteryStatsFromBlitz())
}
