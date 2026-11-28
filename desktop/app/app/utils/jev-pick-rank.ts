import type { PickRead } from '~/utils/jev-read-pick'

/**
 * A total of parts, each 0–1, by weights that stay visible — the build's options (`rankSlot`) and the picks alike. A part Jev read for the others (`read`) but not for this one — its batch failed —
 * counts as neutral, 0.5: given away, its weight would rank the unread one on its statistics alone above every read one.
 */
export function total<K extends string>(parts: Partial<Record<K, number>>, weights: Partial<Record<K, number>>, read = new Set<K>()): number {
  const value = (part: K) => parts[part] ?? (read.has(part) ? 0.5 : undefined)
  const present = (Object.keys(weights) as K[]).filter(part => value(part) !== undefined)
  const weight = present.reduce((sum, part) => sum + weights[part]!, 0)
  return weight ? present.reduce((sum, part) => sum + weights[part]! * value(part)!, 0) / weight : 0
}

/** The parts of `jev` some entry has: those Jev was asked for, a missing one a failed read (`total`). */
export const readParts = <K extends string>(jev: readonly K[], entries: Partial<Record<K, number | null>>[]) => new Set(jev.filter(part => entries.some(entry => entry[part] != null)))

/** How a pick's parts weigh: the source's own ranking, then the lane, the team and the enemy team as Jev read them. */
export const PICK_WEIGHTS = { stats: 0.4, lane: 0.25, team: 0.2, enemy: 0.15 } as const

export interface PickParts { stats: number, lane?: number, team?: number, enemy?: number }
export interface RankedPick { championId: number, total: number, parts: PickParts, confidence: number | null }

/**
 * The champions we could pick, ranked: the source's ranking key (its own
 * mix of matchup, strength and synergy, measured) as where each stands among
 * these candidates — 0.5 the middle of them — beside what Jev read of the
 * lane, our team and the enemy team, weighed as `PICK_WEIGHTS` says: a part
 * Jev was not asked gives its weight to the others, one it read for the other
 * candidates but not this one counts as neutral (`total`).
 */
export function rankPicks(candidates: { championId: number, score: number }[], reads: Map<number, PickRead>): RankedPick[] {
  if (!candidates.length) return []
  const mean = candidates.reduce((sum, candidate) => sum + candidate.score, 0) / candidates.length
  const spread = Math.sqrt(candidates.reduce((sum, candidate) => sum + (candidate.score - mean) ** 2, 0) / candidates.length)
  const asked = readParts(['lane', 'team', 'enemy'] as const, [...reads.values()])
  return candidates.map((candidate) => {
    const read = reads.get(candidate.championId)
    const parts: PickParts = { stats: spread > 0 ? 1 / (1 + Math.exp(-(candidate.score - mean) / spread)) : 0.5 }
    for (const part of asked) if (read?.[part] != null) parts[part] = read[part]!
    return { championId: candidate.championId, total: total<keyof PickParts>(parts, PICK_WEIGHTS, asked), parts, confidence: read?.confidence ?? null }
  }).sort((a, b) => b.total - a.total)
}
