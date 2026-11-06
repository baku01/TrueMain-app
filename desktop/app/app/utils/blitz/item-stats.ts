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

/**
 * Where in a build an item was measured. Blitz answers three readings, one at
 * a time (asked together it refuses them, `invalid_filter_combination`):
 * - every place and every path to it, the default (`items` and `item_slot`
 *   both `ALL`);
 * - one place of the buying order (`slot`, Blitz's `item_slot`): 1 the first
 *   completed item, boots and the starting items apart — Caitlyn's slot 1 is
 *   Kraken Slayer and The Collector, never Berserker's Greaves;
 * - after the items bought before it, in their order (`path`, Blitz's `items`,
 *   `2523,3031`): the item each game bought next. The order counts — Caitlyn
 *   after Kraken Slayer then Infinity Edge is 14,660 games, the other way 132.
 */
export interface ItemContext { slot?: number, path?: number[] }

interface ItemStatRow {
  item_id: number
  num_games: number
  win_rate: number
  bayesian_wpa?: number
  wpa?: number
  items?: string
  item_slot?: string
}

export async function readItemStats(championId: number, position: string, opponentChampionId: number | null = null, context: ItemContext = {}): Promise<Map<number, ItemStat>> {
  const path = context.path?.length ? context.path.join(',') : undefined
  const slot = path ? undefined : context.slot
  const rows = await blitzRows<ItemStatRow>('champion_item_stats', {
    champion_id: championId,
    individual_position: blitzRole(position),
    queue_id: SOLO_QUEUE,
    tier: 'EMERALD+',
    match_up_champion_id: opponentChampionId ?? undefined,
    items: path,
    item_slot: slot,
  })
  // Only the reading asked for: the item over every slot and every path to it (`ALL`) unless a place or a path was.
  const items = path ?? 'ALL'
  const itemSlot = slot ? String(slot) : 'ALL'
  return new Map(rows
    .filter(row => (row.items ?? 'ALL') === items && (row.item_slot ?? 'ALL') === itemSlot && row.num_games > 0)
    .map(row => [Number(row.item_id), { games: row.num_games, winRate: row.win_rate, wpa: row.bayesian_wpa ?? row.wpa ?? 0 }]))
}
