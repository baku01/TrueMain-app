import type { StaticItemData } from '#shared/types/static-data'
import type { GameItem, GamePlayer } from '~/types/game'
import type { Reading } from './reading'
import { say } from './reading'

/**
 * The tips our own state calls for, from what the game tells of the player
 * alone: health and resource (`GameState.vitals`), the ward score, the items
 * we finish. Thresholds after ABSOL's coach where it had one.
 */

/** Health below which a back is due (ABSOL's 25 %), and the gold that makes it a shopping trip. */
export const LOW_HEALTH = { health: 0.25, gold: 800 } as const
/** Half health with this much gold is worth a back too (ABSOL's 2500). */
export const RICH_AND_HURT = { health: 0.5, gold: 2500 } as const
/** Seconds between two health tips, and the game time they start at. */
const HEALTH = { every: 45, from: 90 } as const

/**
 * Low on health: back with gold to spend, or, short of it, play behind the
 * wave; half health with a full purse is worth a back too. Never while dead,
 * at most every 45 s.
 */
export function healthTips(reading: Reading) {
  const { game, me, clock, memory } = reading
  const { health } = game.vitals
  if (me.dead || clock < HEALTH.from || health <= 0) return
  if (memory.healthAt !== null && clock - memory.healthAt < HEALTH.every) return
  const gold = game.gold
  let key: 'recall.lowHealth' | 'recall.richHurt' | 'lane.lowHealth' | null = null
  if (health <= LOW_HEALTH.health) key = gold >= LOW_HEALTH.gold ? 'recall.lowHealth' : 'lane.lowHealth'
  else if (health <= RICH_AND_HURT.health && gold >= RICH_AND_HURT.gold) key = 'recall.richHurt'
  if (!key) return
  memory.healthAt = clock
  say(reading, key, { gold, health: Math.round(health * 100) })
}

/** Seconds without vision before warding is suggested: a support's trinket and wards come up faster. */
export const WARD_IDLE = { laner: 240, support: 180, from: 240 } as const

/**
 * A ward score that has not risen for four minutes (three for a support):
 * no ward placed or cleared, none left standing to earn vision (ABSOL's
 * "bota uma ward no rio", every 240 s). Never while dead.
 */
export function wardTips(reading: Reading) {
  const { me, clock, memory } = reading
  const score = me.wardScore ?? 0
  if (!memory.ward || score > memory.ward.score) {
    memory.ward = { score, at: clock }
    return
  }
  if (me.dead || clock < WARD_IDLE.from) return
  const idle = me.position === 'UTILITY' ? WARD_IDLE.support : WARD_IDLE.laner
  const since = Math.max(memory.ward.at, memory.wardSaidAt ?? 0)
  if (clock - since < idle) return
  memory.wardSaidAt = clock
  say(reading, 'ward.idle', { minutes: Math.round(idle / 60) })
}

/** Gold from which a finished item is a power spike: a legendary, not a component or boots. */
const SPIKE_GOLD = 2200

/** The finished item a reading added to `after`, if any: a new legendary, not a component, boots or a consumable. */
export function finishedItem(before: GameItem[], after: GameItem[], items: Record<number, StaticItemData>): StaticItemData | null {
  for (const item of after) {
    if (before.some(held => held.itemId === item.itemId)) continue
    const data = items[item.itemId]
    const tags = data?.tags ?? []
    if (!data || data.totalGold < SPIKE_GOLD || tags.includes('Boots') || tags.includes('Consumable') || tags.includes('Trinket')) continue
    return data
  }
  return null
}

/** A legendary we just finished: our spike, the moment to trade or take a play. Not to a support, whose spikes are the team's. */
export function ownSpikeTips(reading: Reading) {
  const { me, last, game, items } = reading
  if (!last || me.position === 'UTILITY') return
  const was = last.players[game.players.indexOf(me)] as GamePlayer | undefined
  if (!was) return
  const item = finishedItem(was.items, me.items, items)
  if (item) say(reading, 'lane.spikeMine', { item: item.name }, `spike@me@${item.id}`)
}
