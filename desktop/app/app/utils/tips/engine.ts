import type { StaticItemData } from '#shared/types/static-data'
import type { GameState } from '~/types/game'
import type { Tip } from './catalogue'
import { FILLER_PRIORITY } from './catalogue'
import type { Reading, TipMemory } from './reading'
import { emptyMemory, sameRoster } from './reading'
import { cannonTips, farmTips, goldTips, minimapTips, objectiveTips, trinketTips } from './rules-clock'
import { deathWindowTips, fightTips, jungleTips, levelTips, levelTwoTips } from './rules-players'
import { controlObjectiveTips, controlShopTips, startWardTips } from './rules-vision'

export type { TipMemory } from './reading'
export { emptyMemory } from './reading'

/** Every rule, in the order their tips are queued within one reading. */
const RULES: ((reading: Reading) => void)[] = [
  objectiveTips, startWardTips, jungleTips, levelTwoTips, deathWindowTips, controlShopTips, controlObjectiveTips,
  fightTips, levelTips, cannonTips, farmTips, trinketTips, goldTips,
  // Last: it waits for a quiet screen, and this reading's tips break the quiet.
  minimapTips,
]

/**
 * The tip engine: one reading of the game in, the tips it calls for out,
 * with what to remember for the next. Pure — the memory given is not
 * touched, a new one comes back — so it is tested reading by reading.
 *
 * `clock` is the game time now (the last reading run on, `clockAt`): the
 * countdowns move with it between two readings. It coaches the player on
 * Summoner's Rift only: spectating, or on another map, it says nothing. A
 * different roster is a new game, and the memory starts over.
 */
export function evaluate(memory: TipMemory, game: GameState, clock: number, items: Record<number, StaticItemData> = {}): { memory: TipMemory, tips: Tip[] } {
  const fresh = memory.last && !sameRoster(memory.last, game) ? emptyMemory() : memory
  const draft: TipMemory = { ...fresh, said: { ...fresh.said }, killedBy: { ...fresh.killedBy } }
  const tips: Tip[] = []
  const me = game.players.find(player => player.isMe)
  if (me && game.myTeam && game.objectives.timers) {
    const reading: Reading = { game, clock, last: fresh.last, lastClock: fresh.clock, me, items, memory: draft, tips }
    for (const rule of RULES) {
      rule(reading)
      // Anything but a filler breaks the quiet the fillers wait for.
      if (tips.some(tip => tip.priority > FILLER_PRIORITY)) draft.spokeAt = clock
    }
  }
  draft.last = game
  draft.clock = clock
  return { memory: draft, tips }
}
