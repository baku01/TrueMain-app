import { describe, expect, it } from 'vitest'
import type { ChampionMatchupEntry } from '#shared/types/champions/matchups'
import { combineMatchups, weightOf } from '~/utils/sources/combined'
import { enemyCounters } from '~/utils/draft-counters'

const row = (opponentChampionId: number, games: number, wins: number, playRate: number, bounds: [number, number] = [0, 1]): ChampionMatchupEntry => ({
  opponentChampionId, games, wins, winRate: wins / games, playRate, winRateLowerBound: bounds[0], winRateUpperBound: bounds[1],
  laneWinRate: null, decidedLaneGames: 0, averageGoldDiffAt15: null, goldDiffLaneGames: 0, averageXpDiffAt15: null, xpDiffLaneGames: 0,
})

describe('combineMatchups', () => {
  it('pools lolalytics and Blitz opponent by opponent: the rates by weight, the games the largest source\'s', () => {
    // Malphite on top: lolalytics and Blitz both measure Darius (the same games); Garen only lolalytics, Sion only Blitz.
    const lolalytics = { championId: 54, position: 'TOP', patch: '16.22', matchups: [row(122, 800, 360, 0.05), row(86, 300, 170, 0.03)] }
    const blitz = { championId: 54, position: 'TOP', patch: '16.22', matchups: [row(122, 200, 90, 0.07, [0.38, 0.52]), row(14, 120, 50, 0.02, [0.33, 0.5])] }
    const pooled = combineMatchups(54, 'TOP', [lolalytics, blitz])
    const darius = pooled.matchups.find(entry => entry.opponentChampionId === 122)!
    expect(darius).toMatchObject({ games: 800, wins: 360, winRate: 0.45 })
    expect(darius.playRate).toBeCloseTo((0.05 * weightOf(800) + 0.07 * weightOf(200)) / (weightOf(800) + weightOf(200)))
    expect(darius.winRateUpperBound).toBeGreaterThan(0.45)
    expect(darius.winRateUpperBound).toBeLessThan(0.49)
    expect(pooled.matchups.map(entry => entry.opponentChampionId).sort((a, b) => a - b)).toEqual([14, 86, 122])
    // The counters of Malphite: who beats it, Darius first, Garen (who loses to it) left out.
    expect(enemyCounters(pooled.matchups, new Set()).map(counter => counter.championId)).toEqual([122, 14])
  })

  it('reads either source alone where the other measured none', () => {
    const blitz = { championId: 54, position: 'TOP', patch: null, matchups: [row(122, 200, 90, 0.07)] }
    expect(combineMatchups(54, 'TOP', [null, blitz]).matchups).toHaveLength(1)
    expect(combineMatchups(54, 'TOP', [null, null]).matchups).toEqual([])
  })
})
