import { describe, expect, it } from 'vitest'
import type { BuildOptions } from '~/utils/sources/model'
import { SOURCE_SPREAD, combineOptions, poolLists, poolMeasure, weightOf } from '~/utils/sources/combined'

const m = (games: number, winRate: number, pickRate = 0) => ({ games, winRate, pickRate })
/** The pooled rate the rule gives: each source's weighed by `weightOf` its games. */
const pooledRate = (...entries: [number, number][]) =>
  entries.reduce((sum, [games, rate]) => sum + weightOf(games) * rate, 0) / entries.reduce((sum, [games]) => sum + weightOf(games), 0)

describe('poolMeasure', () => {
  it('never adds the games: the largest source\'s stand, the rates pooled by weight', () => {
    // Ahri's mid lane on 16.22: one set of games, counted by every source.
    const pooled = poolMeasure([m(262160, 0.51), m(263049, 0.513), m(240148, 0.507), m(244970, 0.512)])
    expect(pooled.games).toBe(263049)
    expect(pooled.winRate).toBeCloseTo(pooledRate([262160, 0.51], [263049, 0.513], [240148, 0.507], [244970, 0.512]))
  })

  it('weighs large samples near-equally and a thin one little', () => {
    // The processing spread caps a large sample's weight; chance swamps a thin one's.
    expect(weightOf(250000) / weightOf(100000)).toBeLessThan(1.1)
    expect(weightOf(30) / weightOf(100000)).toBeLessThan(0.02)
    expect(weightOf(0)).toBe(0)
    expect(1 / weightOf(Number.POSITIVE_INFINITY)).toBeCloseTo(SOURCE_SPREAD ** 2)
  })
})

describe('poolLists', () => {
  it('pools an option over the sources that listed it, keeps one only one listed, most picked first', () => {
    const pooled = poolLists([[{ ...m(100, 0.6, 0.1), itemIds: [1] }], [{ ...m(300, 0.5, 0.2), itemIds: [1] }, { ...m(50, 0.4, 0.3), itemIds: [2] }]], option => option.itemIds.join())
    expect(pooled.map(option => [option.itemIds[0], option.games])).toEqual([[2, 50], [1, 300]])
    expect(pooled[1]!.winRate).toBeCloseTo(pooledRate([100, 0.6], [300, 0.5]))
  })
})

describe('combineOptions', () => {
  const options = (games: number, cores: BuildOptions['cores'], after: BuildOptions['cores']): BuildOptions => ({
    patch: '16.22', games, pages: [], shares: null, spells: [], starters: [], boots: [], cores, skills: [],
    followUps: core => (core ? [{ slot: 4, options: after }] : []),
  })

  it('pools two sources\' cores and the items each measured after the same core, the games never added', () => {
    const lolalytics = options(1000, [{ ...m(600, 0.52, 0.6), itemIds: [3118, 4645] }], [{ ...m(200, 0.55), itemIds: [3089] }])
    const blitz = options(500, [{ ...m(300, 0.5, 0.6), itemIds: [3118, 4645] }], [{ ...m(100, 0.4), itemIds: [3089] }, { ...m(80, 0.6), itemIds: [3135] }])
    const pooled = combineOptions(lolalytics, blitz)!
    expect(pooled.games).toBe(1000)
    expect(pooled.cores[0]).toMatchObject({ games: 600 })
    expect(pooled.cores[0]!.winRate).toBeCloseTo(pooledRate([600, 0.52], [300, 0.5]))
    const after = pooled.followUps(pooled.cores[0]!)[0]!.options
    expect(after.map(option => [option.itemIds[0], option.games]).sort((a, b) => a[0]! - b[0]!)).toEqual([[3089, 200], [3135, 80]])
  })

  it('pools the items each source measured bought on the lane, whatever their place', () => {
    const lolalytics = { ...options(1000, [], []), situational: [{ ...m(40, 0.5), itemIds: [3156] }] }
    const blitz = { ...options(500, [], []), situational: [{ ...m(60, 0.55), itemIds: [3156] }, { ...m(10, 0.4), itemIds: [3139] }] }
    const pooled = combineOptions(lolalytics, blitz)!.situational!
    expect(pooled.find(option => option.itemIds[0] === 3156)).toMatchObject({ games: 60 })
    expect(pooled.find(option => option.itemIds[0] === 3156)!.winRate).toBeCloseTo(pooledRate([40, 0.5], [60, 0.55]))
    expect(pooled.find(option => option.itemIds[0] === 3139)).toMatchObject({ games: 10 })
    expect(combineOptions(options(1, [], []), options(1, [], []))!.situational).toBeUndefined()
  })

  it('keeps either alone when the other measured nothing', () => {
    const only = options(10, [], [])
    expect(combineOptions(only, null)).toBe(only)
    expect(combineOptions(null, only)).toBe(only)
  })
})
