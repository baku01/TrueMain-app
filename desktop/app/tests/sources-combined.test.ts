import { describe, expect, it } from 'vitest'
import type { BuildOptions } from '~/utils/sources/model'
import { SOURCE_SPREAD, combineOptions, combineRows, effectiveGames, poolLists, poolMeasure, sameGames, weightOf } from '~/utils/sources/combined'
import { filterAnswersByPatch, normalizePatch, readPooledDirectoryRows, visibleDirectoryRows } from '~/utils/sources/directory'

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
    expect(weightOf(250000) / weightOf(100000)).toBeLessThan(1.2)
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
    const blitz = options(900, [{ ...m(300, 0.5, 0.6), itemIds: [3118, 4645] }], [{ ...m(100, 0.4), itemIds: [3089] }, { ...m(80, 0.6), itemIds: [3135] }])
    const pooled = combineOptions(lolalytics, blitz)!
    expect(pooled.games).toBe(1000)
    expect(pooled.cores[0]).toMatchObject({ games: 600 })
    expect(pooled.cores[0]!.winRate).toBeCloseTo(pooledRate([600, 0.52], [300, 0.5]))
    const after = pooled.followUps(pooled.cores[0]!)[0]!.options
    expect(after.map(option => [option.itemIds[0], option.games]).sort((a, b) => a[0]! - b[0]!)).toEqual([[3089, 200], [3135, 80]])
  })

  it('pools the items each source measured bought on the lane, whatever their place', () => {
    const lolalytics = { ...options(1000, [], []), situational: [{ ...m(40, 0.5), itemIds: [3156] }] }
    const blitz = { ...options(900, [], []), situational: [{ ...m(60, 0.55), itemIds: [3156] }, { ...m(10, 0.4), itemIds: [3139] }] }
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

  it('leaves out a source that counted another bracket\'s games', () => {
    // Gold+ on lolalytics; Gold alone on a source that pools no Gold+, a third of the games.
    const lolalytics = options(1000, [{ ...m(600, 0.52, 0.6), itemIds: [3118, 4645] }], [])
    const goldOnly = options(320, [{ ...m(200, 0.4, 0.6), itemIds: [3118, 4645] }], [])
    expect(combineOptions(lolalytics, goldOnly)).toBe(lolalytics)
  })
})

describe('sameGames', () => {
  const cells = (entries: [string, number][]) => new Map(entries)

  it('keeps the sources counting the first one\'s games, a subset of them included', () => {
    const lolalytics = cells([['122', 3829], ['86', 2000]])
    const mobalytics = cells([['122', 3825], ['86', 2010]])
    const opgg = cells([['122', 2680]])
    expect(sameGames([lolalytics, mobalytics, opgg], answer => answer)).toEqual([lolalytics, mobalytics, opgg])
  })

  it('leaves out another bracket, either way, and keeps a source it cannot tell', () => {
    const emerald = cells([['122', 3829], ['86', 2000]])
    const everyRank = cells([['122', 19000], ['86', 9500]])
    const goldAlone = cells([['122', 1200], ['86', 640]])
    const elsewhere = cells([['14', 300]])
    expect(sameGames([emerald, everyRank, goldAlone, elsewhere], answer => answer)).toEqual([emerald, elsewhere])
    expect(sameGames([cells([]), emerald], answer => answer)).toEqual([cells([]), emerald])
  })

  it('pools the tier list rows only of sources keeping the bracket', () => {
    const row = (games: number, winRate: number) => ({ championId: 103, position: 'MIDDLE', games, wins: Math.round(games * winRate), winRate, pickRate: 0.1, lanePlayRate: 0.9, banRate: 0, trueMainCount: 0, tier: 'A', tierScore: 10, patchVersion: '16.22', lastUpdatedAtUtc: '', topBuild: null })
    const [ahri] = combineRows([[row(42339, 0.51)], [row(5 * 42339, 0.49)]])
    expect(ahri).toMatchObject({ games: 42339, winRate: 0.51 })
  })
})

describe('sameScale', () => {
  it('pools the pick and ban rates only over the sources measuring them alike: Blitz\'s are half the others\'', () => {
    const row = (games: number, winRate: number, pickRate: number, banRate: number) => ({ championId: 103, position: 'MIDDLE', games, wins: Math.round(games * winRate), winRate, pickRate, lanePlayRate: 0.95, banRate, trueMainCount: 0, tier: 'S', tierScore: 15, patchVersion: '16.22', lastUpdatedAtUtc: '', topBuild: null })
    const [ahri] = combineRows([[row(264372, 0.5128, 0.1148, 0.0365)], [row(244970, 0.5133, 0.0613, 0.0196)]])
    expect(ahri!.pickRate).toBeCloseTo(0.1148)
    expect(ahri!.banRate).toBeCloseTo(0.0365)
    expect(ahri!.winRate).toBeGreaterThan(0.5128)
  })
})

describe('effectiveGames', () => {
  it('is the games for a thin cell and caps at what the sources\' spread leaves for a large one', () => {
    expect(effectiveGames(0.5, 100, 3)).toBeGreaterThan(99)
    expect(effectiveGames(0.5, 260000, 1)).toBeCloseTo(0.25 / (0.25 / 260000 + SOURCE_SPREAD ** 2))
    expect(effectiveGames(0.5, 260000, 3)).toBeGreaterThan(effectiveGames(0.5, 260000, 1))
    expect(effectiveGames(1, 50, 1)).toBeGreaterThan(0)
  })
})

describe('directory & tier list parity', () => {
  const row = (championId: number, position: string, lanePlayRate: number, patchVersion = '16.23', games = 10000) => ({
    championId, position, games, wins: Math.round(games * 0.51), winRate: 0.51, pickRate: 0.08, lanePlayRate,
    trueMainCount: 0, banRate: 0.03, tier: 'A', tierScore: 10, patchVersion, lastUpdatedAtUtc: '', topBuild: null,
  })

  it('applies the exact same visibility filter to both tier list and directory', () => {
    const rows = [
      row(103, 'MIDDLE', 0.95),
      row(103, 'TOP', 0.03),
      row(103, 'JUNGLE', 0.005),
    ]
    // All lanes: dominant lanes only (>= 8%)
    expect(visibleDirectoryRows(rows, null).map(entry => entry.position)).toEqual(['MIDDLE'])
    // Specific lane: secondary lanes >= 2% kept, < 2% off-role noise dropped
    expect(visibleDirectoryRows(rows, 'TOP').map(entry => entry.position)).toEqual(['TOP'])
    expect(visibleDirectoryRows(rows, 'JUNGLE')).toEqual([])
  })

  it('drops sources from another patch when a specific patch is requested', () => {
    const lolaOld = [row(103, 'MIDDLE', 0.95, '16.22', 180000)]
    const blitzLive = [row(103, 'MIDDLE', 0.95, '16.23.1', 210000)]
    expect(normalizePatch('16.23.1')).toBe('16.23')
    const kept = filterAnswersByPatch([lolaOld, blitzLive], '16.22')
    expect(kept).toEqual([lolaOld])
  })

  it('caches pooled rows by (patch, eloBracket) and never forwards position or championId to sources', async () => {
    const queries: Record<string, unknown>[] = []
    const load = async (baseQuery: Record<string, unknown>) => {
      queries.push(baseQuery)
      return [[row(103, 'MIDDLE', 0.95, '16.23', 200000), row(266, 'TOP', 0.9, '16.23', 150000)]]
    }
    const first = await readPooledDirectoryRows({ eloBracket: 'DIAMOND_PLUS', position: 'MIDDLE', championId: 103 }, load)
    const second = await readPooledDirectoryRows({ eloBracket: 'DIAMOND_PLUS', pageSize: 50, sort: 'winRate' }, load)
    expect(queries).toEqual([{ eloBracket: 'DIAMOND_PLUS' }])
    expect(second).toBe(first)
  })
})
