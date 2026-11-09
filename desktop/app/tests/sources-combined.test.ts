import { describe, expect, it } from 'vitest'
import type { BuildOptions } from '~/utils/sources/model'
import { combineOptions, poolMeasures } from '~/utils/sources/combined'

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

  it('pools the items each source measured bought on the lane, whatever their place', () => {
    const lolalytics = { ...options(1000, [], []), situational: [{ ...m(40, 0.5), itemIds: [3156] }] }
    const blitz = { ...options(500, [], []), situational: [{ ...m(60, 0.55), itemIds: [3156] }, { ...m(10, 0.4), itemIds: [3139] }] }
    const pooled = combineOptions(lolalytics, blitz)!.situational!
    expect(pooled.map(option => [option.itemIds[0], option.games])).toEqual([[3156, 100], [3139, 10]])
    expect(pooled[0]!.winRate).toBeCloseTo(0.53)
    expect(combineOptions(options(1, [], []), options(1, [], []))!.situational).toBeUndefined()
  })

  it('keeps either alone when the other measured nothing', () => {
    const only = options(10, [], [])
    expect(combineOptions(only, null)).toBe(only)
    expect(combineOptions(null, only)).toBe(only)
  })
})
