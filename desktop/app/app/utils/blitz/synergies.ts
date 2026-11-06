import type { SynergyRow } from '~/utils/synergies'
import { GRADE_LETTER } from '~/utils/synergies'
import { SOLO_QUEUE, blitzRole, blitzRows, blitzTier, truemainPosition } from '~/utils/blitz/client'

/**
 * Blitz's pairs of champions on two lanes of one team: a champion's allies on
 * a lane (`champion_synergies_stats_unlimited`, every ally it was measured
 * with) and the best pairs of two lanes across every champion
 * (`champion_synergies_stats`, its Duos page: the top 200). Both answer the
 * pair's games, win rate, its delta over what the two champions' own rates
 * predict, and Blitz's 1–5 grade.
 */
interface BlitzSynergyRow {
  champion_id: number
  ally_champion_id: number
  individual_position: string
  ally_individual_position: string
  patch: string
  games: number
  win_rate: number
  win_rate_delta: number | null
  synergy_tier: number | null
}

export interface SynergyRead { patch: string | null, rows: SynergyRow[] }

function toRows(rows: BlitzSynergyRow[]): SynergyRead {
  return {
    patch: rows[0]?.patch ?? null,
    rows: rows.map(row => ({
      championId: row.champion_id,
      allyChampionId: row.ally_champion_id,
      position: truemainPosition(row.individual_position),
      allyPosition: truemainPosition(row.ally_individual_position),
      games: row.games,
      winRate: row.win_rate,
      delta: row.win_rate_delta ?? null,
      tier: GRADE_LETTER[row.synergy_tier ?? 3] ?? 'B',
    })),
  }
}

/** One champion on `position` with each ally on `allyPosition`. */
export async function synergiesFromBlitz(championId: number, position: string, allyPosition: string, eloBracket?: unknown): Promise<SynergyRead> {
  return toRows(await blitzRows<BlitzSynergyRow>('champion_synergies_stats_unlimited', {
    champion_id: championId,
    queue_id: SOLO_QUEUE,
    tier: blitzTier(eloBracket),
    region: 'WORLD',
    individual_position: blitzRole(position),
    ally_individual_position: blitzRole(allyPosition),
  }))
}

/** The best pairs of a champion on `position` and one on `allyPosition`. */
export async function duosFromBlitz(position: string, allyPosition: string, eloBracket?: unknown): Promise<SynergyRead> {
  return toRows(await blitzRows<BlitzSynergyRow>('champion_synergies_stats', {
    queue_id: SOLO_QUEUE,
    tier: blitzTier(eloBracket),
    region: 'WORLD',
    individual_position: blitzRole(position),
    ally_individual_position: blitzRole(allyPosition),
  }))
}
