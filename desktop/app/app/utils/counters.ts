/**
 * A champion's counters as Blitz lays them out (its Counters page): who it is
 * strong against and who it is weak against on its lane, ranked by the
 * matchup's score — the matchup's win rate minus what the two champions' own
 * win rates predict — rather than by the bare win rate, which mostly says how
 * strong the champion is this patch. A "laning only" switch ranks by the lane's
 * win rate and its score instead. Pure: the readers are `utils/sources/counters.ts`.
 */
export interface CounterRow {
  championId: number
  games: number
  winRate: number
  /** The win rate minus what the two champions' own rates predict, on the 0–1 scale (0.02 = 2 pp). */
  score: number | null
  laneWinRate: number | null
  /** The same for the lane alone; null where the source measures no lane. */
  laneScore: number | null
}

/** An opponent met in fewer than this share of the champion's games is noise, as on Blitz. */
export const MIN_COUNTER_SHARE = 0.005

const scoreOf = (row: CounterRow, laning: boolean) => (laning ? row.laneScore : row.score)

/**
 * The two tables: the opponents it scores above expectation against, best
 * first, and the ones it scores below against, worst first; the more games
 * first on a tie. A row the switch has no score for is in neither.
 */
export function counterTables(rows: CounterRow[], laning: boolean): { strong: CounterRow[], weak: CounterRow[] } {
  const total = rows.reduce((sum, row) => sum + row.games, 0)
  const kept = rows.filter(row => total > 0 && row.games / total > MIN_COUNTER_SHARE)
  const scored = (sign: 1 | -1) => kept
    .filter(row => (scoreOf(row, laning) ?? 0) * sign > 0)
    .sort((a, b) => sign * (scoreOf(b, laning)! - scoreOf(a, laning)!) || b.games - a.games)
  return { strong: scored(1), weak: scored(-1) }
}

/**
 * How strongly a matchup leans one way, as a tier letter: S from two points
 * up, A from one, B within a point either side, C to two below, D past that —
 * Blitz's own steps. The weak table reads its rows from the opponent's side
 * (the score negated), so its S is the hardest counter.
 */
export function counterTier(score: number): string {
  if (score >= 0.02) return 'S'
  if (score >= 0.01) return 'A'
  if (score > -0.01) return 'B'
  if (score > -0.02) return 'C'
  return 'D'
}

/** A score in percentage points with its sign: `+2.3`, `−1.0`, `0.0`. */
export function formatPoints(score: number): string {
  const points = Math.round(Math.abs(score) * 1000) / 10
  const sign = points === 0 ? '' : score > 0 ? '+' : '−'
  return `${sign}${points.toFixed(1)}`
}
