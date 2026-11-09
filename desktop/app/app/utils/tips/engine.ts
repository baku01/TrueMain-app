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
/**
 * The modes the rules hold for: Summoner's Rift's standard game and its
 * Practice Tool, whose minions, camps and objectives keep the same clock.
 * Swiftplay's waves and objectives come on another one, ARAM is another map.
 */
export const RIFT_MAP = 11
export const RIFT_MODES: ReadonlySet<string> = new Set(['CLASSIC', 'PRACTICETOOL'])

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
 * Summoner's Rift's standard game and Practice Tool (`RIFT_MODES`) only:
 * spectating, in another mode or on another map, it says nothing. The rules
 * that count down to an objective need its timers too, and skip without.
 * A different roster is a new game, and the memory starts over.
 */
export function evaluate(memory: TipMemory, game: GameState, clock: number, items: Record<number, StaticItemData> = {}): { memory: TipMemory, tips: Tip[] } {
  const fresh = memory.last && !sameRoster(memory.last, game) ? emptyMemory() : memory
  const draft: TipMemory = { ...fresh, said: { ...fresh.said }, killedBy: { ...fresh.killedBy } }
  const tips: Tip[] = []
  const me = game.players.find(player => player.isMe)
  if (me && game.myTeam && game.mapNumber === RIFT_MAP && RIFT_MODES.has(game.gameMode)) {
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
