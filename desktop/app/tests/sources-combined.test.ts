import { describe, expect, it } from 'vitest'
import type { ChampionMatchupEntry } from '#shared/types/champions/matchups'
import type { BuildOptions } from '~/utils/sources/model'
import { combineMatchups, combineOptions, combineTierLists, poolMeasures } from '~/utils/sources/combined'

const m = (games: number, winRate: number) => ({ games, winRate, pickRate: 0 })

describe('poolMeasures', () => {
  it('adds up the games and the wins of the same option and reads the rate again over the whole', () => {
    const pooled = poolMeasures([[{ ...m(100, 0.6), itemIds: [1] }], [{ ...m(300, 0.5), itemIds: [1] }, { ...m(50, 0.4), itemIds: [2] }]], option => option.itemIds.join(), 450)
    expect(pooled[0]).toMatchObject({ itemIds: [1], games: 400, winRate: 0.525 })
    expect(pooled[0]!.pickRate).toBeCloseTo(400 / 450)
    expect(pooled[1]).toMatchObject({ itemIds: [2], games: 50, winRate: 0.4 })
  })
})

describe('combineOptions', () => {
  const options = (games: number, cores: BuildOptions['cores'], after: BuildOptions['cores']): BuildOptions => ({
    patch: '16.22', games, pages: [], shares: null, spells: [], starters: [], boots: [], cores, skills: [],
    followUps: core => (core ? [{ slot: 4, options: after }] : []),
  })

  it('pools two sources\' cores and the items each measured after the same core', () => {
    const lolalytics = options(1000, [{ ...m(600, 0.52), itemIds: [3118, 4645] }], [{ ...m(200, 0.55), itemIds: [3089] }])
    const blitz = options(500, [{ ...m(300, 0.5), itemIds: [3118, 4645] }], [{ ...m(100, 0.4), itemIds: [3089] }, { ...m(80, 0.6), itemIds: [3135] }])
    const pooled = combineOptions(lolalytics, blitz)!
    expect(pooled.games).toBe(1500)
    expect(pooled.cores[0]).toMatchObject({ games: 900 })
    expect(pooled.cores[0]!.winRate).toBeCloseTo((600 * 0.52 + 300 * 0.5) / 900)
    const after = pooled.followUps(pooled.cores[0]!)[0]!.options
    expect(after.map(option => [option.itemIds[0], option.games])).toEqual([[3089, 300], [3135, 80]])
  })

  it('keeps either alone when the other measured nothing', () => {
    const only = options(10, [], [])
    expect(combineOptions(only, null)).toBe(only)
    expect(combineOptions(null, only)).toBe(only)
  })
})

describe('combineMatchups', () => {
  const entry = (opponentChampionId: number, games: number, wins: number) =>
    ({ opponentChampionId, games, wins, winRate: wins / games, playRate: 0, winRateLowerBound: 0, winRateUpperBound: 1, laneWinRate: null, decidedLaneGames: 0, averageGoldDiffAt15: null, goldDiffLaneGames: 0, averageXpDiffAt15: null, xpDiffLaneGames: 0 }) as ChampionMatchupEntry

  it('pools each opponent\'s games and wins and bounds the pooled rate again', () => {
    const pooled = combineMatchups(
      { championId: 1, position: 'MIDDLE', patch: null, matchups: [entry(7, 100, 60)] },
      { championId: 1, position: 'MIDDLE', patch: null, matchups: [entry(7, 100, 40), entry(8, 50, 25)] },
    )
    expect(pooled.matchups[0]).toMatchObject({ opponentChampionId: 7, games: 200, wins: 100, winRate: 0.5 })
    expect(pooled.matchups[0]!.winRateLowerBound).toBeGreaterThan(0.43)
    expect(pooled.matchups[1]).toMatchObject({ opponentChampionId: 8, games: 50 })
  })
})

describe('combineTierLists', () => {
  it('pools each champion\'s lane line in the first source\'s tiers, and seats a line only the second has', () => {
    const line = (championId: number, games: number, winRate: number) => ({ championId, position: 'TOP', games, winRate, pickRate: 0.05, banRate: null })
    const pooled = combineTierLists(
      { patchVersion: '16.22', position: null, tiers: [{ tier: 'S', entries: [line(1, 1000, 0.54)] }, { tier: 'C', entries: [line(2, 1000, 0.46)] }] },
      { patchVersion: '16.22', position: null, tiers: [{ tier: 'A', entries: [line(1, 1000, 0.52), line(3, 200, 0.465)] }] },
    )
    expect(pooled.tiers[0]!.entries[0]).toMatchObject({ championId: 1, games: 2000, winRate: 0.53 })
    expect(pooled.tiers[1]!.entries.map(entry => entry.championId)).toEqual([3, 2])
  })
})
