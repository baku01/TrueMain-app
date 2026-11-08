import { describe, expect, it } from 'vitest'
import type { GamePlayer, GameState } from '../app/types/game'
import type { TipMemory } from '../app/utils/tips/engine'
import { emptyMemory, evaluate } from '../app/utils/tips/engine'
import { sampleGame } from '../app/utils/overlay-sample'

// The sample's roster: Ahri (us, mid) and Vi on blue side; Viego (jungle) and Orianna (mid) on red.
const AHRI = 2
const VI = 1
const VIEGO = 6
const ORIANNA = 7
const EZREAL = 8

/** An early game with nothing on the map: every player level 1 with no item, no kill, no death. */
function game(edit: (game: GameState) => void = () => {}): GameState {
  const base = sampleGame()
  const fresh: GameState = {
    ...base,
    players: base.players.map(player => ({ ...player, level: 1, items: [] })),
    objectives: { ...base.objectives, timers: { ...base.objectives.timers!, dragon: { at: 300, until: null } } },
    pace: { samples: [] },
  }
  edit(fresh)
  return fresh
}

/** The game with player `index` changed. */
const changed = (state: GameState, index: number, change: Partial<GamePlayer>): GameState =>
  ({ ...state, players: state.players.map((player, at) => (at === index ? { ...player, ...change } : player)) })

const playing = (index: number) => (state: GameState) => state.players.forEach((player, at) => (player.isMe = at === index))

function run(readings: [GameState, number][], memory: TipMemory = emptyMemory()) {
  const said: { key: string, at: number, params: Record<string, string | number> }[] = []
  for (const [state, clock] of readings) {
    const read = evaluate(memory, state, clock)
    memory = read.memory
    said.push(...read.tips.map(tip => ({ key: tip.key, at: clock, params: tip.params })))
  }
  return { said, keys: said.map(entry => entry.key) }
}

const seconds = (state: GameState, from: number, to: number): [GameState, number][] =>
  Array.from({ length: to - from + 1 }, (_, index) => [state, from + index])

describe('the enemy jungler', () => {
  it('tells a laner where to ward 45 s before his first clear ends, that it is about to end, and his second gank window', () => {
    const { said } = run(seconds(game(), 100, 300))
    const jungle = said.filter(entry => entry.key.startsWith('jungle') || entry.key.startsWith('ward.gank'))
    // Viego's first clear ends at 3:11 (patch 26.22's median); Ahri is mid.
    expect(jungle.map(entry => [entry.key, entry.at])).toEqual([['ward.gank.mid', 146], ['jungle.firstClear', 181], ['jungle.gankWindow', 261]])
    expect(jungle[0]!.params).toEqual({ champion: 'Viego', alias: 'Viego', time: '3:11' })
  })

  it('names the bush by lane, takes the clear off the table, and tells a jungler nothing of it', () => {
    const kayn = game(state => Object.assign(state.players[VIEGO]!, { champion: 'Kayn', championName: 'Kayn' }))
    expect(run(seconds(kayn, 100, 200)).said.find(entry => entry.key === 'jungle.firstClear')?.at).toBe(174)
    expect(run(seconds(game(playing(0)), 100, 200)).keys).toContain('ward.gank.top')
    expect(run(seconds(game(playing(4)), 100, 200)).keys).toContain('ward.gank.bot')
    const jungler = run(seconds(game(playing(VI)), 100, 300)).keys
    expect(jungler.filter(key => key === 'jungle.firstClear' || key === 'jungle.gankWindow' || key.startsWith('ward.gank'))).toEqual([])
  })

  it('says he was seen when his items change while he is alive — not his level, which moves in the fog — every 20 s at most', () => {
    const before = game()
    const level2 = changed(before, VIEGO, { level: 2 })
    const bought = changed(level2, VIEGO, { items: [{ itemId: 1036, slot: 0, count: 1 }] })
    const again = changed(bought, VIEGO, { items: [{ itemId: 1036, slot: 0, count: 1 }, { itemId: 1037, slot: 1, count: 1 }] })
    const third = changed(again, VIEGO, { items: [...again.players[VIEGO]!.items, { itemId: 1038, slot: 2, count: 1 }] })
    const { said } = run([[before, 200], [level2, 201], [bought, 210], [again, 220], [third, 240]])
    expect(said.filter(entry => entry.key === 'jungle.spotted').map(entry => entry.at)).toEqual([210, 240])
  })

  it('not on his respawn, not before 0:40, not after 15:00', () => {
    const dead = game(state => (state.players[VIEGO]!.dead = true))
    const back = changed(dead, VIEGO, { dead: false, items: [{ itemId: 1036, slot: 0, count: 1 }] })
    expect(run([[dead, 300], [back, 302]]).keys).not.toContain('jungle.spotted')
    const early = game()
    const item = { items: [{ itemId: 1039, slot: 0, count: 1 }] }
    expect(run([[early, 30], [changed(early, VIEGO, item), 31]]).keys).not.toContain('jungle.spotted')
    expect(run([[early, 900], [changed(early, VIEGO, item), 901]]).keys).not.toContain('jungle.spotted')
  })
})

describe('an enemy down', () => {
  const died = (state: GameState, index: number, respawnAt: number) => changed(state, index, { dead: true, respawnAt, deaths: 1 })

  it('tells everyone how long their jungler is down, before 15:00', () => {
    const { said } = run([[game(), 400], [died(game(), VIEGO, 432), 401]])
    expect(said.filter(entry => entry.key === 'jungle.dead').map(entry => entry.params)).toEqual([{ champion: 'Viego', alias: 'Viego', seconds: 31 }])
    expect(run([[game(), 950], [died(game(), VIEGO, 1000), 951]]).keys).not.toContain('jungle.dead')
  })

  it('tells a laner his lane opponent is down in the laning phase, and no one else', () => {
    expect(run([[game(), 500], [died(game(), ORIANNA, 525), 501]]).keys).toContain('lane.opponentDead')
    expect(run([[game(), 850], [died(game(), ORIANNA, 900), 851]]).keys).not.toContain('lane.opponentDead')
    expect(run([[game(), 500], [died(game(), EZREAL, 525), 501]]).keys).not.toContain('lane.opponentDead')
    // Under 10 s left: nothing worth doing.
    expect(run([[game(), 500], [died(game(), ORIANNA, 508), 501]]).keys).not.toContain('lane.opponentDead')
  })
})

describe('the level 2 race', () => {
  it('says who got there first, once, before 3:00', () => {
    const mine = run([[game(), 90], [changed(game(), AHRI, { level: 2 }), 91]])
    expect(mine.said.filter(entry => entry.key.startsWith('lane.levelTwo')).map(entry => entry.key)).toEqual(['lane.levelTwoFirst'])
    const theirs = run([[game(), 90], [changed(game(), ORIANNA, { level: 2 }), 91]])
    expect(theirs.said.find(entry => entry.key === 'lane.levelTwoBehind')?.params).toEqual({ champion: 'Orianna', alias: 'Orianna' })
  })

  it('says nothing when both get there in one reading, after 3:00, or to a jungler', () => {
    const both = changed(changed(game(), AHRI, { level: 2 }), ORIANNA, { level: 2 })
    expect(run([[game(), 90], [both, 91]]).keys.some(key => key.startsWith('lane.levelTwo'))).toBe(false)
    expect(run([[game(), 180], [changed(game(), AHRI, { level: 2 }), 181]]).keys.some(key => key.startsWith('lane.levelTwo'))).toBe(false)
    const jungle = game(playing(VI))
    expect(run([[jungle, 90], [changed(jungle, VI, { level: 2 }), 91]]).keys.some(key => key.startsWith('lane.levelTwo'))).toBe(false)
  })
})

describe('the first level 6 of the lane', () => {
  it('says we got there first, once', () => {
    const six = game(state => (state.players[AHRI]!.level = 6))
    const { keys } = run([[game(), 400], [six, 401], [changed(six, ORIANNA, { level: 6 }), 420]])
    expect(keys.filter(key => key.startsWith('level'))).toEqual(['level.sixFirst'])
  })

  it('says our lane opponent did, by name', () => {
    const theirs = changed(game(), ORIANNA, { level: 6 })
    const { said } = run([[game(), 400], [theirs, 401]])
    expect(said.filter(entry => entry.key.startsWith('level'))).toEqual([{ key: 'level.enemySixFirst', at: 401, params: { champion: 'Orianna', alias: 'Orianna' } }])
  })

  it('says nothing when both got there in one reading, nor without lanes', () => {
    const both = changed(game(state => (state.players[AHRI]!.level = 6)), ORIANNA, { level: 6 })
    expect(run([[game(), 400], [both, 401], [changed(both, AHRI, { level: 7 }), 450]]).keys.filter(key => key.startsWith('level'))).toEqual([])
    const laneless = game(state => (state.players[AHRI]!.position = ''))
    expect(run([[laneless, 400], [changed(laneless, AHRI, { level: 6 }), 401]]).keys.filter(key => key.startsWith('level'))).toEqual([])
  })
})

describe('kills and deaths', () => {
  it('cheers a kill at level 2, once a game, and not one at level 3', () => {
    const two = game(state => (state.players[AHRI]!.level = 2))
    const kill = changed(two, AHRI, { kills: 1 })
    expect(run([[two, 150], [kill, 151], [changed(kill, AHRI, { kills: 2 }), 160]]).keys.filter(key => key === 'kill.levelTwo')).toEqual(['kill.levelTwo'])
    const three = game(state => (state.players[AHRI]!.level = 3))
    expect(run([[three, 150], [changed(three, AHRI, { kills: 1 }), 151]]).keys).not.toContain('kill.levelTwo')
  })

  it('names a fed enemy shut down: 6 kills or more, 4 more than his deaths', () => {
    const fed = game(state => Object.assign(state.players[EZREAL]!, { kills: 7, deaths: 2 }))
    const { said } = run([[fed, 900], [changed(fed, EZREAL, { deaths: 3, dead: true }), 901]])
    expect(said.filter(entry => entry.key === 'kill.shutdown')).toEqual([{ key: 'kill.shutdown', at: 901, params: { champion: 'Ezreal', alias: 'Ezreal' } }])
    for (const [kills, deaths] of [[6, 3], [5, 0]]) {
      const even = game(state => Object.assign(state.players[EZREAL]!, { kills, deaths }))
      expect(run([[even, 900], [changed(even, EZREAL, { deaths: deaths + 1 }), 901]]).keys).not.toContain('kill.shutdown')
    }
  })

  /** Our deaths, one reading each, `killer`'s kills rising with each. */
  function deaths(count: number, killer: number | null, start = game()) {
    const readings: [GameState, number][] = [[start, 600]]
    let state = start
    for (let death = 1; death <= count; death++) {
      state = changed(state, AHRI, { deaths: death })
      if (killer !== null) state = changed(state, killer, { kills: state.players[killer]!.kills + 1 })
      readings.push([state, 600 + death * 60])
    }
    return readings
  }

  it('calls a third death in a row a streak, then every second one', () => {
    const { said } = run(deaths(6, null))
    expect(said.filter(entry => entry.key === 'death.streak').map(entry => entry.params.deaths)).toEqual([3, 5])
  })

  it('starts the streak over with a kill or an assist', () => {
    const readings = deaths(2, null)
    const [last] = readings.at(-1)!
    const helped = changed(last, AHRI, { assists: 1 })
    const again = changed(helped, AHRI, { deaths: 3 })
    expect(run([...readings, [helped, 800], [again, 860]]).keys).not.toContain('death.streak')
  })

  it('names the enemy who killed us a third time, when the reading tells who it was', () => {
    const { said } = run(deaths(3, ORIANNA))
    expect(said.filter(entry => entry.key === 'death.nemesis')).toEqual([{ key: 'death.nemesis', at: 780, params: { champion: 'Orianna', alias: 'Orianna' } }])
  })

  it('blames no one when two enemies scored in the reading of our death', () => {
    const readings = deaths(3, ORIANNA).map(([state, clock], index): [GameState, number] =>
      [index ? changed(state, VIEGO, { kills: index }) : state, clock])
    expect(run(readings).keys).not.toContain('death.nemesis')
  })
})

describe('a new game', () => {
  it('starts the memory over: another roster says its once-a-game lines again', () => {
    const six = changed(game(), AHRI, { level: 6 })
    const other = (state: GameState) => ({ ...state, players: state.players.map((player, at) => (at === ORIANNA ? { ...player, champion: 'Syndra', championName: 'Syndra' } : player)) })
    const { keys } = run([[game(), 400], [six, 401], [other(game()), 10], [other(six), 11]])
    expect(keys.filter(key => key === 'level.sixFirst')).toHaveLength(2)
  })
})
