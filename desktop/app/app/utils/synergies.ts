/**
 * Champions measured together: one champion's best allies on another lane
 * (the champion page's Synergies view) and the best pairs of two lanes across
 * every champion (the stats page's Duos). Pure: the readers are
 * `utils/sources/synergies.ts`.
 */
export interface SynergyRow {
  championId: number
  allyChampionId: number
  position: string
  allyPosition: string
  games: number
  winRate: number
  /** How far the pair's win rate lands from what the two champions' own rates predict, 0–1 scale; null where the source does not say. */
  delta: number | null
  /** The pair's tier, S to D: the source's own grade, or one read off `delta` (`synergyTier`); `''` when neither exists. */
  tier: string
}

/** The ally lane a lane is read with first, as on Blitz: the jungler for the solo lanes, the other half of the bot lane. */
export const DEFAULT_ALLY: Record<string, string> = { TOP: 'JUNGLE', JUNGLE: 'MIDDLE', MIDDLE: 'JUNGLE', BOTTOM: 'UTILITY', UTILITY: 'BOTTOM' }

/** Blitz grades a pair 1 (best) to 5; TrueMain names the same steps S to D. */
export const GRADE_LETTER: Record<number, string> = { 1: 'S', 2: 'A', 3: 'B', 4: 'C', 5: 'D' }

/**
 * A tier for a source that measures the delta but grades nothing: Blitz's own
 * steps, read off its graded pairs (16.22, Emerald+, bot and support — S from
 * about +1.1 points, A from +0.45, B to −0.4, C to −1.05, D below). No delta,
 * no tier (`''`, a dash): one made up from the win rate alone would grade how
 * strong the ally is, not the pair.
 */
export function synergyTier(delta: number | null): string {
  if (delta === null) return ''
  if (delta >= 0.011) return 'S'
  if (delta >= 0.0045) return 'A'
  if (delta > -0.004) return 'B'
  if (delta > -0.0105) return 'C'
  return 'D'
}

const TIER_RANK: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 }

/** Best tier first, the higher win rate first within a tier. */
export function bySynergy(a: SynergyRow, b: SynergyRow): number {
  return (TIER_RANK[a.tier] ?? 5) - (TIER_RANK[b.tier] ?? 5) || b.winRate - a.winRate
}

const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase()

/** The rows whose champion, or ally, is named by every word of `query`, accents ignored. */
export function searchPairs(rows: SynergyRow[], query: string, nameOf: (id: number) => string): SynergyRow[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return rows
  return rows.filter((row) => {
    const names = fold(`${nameOf(row.championId)} ${nameOf(row.allyChampionId)}`)
    return words.every(word => names.includes(word))
  })
}
