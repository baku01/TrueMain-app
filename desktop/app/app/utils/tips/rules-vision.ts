import type { GamePlayer } from '~/types/game'
import type { TipKey } from './catalogue'
import type { Reading } from './reading'
import { CONTROL_WARD, crossed, hasFreeSlot, holdsControlWard, isJungler, laneOf, say } from './reading'

/**
 * The tips about vision the data can time: the support's ward on the enemy
 * jungler's start, a Control Ward at the shop, and one for the pit before the
 * dragon or Baron. Where to ward against the first gank goes with the enemy
 * jungler's clear (`rules-players.ts`). Timings are patch 26.1's: minions at
 * 0:30, the jungle's camps at 0:55.
 */

/**
 * When the support is told to ward the enemy buff nearest the bottom lane:
 * after the walk out, before the camps spawn at 0:55 — a ward there shows
 * where their jungler starts, the most telling ward of the early game.
 */
export const START_WARD_AT = 35

/**
 * The enemy buff on the bottom side of the map, by our side: the red side's
 * blue buff and the blue side's red buff sit by the bottom lane.
 */
export const enemyBotsideBuff = (me: GamePlayer): 'blue' | 'red' => (me.team === 'ORDER' ? 'blue' : 'red')

export function startWardTips(reading: Reading) {
  const { me } = reading
  if (me.position !== 'UTILITY' || !crossed(reading, START_WARD_AT)) return
  say(reading, enemyBotsideBuff(me) === 'blue' ? 'ward.startBlue' : 'ward.startRed', {}, 'ward.start')
}

/** Seconds between two Control Ward reminders at the shop: one per trip to base. */
const CONTROL_EVERY = 90

/** From the first back on: the first visit to the shop is planned before the game, the next ones are not. */
const CONTROL_FROM = 150

/** What a Control Ward costs (40 with the support's quest done, still worth saying). */
export const CONTROL_COST = 75

/**
 * At the shop — our items just changed by a purchase, which only happens at
 * base or dead — with no Control Ward in hand, a slot free and its 75 gold
 * left: one more item to buy before walking out.
 */
export function controlShopTips(reading: Reading) {
  const { me, last, memory, clock } = reading
  if (clock < CONTROL_FROM || !last) return
  const was = last.players[reading.game.players.indexOf(me)]
  if (!was) return
  const bought = me.items.some(item => item.slot < 6 && item.itemId !== CONTROL_WARD && !was.items.some(before => before.itemId === item.itemId && before.slot === item.slot))
  if (!bought || holdsControlWard(me) || !hasFreeSlot(me) || reading.game.gold < CONTROL_COST) return
  if (memory.controlAt !== null && clock - memory.controlAt < CONTROL_EVERY) return
  memory.controlAt = clock
  say(reading, 'ward.controlBuy')
}

/** Seconds before the dragon or Baron the pit's Control Ward is planned: time to back, buy and walk there. */
export const CONTROL_BEFORE = 90

/**
 * A minute and a half before the dragon (or the Elder) and Baron, to the
 * players who fight for it — the bottom lane, mid and the jungler for the
 * dragon; top, mid and the jungler for Baron —: back for a Control Ward if
 * none is in hand, or take the one held to the pit.
 */
export function controlObjectiveTips(reading: Reading) {
  const timers = reading.game.objectives.timers
  const { me } = reading
  if (!timers || me.dead) return
  const lane = laneOf(me)
  const jungler = isJungler(me)
  const pits = [
    { at: timers.dragon.at, pit: 'dragon', near: jungler || lane === 'bot' || lane === 'mid' },
    { at: timers.baron.at, pit: 'baron', near: jungler || lane === 'top' || lane === 'mid' },
  ] as const
  const held = holdsControlWard(me)
  for (const { at, pit, near } of pits) {
    if (at === null || !near || !crossed(reading, at - CONTROL_BEFORE)) continue
    const key = `ward.control.${held ? 'place' : 'back'}.${pit}` as TipKey
    say(reading, key, {}, `ward.control@${pit}@${at}`)
  }
}
