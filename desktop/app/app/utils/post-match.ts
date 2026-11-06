import type { MatchDetailResponse } from '#shared/types/match-detail'
import type { PlayerGame } from '~/types/record'

/**
 * The post-match (`DashboardPostMatch`): when a game ends the app opens home
 * on it, as Blitz opens its match page, with a few lines on how it went — the
 * farm and the vision per minute against a yardstick, and the deaths, how
 * many and when. These are the rules; the yardstick is read in
 * `usePostMatch`.
 */

/** The minute the laning phase is read to end at, where Blitz's post-match cuts it too. */
export const LANE_END_MINUTE = 14

/** How far before the moment the app saw the game end its end may sit: the history files a game by its creation, a loading screen before its clock. */
const END_BEFORE_MS = 20 * 60_000
/** And after it: the player's clock and the client's need not agree. */
const END_AFTER_MS = 5 * 60_000

/** The yardstick a game is set against, and where it came from. */
export interface PostMatchBenchmark {
  /** The source the figures came from: TrueMain's, Blitz's, or the player's own games. */
  origin: 'truemain' | 'blitz' | 'own'
  /** The tier the figures are of (`EMERALD`); null for the player's own games. */
  tier: string | null
  /** How many games stand behind the figures, where the source says. */
  samples: number | null
  csPerMinute: number | null
  visionPerMinute: number | null
  deaths: number | null
}

/**
 * The game that ended at `endedAt` (epoch ms) among the player's games,
 * newest first: the newest whose end falls around that moment. Null while
 * the client's history does not have it yet — its stats land a moment after
 * the game does.
 */
export function finishedGame(games: PlayerGame[], endedAt: number): PlayerGame | null {
  return games.find((game) => {
    const end = game.playedAt + game.durationSeconds * 1000
    return end >= endedAt - END_BEFORE_MS && end <= endedAt + END_AFTER_MS
  }) ?? null
}

/** How many of the player's games the own-average yardstick reads, and how few it needs to say anything. */
export const OWN_GAMES = 20
export const OWN_MIN_GAMES = 3

/**
 * The player's own yardstick, the last resort when no source answers for
 * their tier: their latest games before this one on the same lane and map,
 * remakes left out. Null under `OWN_MIN_GAMES` of them.
 */
export function ownAverage(games: PlayerGame[], finished: PlayerGame): PostMatchBenchmark | null {
  const sample = games
    .filter(game => game.gameId !== finished.gameId && !game.remake && game.durationSeconds > 0)
    .filter(game => game.playedAt < finished.playedAt && game.position === finished.position && game.mapId === finished.mapId)
    .slice(0, OWN_GAMES)
  if (sample.length < OWN_MIN_GAMES) return null
  const mean = (read: (game: PlayerGame) => number) => sample.reduce((total, game) => total + read(game), 0) / sample.length
  return {
    origin: 'own',
    tier: null,
    samples: sample.length,
    csPerMinute: mean(game => game.cs / (game.durationSeconds / 60)),
    visionPerMinute: mean(game => game.visionScore / (game.durationSeconds / 60)),
    deaths: mean(game => game.deaths),
  }
}

/** When the player died, in game minutes, from the timeline's kills; null when the game has no timeline to say. */
export function deathTimes(detail: MatchDetailResponse | null | undefined, participantId: number): number[] | null {
  const events = detail?.winProbabilityTimeline?.events
  if (!events?.length) return null
  return events
    .filter(event => event.type === 'CHAMPION_KILL' && event.victimId === participantId)
    .map(event => event.ms / 60_000)
    .sort((a, b) => a - b)
}

/** Within this share of the yardstick a figure reads as even, not better or worse. */
const EVEN_SHARE = 0.05

/** One figure of the game, set against the yardstick's. */
export interface PostMatchMetric {
  value: number
  reference: number | null
  /** Better or worse than the yardstick, deaths read the other way; null without one. */
  verdict: 'better' | 'even' | 'worse' | null
}

function metric(value: number, reference: number | null, lowerIsBetter = false): PostMatchMetric {
  if (reference === null || !Number.isFinite(reference)) return { value, reference: null, verdict: null }
  const gap = reference === 0 ? value : (value - reference) / reference
  if (Math.abs(gap) <= EVEN_SHARE) return { value, reference, verdict: 'even' }
  return { value, reference, verdict: (gap > 0) !== lowerIsBetter ? 'better' : 'worse' }
}

export interface PostMatchInsights {
  csPerMinute: PostMatchMetric
  visionPerMinute: PostMatchMetric
  deaths: PostMatchMetric
  /** The death times (`deathTimes`); null without a timeline. */
  deathTimes: number[] | null
  /** How many came before `LANE_END_MINUTE`; null without a timeline. */
  laneDeaths: number | null
}

/** The game's lines against `benchmark` — no benchmark, no comparison, the figures still there. */
export function postMatchInsights(game: PlayerGame, benchmark: PostMatchBenchmark | null, times: number[] | null): PostMatchInsights {
  const minutes = Math.max(game.durationSeconds / 60, 1)
  return {
    csPerMinute: metric(game.cs / minutes, benchmark?.csPerMinute ?? null),
    visionPerMinute: metric(game.visionScore / minutes, benchmark?.visionPerMinute ?? null),
    deaths: metric(game.deaths, benchmark?.deaths ?? null, true),
    deathTimes: times,
    laneDeaths: times ? times.filter(minute => minute < LANE_END_MINUTE).length : null,
  }
}
