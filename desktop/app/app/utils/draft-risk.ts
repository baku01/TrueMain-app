import type { CounterRow } from '~/utils/counters'
import { NEUTRAL, shrunkRate } from '~/utils/draft-weights'

/**
 * What a pick risks when our lane opponent picks after us — LoLTheory's
 * draft score is "WR − Risk = Score", the risk from the enemy's counter and
 * flex picks still to come (its Overwolf app, `chunk-ZEADYT2C.js`). Here the
 * risk of a candidate is the harm it can expect from the lane opponent we do
 * not know yet:
 *
 *   risk = unknown × Σ over the champions c the lane may still bring of P(c) × max(0, −edge(c))
 *
 * - P(c): the lane's pick rates on the tier list, normalized over the
 *   champions still available — not banned, not picked, not the candidate.
 * - edge(c): the candidate's matchup score against c (`utils/counters`: its
 *   win rate there minus what the two champions' own rates predict), pulled
 *   toward even by its games as the counter category pulls its own
 *   (`shrunkRate`). Only the harm counts: an opponent who picks after us can
 *   choose the counter, and a matchup we would win is no comfort then.
 * - unknown: how likely the lane opponent is still to come. None placed on
 *   our lane, it is; placed there, it is the doubt of that placement (a flex
 *   pick read on our lane at 60% leaves 40%); pinned by the player, or the
 *   enemy's five all picked, it is 0 — the matchup is known and the counter
 *   category already reads it.
 *
 * Measured on 16.22, Emerald+, the 40 most picked on each lane: 0.5 to 1.5
 * points (median 0.8 to 1.0 by lane) — Ezreal 0.46, Lulu 0.48, Lux 0.66 the
 * safest blind picks; Shaco support 1.54, Mel mid 1.37, Dr. Mundo top 1.38
 * the riskiest.
 */

/** A champion still to be picked on the lane, and its chance to be the one. */
export type LaneOdds = Map<number, number>

/**
 * Who our lane opponent may still be: the lane's champions by pick rate,
 * over the ones still available. Empty when nothing is.
 */
export function laneOdds(entries: { championId: number, pickRate: number }[], unavailable: Set<number>): LaneOdds {
  const open = entries.filter(entry => !unavailable.has(entry.championId) && entry.pickRate > 0)
  const total = open.reduce((sum, entry) => sum + entry.pickRate, 0)
  return new Map(total > 0 ? open.map(entry => [entry.championId, entry.pickRate / total]) : [])
}

/** The chance our lane opponent is still to come (see above); 0–1. */
export function unknownOpponent(enemiesPicked: number, opponent: { confidence: number, pinned: boolean } | null): number {
  if (enemiesPicked >= 5) return 0
  if (!opponent) return 1
  return opponent.pinned ? 0 : Math.min(Math.max(1 - opponent.confidence, 0), 1)
}

/**
 * A candidate's risk, in win-rate points on the 0–1 scale (0.01 is one
 * point): the harm its counters can do, weighed by how likely each is to be
 * the lane opponent. A champion with no matchup row counts as even.
 */
export function counterRisk(championId: number, odds: LaneOdds, matchups: CounterRow[], unknown: number): number {
  if (!(unknown > 0)) return 0
  const edges = new Map(matchups.map(row => [row.championId, row.score === null ? 0 : shrunkRate(NEUTRAL + row.score, row.games) - NEUTRAL]))
  let open = 0
  let harm = 0
  for (const [opponent, chance] of odds) {
    if (opponent === championId) continue
    open += chance
    harm += chance * Math.max(0, -(edges.get(opponent) ?? 0))
  }
  // The candidate itself is no opponent: the odds are read again without it.
  return open > 0 ? unknown * (harm / open) : 0
}

export type RiskLevel = 'none' | 'medium' | 'high' | 'extreme'

/**
 * The risk as LoLTheory words it — none, medium, high, extreme — on Blitz's
 * own matchup steps (`counterTier`): as much harm as a C matchup (a point
 * under) is high, as a D one (two points) extreme. LoLTheory's own cuts, 7
 * and 15 points, are for a risk summed over the enemy's picks on every role
 * (its tooltip lists each threat with its role); on one lane every candidate
 * measured falls under 1.6 points, so they would call every pick medium.
 * The level is read from the risk as the card shows it, to a tenth of a point
 * (`formatPoints`), so a figure and its word agree: 0.0 is none.
 */
export function riskLevel(risk: number): RiskLevel {
  const shown = Math.round(risk * 1000) / 1000
  if (!(shown > 0)) return 'none'
  if (shown < 0.01) return 'medium'
  return shown < 0.02 ? 'high' : 'extreme'
}
