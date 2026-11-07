import type { StaticItemData } from '#shared/types/static-data'
import type { GameState } from '~/types/game'
import type { Tip } from './catalogue'
import type { Reading, TipMemory } from './reading'
import { emptyMemory, sameRoster } from './reading'
import { farmTips, goldTips, minimapTips, objectiveTips, recallTips, trinketTips } from './rules-clock'
import { fightTips, jungleTips, levelTips } from './rules-players'

export type { TipMemory } from './reading'
export { emptyMemory } from './reading'

/** Every rule, in the order their tips are queued within one reading. */
const RULES: ((reading: Reading) => void)[] = [objectiveTips, jungleTips, fightTips, levelTips, recallTips, farmTips, trinketTips, goldTips, minimapTips]

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
    for (const rule of RULES) rule(reading)
  }
  draft.last = game
  draft.clock = clock
  return { memory: draft, tips }
}
