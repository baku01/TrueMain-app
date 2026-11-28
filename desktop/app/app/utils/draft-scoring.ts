import type { DraftCandidate, DraftReason } from '~/types/draft'
import { shrinkDelta } from '~/utils/draft-weights'

/**
 * A pick scored from what every source measures, the API's ranking restated
 * (`DraftScoring.cs`, decisions, product-matchups): `Lane × c × matchup +
 * Strength × strength + Synergy × synergy`, each delta shrunk by its games
 * (`shrinkDelta`, k = 400) and the weights the back-test settled (strength 0.5,
 * synergy 0.25). `c` is the chance the matchup's opponent is ours
 * (`utils/draft-lanes`); the blind part for the rest of that chance is the
 * counter-pick risk, added where the player's weights rank the picks
 * (`weightedScore`), not here. The score is a ranking key, never displayed.
 */

export const LANE_WEIGHT = 1
export const STRENGTH_WEIGHT = 0.5
export const SYNERGY_WEIGHT = 0.25

/** A matchup read over fewer games than this is a thin sample: the card says so, Jev leaves it out. */
export const THIN_MATCHUP_GAMES = 100

/** The parts of the score that move it most, as the API returns them: at most three. */
const REASONS = 3

/** A locked ally counts fully, a hovered one half: it may still change its mind (#1906). */
export const LOCKED_WEIGHT = 1
export const HOVERED_WEIGHT = 0.5

/** One ally's synergy table, read once per draft: each partner on our lane, by champion. */
export interface AllyTable {
  championId: number
  tentative: boolean
  rows: Map<number, { delta: number | null, games: number }>
}

const reason = (fields: Partial<DraftReason> & Pick<DraftReason, 'kind'>): DraftReason => ({
  championId: null, position: null, delta: null, games: 0, rate: null, probability: null, share: null, count: null, of: null, tentative: false, ...fields,
})

/**
 * What our allies add to a pick: the **mean** of each pairing's shrunk delta,
 * a locked ally at weight 1 and a hovered one at 0.5, so four allies weigh what
 * one does. An ally whose table was read without the pick counts as no effect;
 * an ally whose table could not be read does not count at all. The games are
 * summed — zero means nothing was measured, and the category reads even.
 */
export function synergyOf(championId: number, allies: AllyTable[]): { delta: number, games: number, parts: { reason: DraftReason, contribution: number }[] } {
  const total = allies.reduce((sum, ally) => sum + (ally.tentative ? HOVERED_WEIGHT : LOCKED_WEIGHT), 0)
  const parts: { reason: DraftReason, contribution: number }[] = []
  let delta = 0
  let games = 0
  for (const ally of allies) {
    const row = ally.rows.get(championId)
    if (!row || row.delta === null || !Number.isFinite(row.delta) || !(row.games > 0)) continue
    const share = (ally.tentative ? HOVERED_WEIGHT : LOCKED_WEIGHT) / total
    const contribution = share * shrinkDelta(row.delta, row.games)
    delta += contribution
    games += row.games
    parts.push({ reason: reason({ kind: 'synergy', championId: ally.championId, delta: row.delta, games: row.games, tentative: ally.tentative }), contribution: SYNERGY_WEIGHT * contribution })
  }
  return { delta, games, parts }
}

export interface CandidateInput {
  championId: number
  position: string
  /** The pick on our lane in the source's tier list, null when it is not tiered there. */
  own: { winRate: number, games: number } | null
  /** The lane's average win rate. */
  average: number
  /** Our lane opponent and the chance it is ours; null when nobody is placed there. */
  opponent: { championId: number, confidence: number } | null
  /** The opponent's matchups were read: a pick missing from them is a sample of zero, not an unknown. */
  matchupsRead: boolean
  /** The opponent's row against the pick — its own win rate there — when measured. */
  versus: { winRate: number, games: number } | null
  allies: AllyTable[]
  patch: string | null
}

export function scoreCandidate(input: CandidateInput): DraftCandidate {
  const { own, opponent, versus } = input
  const strengthDelta = own ? own.winRate - input.average : 0
  const strengthGames = own ? own.games : 0
  // The opponent's matchups are its win rate against each champion: the pick's is the other side of it.
  const matchupDelta = versus && opponent ? (1 - versus.winRate) - (own?.winRate ?? 0.5) : 0
  const matchupGames = versus && opponent ? versus.games : 0
  const confidence = opponent?.confidence ?? 0
  const synergy = synergyOf(input.championId, input.allies)

  const parts: { reason: DraftReason, contribution: number }[] = [...synergy.parts]
  if (versus && opponent) {
    parts.push({
      reason: reason({ kind: 'laneMatchup', championId: opponent.championId, position: input.position, delta: matchupDelta, games: matchupGames, probability: confidence }),
      contribution: LANE_WEIGHT * confidence * shrinkDelta(matchupDelta, matchupGames),
    })
  }
  if (own) {
    parts.push({
      reason: reason({ kind: 'laneStrength', position: input.position, delta: strengthDelta, games: strengthGames }),
      contribution: STRENGTH_WEIGHT * shrinkDelta(strengthDelta, strengthGames),
    })
  }
  // Strongest first by what each moves the score, so the card's leading reason is the one the order rests on.
  parts.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))

  return {
    championId: input.championId,
    matchupDelta,
    matchupGames,
    strengthDelta,
    strengthGames,
    synergyDelta: synergy.delta,
    synergyGames: synergy.games,
    score: parts.reduce((sum, part) => sum + part.contribution, 0),
    // Only a matchup that was read can be thin: before the opponent shows, the lane strength's sample is the lane's.
    thinSample: input.matchupsRead && opponent !== null && matchupGames < THIN_MATCHUP_GAMES,
    reasons: parts.slice(0, REASONS).map(part => part.reason),
    patch: input.patch,
  }
}

/** The order of the source's answer: the score, then the id. */
export const byScore = (a: DraftCandidate, b: DraftCandidate) => b.score - a.score || a.championId - b.championId
