import { describe, expect, it } from 'vitest'
import type { GameItem, GamePlayer, GameState } from '../app/types/game'
import type { TipMemory } from '../app/utils/tips/engine'
import { emptyMemory, evaluate } from '../app/utils/tips/engine'
import { CONTROL_WARD } from '../app/utils/tips/reading'
import { sampleGame } from '../app/utils/overlay-sample'

// The sample's roster: Aatrox (top), Vi (jungle), Ahri (us, mid), Jinx, Thresh on blue side; Nautilus supports red.
const AATROX = 0
const AHRI = 2
const THRESH = 4
const NAUTILUS = 9

/** An early game with the dragon at 5:00 and Baron at 20:00, every player level 1 with no item. */
function game(edit: (game: GameState) => void = () => {}): GameState {
  const base = sampleGame()
  const fresh: GameState = {
    ...base,
    players: base.players.map(player => ({ ...player, level: 1, items: [] })),
    gold: 500,
    objectives: {
      ...base.objectives,
      timers: { dragon: { at: 300, until: null }, elder: false, drake: null, grubs: { at: null, until: null }, herald: { at: null, until: null }, baron: { at: 1200, until: null } },
    },
    pace: { samples: [] },
  }
  edit(fresh)
  return fresh
}

const playing = (index: number) => (state: GameState) => state.players.forEach((player, at) => (player.isMe = at === index))

const changed = (state: GameState, index: number, change: Partial<GamePlayer>): GameState =>
  ({ ...state, players: state.players.map((player, at) => (at === index ? { ...player, ...change } : player)) })

function run(readings: [GameState, number][], memory: TipMemory = emptyMemory()) {
  const said: { key: string, at: number }[] = []
  for (const [state, clock] of readings) {
    const read = evaluate(memory, state, clock)
    memory = read.memory
    said.push(...read.tips.map(tip => ({ key: tip.key, at: clock })))
  }
  return { said, keys: said.map(entry => entry.key) }
}

const seconds = (state: GameState, from: number, to: number): [GameState, number][] =>
  Array.from({ length: to - from + 1 }, (_, index) => [state, from + index])

const item = (itemId: number, slot: number): GameItem => ({ itemId, slot, count: 1 })

describe('the support\'s start ward', () => {
  it('sends the support to the enemy buff by the bottom lane at 0:35: their blue one from blue side, their red one from red side', () => {
    expect(run(seconds(game(playing(THRESH)), 20, 60)).said).toContainEqual({ key: 'ward.startBlue', at: 35 })
    expect(run(seconds(game(playing(NAUTILUS)), 20, 60)).said).toContainEqual({ key: 'ward.startRed', at: 35 })
    expect(run(seconds(game(), 20, 60)).keys.some(key => key.startsWith('ward.start'))).toBe(false)
  })
})

describe('the Control Ward at the shop', () => {
  const shopping = (before: GameItem[], after: GameItem[], gold = 300, at = 400) => {
    const was = game(state => (state.players[AHRI]!.items = before))
    const now = changed(was, AHRI, { items: after })
    now.gold = gold
    return run([[was, at], [now, at + 1]]).keys
  }

  it('says to take one when we buy an item with none in hand, a slot free and its gold left', () => {
    expect(shopping([], [item(1036, 0)])).toContain('ward.controlBuy')
  })

  it('not with one in hand, a full inventory, short of 75 gold, or before the first back', () => {
    expect(shopping([item(CONTROL_WARD, 1)], [item(1036, 0), item(CONTROL_WARD, 1)])).not.toContain('ward.controlBuy')
    const five = [1, 2, 3, 4, 5].map(slot => item(1001 + slot, slot))
    expect(shopping(five, [item(1036, 0), ...five])).not.toContain('ward.controlBuy')
    expect(shopping([], [item(1036, 0)], 50)).not.toContain('ward.controlBuy')
    expect(shopping([], [item(1036, 0)], 300, 100)).not.toContain('ward.controlBuy')
    // Buying the ward itself is not a reason to ask for it.
    expect(shopping([], [item(CONTROL_WARD, 0)])).not.toContain('ward.controlBuy')
  })
})

describe('the Control Ward before the pit', () => {
  it('a minute and a half before the dragon: back for one, or take the one held', () => {
    expect(run(seconds(game(), 200, 215)).said).toContainEqual({ key: 'ward.control.back.dragon', at: 210 })
    const held = game(state => (state.players[AHRI]!.items = [item(CONTROL_WARD, 0)]))
    expect(run(seconds(held, 200, 215)).said).toContainEqual({ key: 'ward.control.place.dragon', at: 210 })
  })

  it('to the players who fight for it: the dragon is not top\'s, Baron is', () => {
    expect(run(seconds(game(playing(AATROX)), 200, 215)).keys.some(key => key.startsWith('ward.control'))).toBe(false)
    expect(run(seconds(game(playing(AATROX)), 1100, 1115)).said).toContainEqual({ key: 'ward.control.back.baron', at: 1110 })
  })
})
