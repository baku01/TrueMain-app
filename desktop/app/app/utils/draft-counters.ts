import type { ChampionMatchupEntry } from '#shared/types/champions/matchups'

export interface EnemyCounter {
  championId: number
  /** The counter's win rate against the enemy, 0–1. */
  winRate: number
  games: number
}

/** Below this, a matchup is a rumour, not a counter. */
export const COUNTER_MIN_GAMES = 40

/**
 * The champions that beat an enemy on its lane, read from the enemy's own
 * matchups: a row is the enemy's record against one opponent, so the opponent's
 * is the other side of it. Ranked on the enemy's Wilson ceiling, lowest first —
 * "at best the enemy wins this much" — so a thin sample at an extreme rate does
 * not outrank a measured one. Champions no longer pickable (picked, banned) are
 * left out, and so is any matchup the enemy does not lose.
 */
export function enemyCounters(matchups: ChampionMatchupEntry[], unavailable: Set<number>, limit = 3): EnemyCounter[] {
  return matchups
    .filter(row => row.games >= COUNTER_MIN_GAMES && row.winRate < 0.5 && !unavailable.has(row.opponentChampionId))
    .sort((a, b) => a.winRateUpperBound - b.winRateUpperBound || b.games - a.games)
    .slice(0, limit)
    .map(row => ({ championId: row.opponentChampionId, winRate: 1 - row.winRate, games: row.games }))
}
