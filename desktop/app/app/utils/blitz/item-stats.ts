import { SOLO_QUEUE, blitzRole, blitzRows } from '~/utils/blitz/client'

/**
 * What each item does for a champion on a lane, as Blitz measures it
 * (`champion_item_stats`, Emerald and above): its games and win rate, and its
 * win probability added — how much buying it moves the game's odds, the
 * Bayesian estimate Blitz shrinks toward zero on a thin sample. Against one
 * lane opponent (`match_up_champion_id`) when the matchup has the games; an
 * empty map when it has none.
 */
export interface ItemStat {
  games: number
  winRate: number
  /** Win probability added, Bayesian: +0.04 is four points of win probability. */
  wpa: number
}

interface ItemStatRow {
  item_id: number
  num_games: number
  win_rate: number
  bayesian_wpa?: number
  wpa?: number
  items?: string
  item_slot?: string
}

export async function readItemStats(championId: number, position: string, opponentChampionId: number | null = null): Promise<Map<number, ItemStat>> {
  const rows = await blitzRows<ItemStatRow>('champion_item_stats', {
    champion_id: championId,
    individual_position: blitzRole(position),
    queue_id: SOLO_QUEUE,
    tier: 'EMERALD+',
    match_up_champion_id: opponentChampionId ?? undefined,
  })
  // The item over every slot and every path to it (`ALL`), the read the stats lead with.
  return new Map(rows
    .filter(row => (row.items ?? 'ALL') === 'ALL' && (row.item_slot ?? 'ALL') === 'ALL' && row.num_games > 0)
    .map(row => [Number(row.item_id), { games: row.num_games, winRate: row.win_rate, wpa: row.bayesian_wpa ?? row.wpa ?? 0 }]))
}
