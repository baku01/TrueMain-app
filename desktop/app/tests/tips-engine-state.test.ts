import { describe, expect, it } from 'vitest'
import type { StaticItemData } from '#shared/types/static-data'
import type { GamePlayer, GameState } from '../app/types/game'
import type { TipMemory } from '../app/utils/tips/engine'
import { emptyMemory, evaluate } from '../app/utils/tips/engine'
import { sampleGame } from '../app/utils/overlay-sample'

// The sample's roster: Ahri (us, mid) on blue side, Orianna mid on red.
const AHRI = 2
const ORIANNA = 7

/** A game at full health with nothing on the map, every player level 6 with no item and a ward score that will not move. */
function game(edit: (game: GameState) => void = () => {}): GameState {
  const base = sampleGame()
  const fresh: GameState = {
    ...base,
    players: base.players.map(player => ({ ...player, level: 6, items: [], kills: 0, deaths: 0, dead: false, respawnAt: null })),
    gold: 500,
    vitals: { health: 1, resource: 1, resourceKind: 'MANA' },
    objectives: {
      order: { ...base.objectives.order, turrets: 0, dragons: 0, drakes: [] },
      chaos: { ...base.objectives.chaos, turrets: 0, dragons: 0, drakes: [] },
      timers: { dragon: { at: 300, until: null }, elder: false, drake: null, grubs: { at: null, until: null }, herald: { at: null, until: null }, baron: { at: 1200, until: null } },
    },
    pace: { samples: [] },
  }
  edit(fresh)
  return fresh
}

const changed = (state: GameState, index: number, change: Partial<GamePlayer>): GameState =>
  ({ ...state, players: state.players.map((player, at) => (at === index ? { ...player, ...change } : player)) })

function run(readings: [GameState, number][], items: Record<number, StaticItemData> = {}, memory: TipMemory = emptyMemory()) {
  const said: { key: string, at: number, params: Record<string, string | number> }[] = []
  for (const [state, clock] of readings) {
    const read = evaluate(memory, state, clock, items)
    memory = read.memory
    said.push(...read.tips.map(tip => ({ key: tip.key, at: clock, params: tip.params })))
  }
  return { said, keys: said.map(entry => entry.key) }
}

const seconds = (state: GameState, from: number, to: number): [GameState, number][] =>
  Array.from({ length: to - from + 1 }, (_, index) => [state, from + index])

const hurt = (health: number, gold: number) => game((state) => {
  state.vitals = { ...state.vitals, health }
  state.gold = gold
})

describe('our health', () => {
  it('sends us back at a quarter health with gold to spend, and behind the wave without it', () => {
    expect(run(seconds(hurt(0.2, 900), 400, 401)).said[0]).toMatchObject({ key: 'recall.lowHealth', params: { gold: 900, health: 20 } })
    expect(run(seconds(hurt(0.2, 300), 400, 401)).keys).toContain('lane.lowHealth')
  })

  it('sends us back at half health with a full purse, and says nothing at full health or while dead', () => {
    expect(run(seconds(hurt(0.45, 2600), 400, 401)).keys).toContain('recall.richHurt')
    expect(run(seconds(hurt(0.45, 1200), 400, 401)).keys.some(key => key.includes('Health') || key.includes('richHurt'))).toBe(false)
    const dead = game((state) => {
      state.vitals = { ...state.vitals, health: 0 }
      state.players[AHRI]!.dead = true
    })
    expect(run(seconds(dead, 400, 410)).keys.some(key => key.includes('Health'))).toBe(false)
  })

  it('says it at most every 45 s', () => {
    const times = run(seconds(hurt(0.2, 900), 400, 500)).said.filter(entry => entry.key === 'recall.lowHealth').map(entry => entry.at)
    expect(times).toEqual([400, 445, 490])
  })
})

describe('our vision', () => {
  it('asks for a ward once the ward score stood still four minutes, three for a support', () => {
    expect(run(seconds(game(), 0, 500)).said.filter(entry => entry.key === 'ward.idle').map(entry => entry.at)).toEqual([240, 480])
    const support = game(state => state.players.forEach((player, at) => (player.isMe = at === 4)))
    expect(run(seconds(support, 0, 400)).said.filter(entry => entry.key === 'ward.idle').map(entry => entry.at)).toEqual([240])
  })

  it('stays quiet while the ward score rises', () => {
    const readings = Array.from({ length: 600 }, (_, at): [GameState, number] => [changed(game(), AHRI, { wardScore: Math.floor(at / 100) }), at])
    expect(run(readings).keys).not.toContain('ward.idle')
  })
})

describe('the lane', () => {
  const items: Record<number, StaticItemData> = {
    3089: { id: 3089, name: 'Rabadon\'s Deathcap', iconUrl: '', totalGold: 3500 },
    1058: { id: 1058, name: 'Needlessly Large Rod', iconUrl: '', totalGold: 1200 },
    3020: { id: 3020, name: 'Sorcerer\'s Shoes', iconUrl: '', totalGold: 1100, tags: ['Boots'] },
  }

  it('says our lane opponent finished a legendary, once — not a component or boots', () => {
    const bought = (itemId: number) => changed(game(), ORIANNA, { items: [{ itemId, slot: 0, count: 1 }] })
    const said = run([[game(), 500], [bought(3089), 501], [bought(3089), 502]], items).said.filter(entry => entry.key === 'lane.spikeTheirs')
    expect(said).toEqual([{ key: 'lane.spikeTheirs', at: 501, params: { champion: 'Orianna', alias: 'Orianna', item: 'Rabadon\'s Deathcap' } }])
    expect(run([[game(), 500], [bought(1058), 501]], items).keys).not.toContain('lane.spikeTheirs')
    expect(run([[game(), 500], [bought(3020), 501]], items).keys).not.toContain('lane.spikeTheirs')
  })

  it('says we finished ours', () => {
    const mine = changed(game(), AHRI, { items: [{ itemId: 3089, slot: 0, count: 1 }] })
    expect(run([[game(), 500], [mine, 501]], items).keys).toContain('lane.spikeMine')
  })

  it('says two levels up or down once each way until the gap closes, in the laning phase', () => {
    const gap = (ours: number, theirs: number) => changed(changed(game(), AHRI, { level: ours }), ORIANNA, { level: theirs })
    const keys = run([[gap(6, 6), 300], [gap(8, 6), 301], [gap(8, 6), 302], [gap(7, 6), 303], [gap(6, 8), 304]]).keys.filter(key => key.startsWith('lane.level'))
    expect(keys).toEqual(['lane.levelAhead', 'lane.levelBehind'])
    expect(run([[gap(6, 6), 900], [gap(9, 6), 901]]).keys.some(key => key.startsWith('lane.level'))).toBe(false)
  })
})

describe('the map\'s numbers', () => {
  const down = (state: GameState, indexes: number[], respawnAt: number) =>
    indexes.reduce((next, index) => changed(next, index, { dead: true, respawnAt, deaths: 1 }), state)

  it('calls an objective standing while two enemies are down, the biggest first', () => {
    const baronUp = game(state => (state.objectives.timers!.baron = { at: 1200, until: null }))
    const said = run([[down(baronUp, [5, 6], 1240), 1210]]).said
    expect(said.find(entry => entry.key === 'macro.take.baron')?.params).toEqual({ down: 2, seconds: 30 })
    // Down for under 15 s: not worth the walk.
    expect(run([[down(baronUp, [5, 6], 1220), 1210]]).keys).not.toContain('macro.take.baron')
  })

  it('calls an ace, and a numbers disadvantage', () => {
    expect(run([[down(game(), [5, 6, 7, 8, 9], 1000), 970]]).keys).toContain('macro.ace')
    expect(run([[down(game(), [0, 1], 640), 600]]).keys).toContain('macro.outnumbered')
  })

  it('says a side reached its soul point, once', () => {
    const drakes = (count: number) => game((state) => {
      state.objectives = { ...state.objectives, chaos: { ...state.objectives.chaos, dragons: count } }
    })
    const keys = run([[drakes(2), 900], [drakes(3), 901], [drakes(3), 902]]).keys.filter(key => key.startsWith('objective.soulPoint'))
    expect(keys).toEqual(['objective.soulPoint.theirs'])
  })
})
