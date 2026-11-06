import type { ItemStat } from '~/utils/blitz/item-stats'
import type { JevSlot } from '~/utils/jev-build'

/**
 * What Blitz measured of an option's items (`champion_item_stats`): the win
 * probability they add on the lane, at the place of the build the slot is,
 * after the items the build holds before it, and against the lane opponent —
 * each the option's items averaged, with the fewest games among them.
 * `utils/jev-stats` reads them as one estimate, the narrower measure pulled
 * toward the broader by how far such measures truly stray.
 */
export interface ItemMeasure {
  /** Win probability added on the lane, over every slot and path; null where unmeasured. */
  wpa?: number | null
  /** The games behind `wpa`: the fewest of the option's items. */
  wpaGames?: number
  /** The same at this place of the buying order (Blitz's `item_slot`): the slot's own games are a part of the lane's. */
  slotWpa?: number | null
  slotGames?: number
  /** The same after the items the build holds before this slot, in their order (Blitz's `items`): a part of the slot's. */
  pathWpa?: number | null
  pathGames?: number
  /** The same against the lane opponent, when the matchup has the games. */
  vsWpa?: number | null
  vsGames?: number
}

/** Blitz's readings of a slot's items at its place of the build: at that slot of the buying order, and after the items held before it. */
export interface SlotStats { slot?: Map<number, ItemStat>, path?: Map<number, ItemStat> }

const average = (ids: number[], stats: Map<number, ItemStat> | undefined) => {
  const known = ids.map(id => stats?.get(id)).filter(stat => !!stat)
  return known.length ? { wpa: known.reduce((sum, stat) => sum + stat.wpa, 0) / known.length, games: Math.min(...known.map(stat => stat.games)) } : null
}

/**
 * Each item option's win probability added: on the lane and against the lane
 * opponent, and — for an item slot — at its place of the build (`at`), its
 * items averaged.
 */
export function withItemStats(slots: JevSlot[], lane: Map<number, ItemStat>, versus: Map<number, ItemStat>, at: SlotStats = {}): JevSlot[] {
  return slots.map(slot => (!slot.options.some(option => option.itemIds.length)
    ? slot
    : {
        ...slot,
        options: slot.options.map((option) => {
          const onLane = average(option.itemIds, lane)
          const against = average(option.itemIds, versus)
          const inSlot = average(option.itemIds, at.slot)
          const onPath = average(option.itemIds, at.path)
          return {
            ...option,
            wpa: onLane?.wpa ?? null,
            wpaGames: onLane?.games ?? 0,
            slotWpa: inSlot?.wpa ?? null,
            slotGames: inSlot?.games ?? 0,
            pathWpa: onPath?.wpa ?? null,
            pathGames: onPath?.games ?? 0,
            vsWpa: against?.wpa ?? null,
            vsGames: against?.games ?? 0,
          }
        }),
      }))
}
