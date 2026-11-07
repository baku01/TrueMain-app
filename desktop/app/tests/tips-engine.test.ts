import { describe, expect, it } from 'vitest'
import type { StaticItemData } from '#shared/types/static-data'
import type { GameState } from '../app/types/game'
import type { Tip } from '../app/utils/tips/catalogue'
import type { TipMemory } from '../app/utils/tips/engine'
import { emptyMemory, evaluate } from '../app/utils/tips/engine'
import { goldLead, minimapEvery } from '../app/utils/tips/rules-clock'
import { sampleGame } from '../app/utils/overlay-sample'

// The sample's roster: Ahri (us, mid) and Vi (jungle) on blue side.
const AHRI = 2
const VI = 1

/** An early game on the standard spawns, every player level 1 with nothing on the map. */
function game(edit: (game: GameState) => void = () => {}): GameState {
  const base = sampleGame()
  const fresh: GameState = {
    ...base,
    players: base.players.map(player => ({ ...player, level: 1, items: [] })),
    gold: 500,
    objectives: {
      order: { ...base.objectives.order, turrets: 0, dragons: 0, drakes: [] },
      chaos: { ...base.objectives.chaos, turrets: 0, dragons: 0, drakes: [] },
      timers: {
        dragon: { at: 300, until: null },
        elder: false,
        drake: null,
        grubs: { at: 480, until: 885 },
        herald: { at: 900, until: 1185 },
        baron: { at: 1200, until: null },
      },
    },
    pace: { samples: [] },
  }
  edit(fresh)
  return fresh
}

/** Us on another champion of the sample. */
const playing = (index: number) => (game: GameState) => game.players.forEach((player, at) => (player.isMe = at === index))

interface Said { key: string, at: number, tip: Tip }

/** The engine fed one reading after another; what it said, and when. */
function run(readings: [GameState, number][], items: Record<number, StaticItemData> = {}, memory: TipMemory = emptyMemory()) {
  const said: Said[] = []
  for (const [state, clock] of readings) {
    const read = evaluate(memory, state, clock, items)
    memory = read.memory
    said.push(...read.tips.map(tip => ({ key: tip.key, at: clock, tip })))
  }
  return { said, keys: said.map(entry => entry.key), memory }
}

/** The same game read every second from `from` to `to`. */
const seconds = (state: GameState, from: number, to: number): [GameState, number][] =>
  Array.from({ length: to - from + 1 }, (_, index) => [state, from + index])

describe('the objectives', () => {
  it('warns a minute and half a minute before a spawn, once each', () => {
    const { said } = run(seconds(game(), 230, 300))
    expect(said.filter(entry => entry.key.startsWith('objective')).map(entry => [entry.key, entry.at])).toEqual([
      ['objective.dragon.60s', 240],
      ['objective.dragon.30s', 270],
    ])
  })

  it('gives a jungler the Smite line ten seconds before, never for the grubs', () => {
    const jungler = game(playing(VI))
    expect(run(seconds(jungler, 285, 292)).keys).toContain('objective.dragon.smite')
    const grubs = run(seconds(jungler, 410, 480)).keys.filter(key => key.startsWith('objective'))
    expect(grubs).toEqual(['objective.grubs.60s', 'objective.grubs.30s'])
  })

  it('names the Elder once a side holds the soul', () => {
    const elder = game(state => (state.objectives.timers = { ...state.objectives.timers!, elder: true, dragon: { at: 2000, until: null } }))
    expect(run(seconds(elder, 1935, 1945)).keys).toContain('objective.elder.60s')
  })

  it('says nothing of a moment already gone: opened mid-countdown, or a clock that jumped', () => {
    expect(run(seconds(game(), 245, 250)).keys).not.toContain('objective.dragon.60s')
    const jumped = game()
    expect(run([[jumped, 200], [jumped, 250]]).keys.filter(key => key.startsWith('objective'))).toEqual([])
  })

  it('says nothing of an objective gone for good, nor to a spectator or off the Rift', () => {
    const gone = game(state => (state.objectives.timers!.dragon = { at: null, until: null }))
    expect(run(seconds(gone, 230, 300)).keys.filter(key => key.startsWith('objective'))).toEqual([])
    const spectating = game(state => (state.myTeam = null))
    expect(run(seconds(spectating, 230, 300)).keys).toEqual([])
    const aram = game(state => (state.objectives.timers = null))
    expect(run(seconds(aram, 230, 300)).keys).toEqual([])
  })
})

describe('the minimap', () => {
  it('comes up from 1:30, further apart as the game goes on', () => {
    expect([0, 299, 300, 600, 900, 1500].map(minimapEvery)).toEqual([30, 30, 35, 40, 50, 60])
    const times = run(seconds(game(), 0, 700)).said.filter(entry => entry.key === 'map.minimap').map(entry => entry.at)
    // Every 30 s to 5:00, then 35 s to 10:00, then 40 s.
    expect(times.slice(0, 7)).toEqual([120, 150, 180, 210, 240, 270, 305])
    expect(times.slice(-3)).toEqual([585, 625, 665])
  })

  it('never while we are dead', () => {
    const dead = game(state => (state.players[AHRI]!.dead = true))
    expect(run(seconds(dead, 0, 400)).keys).not.toContain('map.minimap')
  })
})

describe('the early recall', () => {
  const rich = (gold: number) => game(state => (state.gold = gold))

  it('suggests a back with 1400 gold between 3:00 and 5:00, a minute apart at most', () => {
    const { said } = run(seconds(rich(1400), 170, 320))
    const recalls = said.filter(entry => entry.key === 'recall.earlyGold')
    expect(recalls.map(entry => entry.at)).toEqual([180, 240])
    expect(recalls[0]!.tip.params).toEqual({ gold: 1400 })
  })

  it('stays quiet short of the gold, after 5:00, or while dead', () => {
    expect(run(seconds(rich(1350), 180, 299)).keys).not.toContain('recall.earlyGold')
    expect(run(seconds(rich(3000), 300, 400)).keys).not.toContain('recall.earlyGold')
    const dead = game((state) => {
      state.gold = 2000
      state.players[AHRI]!.dead = true
    })
    expect(run(seconds(dead, 180, 299)).keys).not.toContain('recall.earlyGold')
  })
})

describe('the trinket', () => {
  const holding = (index: number, trinket: number, level: number) => game((state) => {
    playing(index)(state)
    state.players[index]!.items = [{ itemId: trinket, slot: 6, count: 1 }]
    state.players[index]!.level = level
  })

  it('sends a jungler still on the yellow trinket to the red lens from 3:00, once', () => {
    expect(run(seconds(holding(VI, 3340, 4), 170, 179)).keys).not.toContain('ward.redLens')
    expect(run(seconds(holding(VI, 3340, 4), 175, 260)).keys.filter(key => key === 'ward.redLens')).toEqual(['ward.redLens'])
  })

  it('sends a mid or a carry to the blue one from level 9', () => {
    expect(run([[holding(AHRI, 3340, 9), 700]]).keys).toContain('ward.blueLens')
    expect(run([[holding(AHRI, 3340, 8), 700]]).keys).not.toContain('ward.blueLens')
    expect(run([[holding(AHRI, 3363, 9), 700]]).keys).not.toContain('ward.blueLens')
    expect(run([[holding(0, 3340, 12), 900]]).keys).not.toContain('ward.blueLens')
  })
})

describe('the farm', () => {
  const farmed = (index: number, cs: number, minute = 10) => game((state) => {
    playing(index)(state)
    state.pace = { samples: [{ minute, cs, gold: 0 }] }
  })
  const verdict = (state: GameState, from = 598, to = 640) => run(seconds(state, from, to)).said.filter(entry => entry.key.startsWith('farm'))

  it('judges a laner\'s CS per minute at 10:00 against 7 and 5', () => {
    const great = verdict(farmed(AHRI, 75))
    expect(great.map(entry => entry.key)).toEqual(['farm.great'])
    expect(great[0]!.tip.params).toEqual({ csPerMin: 7.5, minute: 10 })
    expect(verdict(farmed(AHRI, 60)).map(entry => entry.key)).toEqual(['farm.ok'])
    expect(verdict(farmed(AHRI, 40)).map(entry => entry.key)).toEqual(['farm.low'])
  })

  it('judges a jungler\'s against 5 and 3, and never a support\'s', () => {
    expect(verdict(farmed(VI, 55)).map(entry => entry.key)).toEqual(['farm.great'])
    expect(verdict(farmed(VI, 40)).map(entry => entry.key)).toEqual(['farm.ok'])
    expect(verdict(farmed(VI, 25)).map(entry => entry.key)).toEqual(['farm.low'])
    expect(verdict(farmed(4, 20))).toEqual([])
  })

  it('waits for the minute\'s sample, then half a minute at most, and judges again every five minutes', () => {
    expect(verdict(farmed(AHRI, 75, 9))).toEqual([])
    expect(verdict(farmed(AHRI, 75), 631, 700)).toEqual([])
    expect(verdict(farmed(AHRI, 120, 15), 895, 930).map(entry => entry.tip.params.minute)).toEqual([15])
  })
})

describe('the gold lead', () => {
  const ITEMS = { 1: { totalGold: 1000, tags: [] }, 2: { totalGold: 3000, tags: [] }, 3340: { totalGold: 0, tags: ['Trinket'] } } as unknown as Record<number, StaticItemData>
  /** Each of ours on `ours` gold of items, each of theirs on 1000. */
  const items = (ours: number[]) => game(state => state.players.forEach((player) => {
    player.items = player.team === 'ORDER' ? ours.map((itemId, slot) => ({ itemId, slot, count: 1 })) : [{ itemId: 1, slot: 0, count: 1 }]
  }))

  it('weighs the item-gold share, the drakes, the turrets, the kills and a Baron', () => {
    expect(goldLead(items([1]), 'ORDER', 900, ITEMS)).toBe(0)
    // 30 000 against 5 000: far past the whole scale.
    expect(goldLead(items([2, 2]), 'ORDER', 900, ITEMS)).toBe(10)
    const map = items([1])
    map.objectives.order = { ...map.objectives.order, dragons: 2, turrets: 2, baronUntil: 1000 }
    map.players[0]!.kills = 5
    expect(goldLead(map, 'ORDER', 900, ITEMS)).toBe(2 + 1 + 1 + 2)
    expect(goldLead(map, 'CHAOS', 900, ITEMS)).toBe(-6)
  })

  it('says a side is ahead once, again only after it came back to even and five minutes on', () => {
    const ahead = items([2, 2])
    const even = items([1])
    const { said } = run([[ahead, 700], [ahead, 701], [even, 800], [ahead, 900], [even, 1000], [ahead, 1001]], ITEMS)
    expect(said.filter(entry => entry.key.startsWith('gold')).map(entry => [entry.key, entry.at])).toEqual([['gold.ahead', 700], ['gold.ahead', 1001]])
  })

  it('says when we fall behind, and nothing before 10:00 or without the item prices', () => {
    const behind = game(state => state.players.forEach((player) => {
      player.items = [{ itemId: player.team === 'ORDER' ? 1 : 2, slot: 0, count: 1 }]
    }))
    expect(run([[behind, 700]], ITEMS).keys).toContain('gold.behind')
    expect(run([[behind, 599]], ITEMS).keys).not.toContain('gold.behind')
    expect(run([[behind, 700]], {}).keys).not.toContain('gold.behind')
  })
})
