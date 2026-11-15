import { twoSidedP } from './distributions'

/**
 * The order the games were won and lost in — streaks, tilt, sessions. Every
 * function takes the results oldest first.
 */

/** The Wald–Wolfowitz runs test of a win/loss sequence. */
export interface RunsTest {
  /** Maximal blocks of equal results: W W L W → 3. */
  runs: number
  wins: number
  losses: number
  /** E[R] = 2·n_W·n_L / n + 1 for a sequence in random order. */
  expected: number
  /** √Var[R], Var[R] = 2n_W n_L(2n_W n_L − n) / (n²(n − 1)). */
  sd: number
  /** (R − E[R]) / sd: negative when the results come in streaks, positive when they alternate. */
  z: number
  p: number
}

/**
 * Whether the wins and losses come in the order chance would deal them. Too
 * few runs means streaks (a win follows a win more than it should — form, or
 * tilt after a loss); too many means they alternate. Null when either result
 * is missing, since the question then has no answer.
 */
export function runsTest(results: readonly boolean[]): RunsTest | null {
  const wins = results.filter(Boolean).length
  const losses = results.length - wins
  const n = results.length
  if (!wins || !losses || n < 3) return null
  let runs = 1
  for (let i = 1; i < n; i++) if (results[i] !== results[i - 1]) runs++
  const product = 2 * wins * losses
  const expected = product / n + 1
  const sd = Math.sqrt(product * (product - n) / (n * n * (n - 1)))
  const z = sd > 0 ? (runs - expected) / sd : 0
  return { runs, wins, losses, expected, sd, z, p: sd > 0 ? twoSidedP(z) : 1 }
}

export interface Tally {
  games: number
  wins: number
}

/** The win rate after each kind of streak: what the next game did once the last `length` went one way. */
export interface Transitions {
  afterWin: Tally
  afterLoss: Tally
  afterTwoWins: Tally
  afterTwoLosses: Tally
}

export function transitions(results: readonly boolean[]): Transitions {
  const out: Transitions = {
    afterWin: { games: 0, wins: 0 },
    afterLoss: { games: 0, wins: 0 },
    afterTwoWins: { games: 0, wins: 0 },
    afterTwoLosses: { games: 0, wins: 0 },
  }
  const add = (tally: Tally, win: boolean) => {
    tally.games++
    if (win) tally.wins++
  }
  for (let i = 1; i < results.length; i++) {
    const win = results[i]!
    add(results[i - 1] ? out.afterWin : out.afterLoss, win)
    if (i >= 2 && results[i - 1] === results[i - 2]) add(results[i - 1] ? out.afterTwoWins : out.afterTwoLosses, win)
  }
  return out
}

export interface Streaks {
  longestWin: number
  longestLoss: number
  /** The run the sequence ends on: its length, positive for wins, negative for losses. */
  current: number
}

export function streaks(results: readonly boolean[]): Streaks {
  let longestWin = 0
  let longestLoss = 0
  let run = 0
  for (const win of results) {
    run = win ? (run > 0 ? run + 1 : 1) : (run < 0 ? run - 1 : -1)
    if (run > longestWin) longestWin = run
    if (-run > longestLoss) longestLoss = -run
  }
  return { longestWin, longestLoss, current: run }
}

/** A gap longer than this between one game's end and the next one's start ends a session. */
export const SESSION_GAP_MS = 60 * 60_000

/**
 * Each game's place in its session, 1 for the first game of a sitting: games
 * oldest first, each `[start, durationSeconds]`. A session runs while the next
 * game starts within `gapMs` of the last one's end.
 */
export function sessionPositions(games: readonly { playedAt: number, durationSeconds: number }[], gapMs = SESSION_GAP_MS): number[] {
  const out: number[] = []
  for (let i = 0; i < games.length; i++) {
    const previous = games[i - 1]
    const continued = previous && games[i]!.playedAt - (previous.playedAt + previous.durationSeconds * 1000) <= gapMs
    out.push(continued ? out[i - 1]! + 1 : 1)
  }
  return out
}
