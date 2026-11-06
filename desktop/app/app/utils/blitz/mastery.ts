import { SOLO_QUEUE, blitzRows, blitzTier, truemainPosition } from '~/utils/blitz/client'

/**
 * Win rate by champion mastery, as Blitz's Mastery page reads it: the
 * `mastery_stats` column of `champion_postmatch_stats`, one row per champion
 * and lane, the win rate of the players at mastery level 5 and up, 20 and up,
 * 50 and up and 100 and up — and the improvement, how much more the 100+
 * players win than the 5+ ones: which champions repay the hours put in.
 */
export const MASTERY_LEVELS = [5, 20, 50, 100] as const

/** A lane under this share of the champion's games is an off-role, left out as on Blitz unless searched for. */
export const MIN_ROLE_SHARE = 0.1

export interface MasteryRow {
  championId: number
  position: string
  winRate: number
  /** The win rate at each of `MASTERY_LEVELS` and up. */
  levels: number[]
  /** The 100+ win rate minus the 5+ one. */
  improvement: number
  /** The lane's share of the champion's games, for the off-role filter. */
  roleShare: number
}

export interface BlitzMasteryRow {
  champion_id: number
  individual_position: string
  patch: string
  win_rate: number
  role_pct_games: number | null
  mastery_stats: Record<string, { win_rate: number | null, num_games: number | null } | undefined> | null
}

/**
 * Blitz's rows as the table's: a lane without players at 50 and at 100 is
 * left out (its trend would be two points), and so is the every-lane row.
 */
export function masteryRows(rows: BlitzMasteryRow[]): MasteryRow[] {
  return rows.flatMap((row) => {
    const stats = row.mastery_stats
    if (row.individual_position === 'ALL' || !stats?.['50']?.num_games || !stats['100']?.num_games) return []
    const levels = MASTERY_LEVELS.map(level => stats[String(level)]?.win_rate ?? 0)
    return [{
      championId: row.champion_id,
      position: truemainPosition(row.individual_position),
      winRate: row.win_rate,
      levels,
      improvement: levels[levels.length - 1]! - levels[0]!,
      roleShare: row.role_pct_games ?? 0,
    }]
  })
}

export async function masteryFromBlitz(eloBracket?: unknown): Promise<{ patch: string | null, rows: MasteryRow[] }> {
  const rows = await blitzRows<BlitzMasteryRow>('champion_postmatch_stats', {
    queue_id: SOLO_QUEUE,
    tier: blitzTier(eloBracket),
    region: 'WORLD',
    columns: 'champion_id,individual_position,patch,win_rate,role_pct_games,mastery_stats',
  })
  return { patch: rows[0]?.patch ?? null, rows: masteryRows(rows) }
}

/**
 * The rows the table lists: one lane, or every lane (`position` null), and
 * the champions named by every word of `query`. Off-roles are left out unless
 * searched for, as on Blitz: a search for a champion finds every lane of it.
 */
export function visibleMastery(rows: MasteryRow[], position: string | null, query: string, nameOf: (id: number) => string): MasteryRow[] {
  const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase()
  const words = fold(query).split(/\s+/).filter(Boolean)
  return rows.filter(row => (position === null || row.position === position)
    && (words.length ? words.every(word => fold(nameOf(row.championId)).includes(word)) : row.roleShare >= MIN_ROLE_SHARE))
}
