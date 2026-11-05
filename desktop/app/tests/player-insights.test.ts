import { describe, expect, it } from 'vitest'
import type { DetailedStats, StatLine } from '~/utils/player-stats'
import { bestAllies, bestChampions, improvementsOf, playstyleOf, strengthsOf } from '~/utils/player-insights'
import { game } from './fixtures'

const line = (key: string, edge: number | null): StatLine => ({ key, all: 1, wins: 1, losses: 1, opponents: 1, edge, unit: 'count' })
const stats = (edges: Record<string, number | null>): DetailedStats => ({
  games: 20,
  wins: 10,
  groups: [{ key: 'all', lines: Object.entries(edges).map(([key, edge]) => line(key, edge)), edge: null }],
  multiKills: { double: 0, triple: 0, quadra: 0, penta: 0 },
})

describe('playstyleOf', () => {
  it('names the lean the player beats their opponents on most, and the next one', () => {
    expect(playstyleOf(stats({ damagePerMinute: 0.3, damageShare: 0.2, csPerMinute: 0.1, goldPerMinute: 0.1, deaths: -0.2 })))
      .toEqual({ key: 'carry', second: 'farmer' })
  })

  it('calls an even player balanced', () => {
    expect(playstyleOf(stats({ damagePerMinute: 0.02, csPerMinute: -0.1 }))).toEqual({ key: 'balanced', second: null })
  })
})

describe('strengths and improvements', () => {
  it('keeps the clear gaps only, the widest first', () => {
    const read = stats({ kda: -0.44, visionPerMinute: -0.18, dragons: 0.8, heralds: 1, csAt10: -0.04, wardsPlaced: -0.2 })
    expect(strengthsOf(read).map(entry => entry.key)).toEqual(['heralds', 'dragons'])
    expect(improvementsOf(read).map(entry => entry.key)).toEqual(['kda', 'wardsPlaced', 'visionPerMinute'])
  })
})

describe('bestChampions', () => {
  it('ranks the champions above the player\'s own win rate, three games or more, a big sample over a lucky one', () => {
    const games = [
      ...[true, true, true].map(win => game({ championId: 1, win })),
      ...[true, true, true, true, true, true, false].map(win => game({ championId: 2, win })),
      ...[false, false, false, false, true].map(win => game({ championId: 3, win })),
      game({ championId: 4, win: true }),
    ]
    expect(bestChampions(games).map(pick => pick.championId)).toEqual([2, 1])
  })
})

describe('bestAllies', () => {
  it('reads the allies of the games whose scoreboard was read', () => {
    const ally = (championId: number) => ({ participantId: 9, championId, teamId: 100, position: null, gameName: null, tagLine: null, win: true, kills: 0, deaths: 0, assists: 0, cs: 0, goldEarned: 0, damageToChampions: 0, visionScore: 0, marks: [] })
    const games = [true, true, true, false, false, false].map((win, index) => game({ win, participants: [ally(index < 3 ? 412 : 89)] }))
    expect(bestAllies(games)).toEqual([{ championId: 412, games: 3, wins: 3, winRate: 1, kda: null }])
  })
})
