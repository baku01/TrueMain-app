import { describe, expect, it } from 'vitest'
import type { ChampionAnalytics } from '~/utils/sources/analytics'
import { emptyAnalytics } from '~/utils/sources/analytics'
import { combineAnalytics } from '~/utils/sources/analytics-combined'
import { weightOf } from '~/utils/sources/combined'

const header = (games: number, winRate: number, tier: string | null = null): ChampionAnalytics['header'] => ({ games, winRate, pickRate: 0.1, banRate: null, tier, rank: null, rankTotal: null, averageWinRate: null, previous: null })
const page = (fields: Partial<ChampionAnalytics>): ChampionAnalytics => ({ ...emptyAnalytics(), ...fields })

describe('combineAnalytics', () => {
  // Ahri's mid lane, Emerald+: lolalytics (its bracket lift taken off) and Mobalytics over the same games.
  const lolalytics = page({
    patch: '16.22',
    header: header(264372, 0.5128, 'S'),
    matchups: [{ position: 'MIDDLE', rows: [{ championId: 238, winRate: 0.4979, pickRate: 0.042, games: 11229, delta1: 3, delta2: -1.7 }, { championId: 7, winRate: 0.49, pickRate: 0.03, games: 8252 }] }],
    objectives: [{ key: 'dragon', secure: null, conceded: null }],
  })
  const mobalytics = page({
    patch: '16.22',
    header: header(263049, 0.513),
    matchups: [{ position: 'MIDDLE', rows: [{ championId: 238, winRate: 0.5, pickRate: null, games: 11262 }, { championId: 8, winRate: 0.4875, pickRate: null, games: 5735 }] }],
  })

  it('pools the header: the games the largest source\'s, the win rate by weight, the grade the source\'s that gives one', () => {
    const merged = combineAnalytics([lolalytics, mobalytics])
    expect(merged.header).toMatchObject({ games: 264372, tier: 'S' })
    expect(merged.header!.winRate).toBeCloseTo((0.5128 * weightOf(264372) + 0.513 * weightOf(263049)) / (weightOf(264372) + weightOf(263049)))
  })

  it('pools the matchups opponent by opponent, keeps lolalytics\' deltas, and an opponent only one source met', () => {
    const rows = combineAnalytics([lolalytics, mobalytics]).matchups[0]!.rows
    const zed = rows.find(row => row.championId === 238)!
    expect(zed).toMatchObject({ games: 11262, pickRate: 0.042, delta1: 3, delta2: -1.7 })
    expect(zed.winRate).toBeGreaterThan(0.4979)
    expect(zed.winRate).toBeLessThan(0.5)
    expect(rows.map(row => row.championId).sort((a, b) => a - b)).toEqual([7, 8, 238])
  })

  it('keeps what only one source measures as that source\'s', () => {
    expect(combineAnalytics([lolalytics, mobalytics]).objectives).toEqual(lolalytics.objectives)
  })

  it('leaves out a source counting another bracket\'s games', () => {
    const goldAlone = page({ header: header(80000, 0.47), matchups: [{ position: 'MIDDLE', rows: [{ championId: 238, winRate: 0.4, pickRate: null, games: 3500 }] }] })
    const merged = combineAnalytics([lolalytics, goldAlone])
    expect(merged.header).toMatchObject({ games: 264372, winRate: 0.5128 })
    expect(merged.matchups[0]!.rows.find(row => row.championId === 238)!.winRate).toBeCloseTo(0.4979)
  })

  it('against an opponent, pools only the sources that read the matchup; the first lane\'s figures when none did', () => {
    const versus = page({ versus: 238, header: header(11229, 0.4979) })
    const blitz = page({ versus: 238, header: header(11617, 0.4932) })
    expect(combineAnalytics([versus, mobalytics, blitz], 238).header!.games).toBe(11617)
    expect(combineAnalytics([mobalytics], 238)).toBe(mobalytics)
  })
})
