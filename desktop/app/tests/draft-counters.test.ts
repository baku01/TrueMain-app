import { describe, expect, it } from 'vitest'
import type { ChampionMatchupEntry } from '#shared/types/champions/matchups'
import { enemyCounters } from '~/utils/draft-counters'

function row(opponentChampionId: number, games: number, winRate: number, winRateUpperBound: number): ChampionMatchupEntry {
  return {
    opponentChampionId, games, wins: Math.round(games * winRate), winRate, playRate: 0,
    winRateLowerBound: 0, winRateUpperBound,
    laneWinRate: null, decidedLaneGames: 0, averageGoldDiffAt15: null, goldDiffLaneGames: 0, averageXpDiffAt15: null, xpDiffLaneGames: 0,
  }
}

describe('enemyCounters', () => {
  it('ranks the champions the enemy loses to by its ceiling, the other side of each row', () => {
    const matchups = [row(1, 800, 0.46, 0.49), row(2, 60, 0.38, 0.51), row(3, 2000, 0.47, 0.48), row(4, 500, 0.55, 0.58)]
    expect(enemyCounters(matchups, new Set())).toEqual([
      { championId: 3, winRate: 0.53, games: 2000 },
      { championId: 1, winRate: 0.54, games: 800 },
      { championId: 2, winRate: 0.62, games: 60 },
    ])
  })

  it('drops thin samples and champions no longer pickable', () => {
    const matchups = [row(1, 10, 0.2, 0.4), row(2, 900, 0.45, 0.48), row(3, 900, 0.44, 0.47)]
    expect(enemyCounters(matchups, new Set([3])).map(c => c.championId)).toEqual([2])
  })
})
