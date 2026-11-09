import type { StaticItemData } from '#shared/types/static-data'
import type { GameItem, GamePlayer, GameState } from '~/types/game'
import type { Tip, TipKey, TipParams } from './catalogue'
import { makeTip } from './catalogue'

/**
 * What the tip rules share: the engine's memory between two readings, one
 * reading as the rules see it, and the questions they all ask of a game.
 */

/** What the engine remembers between two readings of one game. */
export interface TipMemory {
  /** The game as last read, to tell what moved since; null before the first reading. */
  last: GameState | null
  /** The game time of the last reading, to tell which marks the clock crossed since. */
  clock: number | null
  /** Lines said once a game, or once per occasion (`objective.dragon.60s@300`). */
  said: Record<string, true>
  /** When the minimap was last brought up. */
  minimapAt: number | null
  /** When a tip other than a filler (`FILLER_PRIORITY`) was last queued: the fillers wait for a quiet screen. */
  spokeAt: number | null
  /** When a Control Ward was last suggested at the shop. */
  controlAt: number | null
  /** When going back for our health was last suggested. */
  healthAt: number | null
  /** Our ward score when it last rose, and when; and when warding was last suggested. */
  ward: { score: number, at: number } | null
  wardSaidAt: number | null
  /** Which way our lane's level gap was last said (−1 behind, 1 ahead, 0 even since). */
  levelGap: -1 | 0 | 1
  /** When the enemy jungler was last reported seen. */
  spottedAt: number | null
  /** When the gold lead was last reported, and which way it then stood. */
  goldAt: number | null
  goldStanding: 'ahead' | 'behind' | 'even'
  /** Our deaths since our last kill or assist. */
  deathStreak: number
  /** The deaths each enemy dealt us, by Riot ID, as far as the readings can tell. */
  killedBy: Record<string, number>
}

export const emptyMemory = (): TipMemory => ({
  last: null,
  clock: null,
  said: {},
  minimapAt: null,
  spokeAt: null,
  controlAt: null,
  healthAt: null,
  ward: null,
  wardSaidAt: null,
  levelGap: 0,
  spottedAt: null,
  goldAt: null,
  goldStanding: 'even',
  deathStreak: 0,
  killedBy: {},
})

/** One reading, as each rule sees it: the memory is the engine's working copy, the rule's to update. */
export interface Reading {
  game: GameState
  /** The game time now, run on from the last reading (`clockAt`). */
  clock: number
  /** The previous reading's game and clock, from `memory` before this reading. */
  last: GameState | null
  lastClock: number | null
  me: GamePlayer
  /** Data Dragon's items, for their prices; empty until loaded. */
  items: Record<number, StaticItemData>
  memory: TipMemory
  tips: Tip[]
}

/** Queue `key`, unless `once` names an occasion already spoken for. */
export function say(reading: Reading, key: TipKey, params: TipParams = {}, once?: string) {
  if (once) {
    if (reading.memory.said[once]) return
    reading.memory.said[once] = true
  }
  reading.tips.push(makeTip(key, params))
}

/**
 * Whether the clock went past `mark` since the last reading, and not long
 * ago: a page that opens mid-game, or a clock that jumps after the window was
 * hidden, says nothing about a moment already gone.
 */
export function crossed(reading: Reading, mark: number, grace = 5) {
  const { lastClock, clock } = reading
  return lastClock !== null && lastClock < mark && mark <= clock && clock - mark < grace
}

export const isJungler = (player: GamePlayer) => player.position === 'JUNGLE' || player.spells.some(spell => spell.key === 'SummonerSmite')

/** The lanes a tip can be about: a support plays the bottom lane's. */
export type Lane = 'top' | 'mid' | 'bot'

/** Our lane, or null for a jungler and in queues without lanes. */
export function laneOf(player: GamePlayer): Lane | null {
  if (isJungler(player)) return null
  switch (player.position) {
    case 'TOP': return 'top'
    case 'MIDDLE': return 'mid'
    case 'BOTTOM':
    case 'UTILITY': return 'bot'
    default: return null
  }
}

/** The Control Ward: 75 gold, one in hand at most two. */
export const CONTROL_WARD = 2055

export const holdsControlWard = (player: GamePlayer) => player.items.some(item => item.itemId === CONTROL_WARD && item.slot < 6)

/** Whether an item can still be bought: a free slot among the six (the trinket's is the seventh). */
export const hasFreeSlot = (player: GamePlayer) => player.items.filter(item => item.slot < 6).length < 6

/** `seconds` of game time as the clock writes it: `3:05`. */
export const clockText = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

/** The enemy on our lane, when there are lanes. */
export function laneOpponent(game: GameState, me: GamePlayer): GamePlayer | null {
  if (!me.position) return null
  return game.players.find(player => player.team !== me.team && player.position === me.position) ?? null
}

/** A champion as a tip names it: in the game's language for the text, by Riot's alias for the voice. */
export const championParams = (player: GamePlayer): TipParams => ({ champion: player.championName, alias: player.champion })

export const sameItems = (a: GameItem[], b: GameItem[]) =>
  a.length === b.length && a.every((item, index) => item.itemId === b[index]!.itemId && item.slot === b[index]!.slot && item.count === b[index]!.count)

/** The same ten players on the same champions: one game, read again. */
export const sameRoster = (a: GameState, b: GameState) =>
  a.players.length === b.players.length && a.players.every((player, index) => player.riotId === b.players[index]!.riotId && player.champion === b.players[index]!.champion)
