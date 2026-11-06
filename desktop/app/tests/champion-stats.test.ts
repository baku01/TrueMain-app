import { describe, expect, it } from 'vitest'
import type { CounterRow } from '~/utils/counters'
import type { SynergyRow } from '~/utils/synergies'
import { counterTables, counterTier, formatPoints } from '~/utils/counters'
import { bySynergy, searchPairs, synergyTier, withEnoughGames } from '~/utils/synergies'
import { masteryRows, visibleMastery } from '~/utils/blitz/mastery'
import { readFirst, standInOrder } from '~/utils/sources/stand-in'

const counter = (championId: number, games: number, score: number | null, laneScore: number | null = null): CounterRow =>
  ({ championId, games, winRate: 0.5 + (score ?? 0), score, laneWinRate: laneScore === null ? null : 0.5 + laneScore, laneScore })

describe('counterTables', () => {
  const rows = [counter(1, 400, 0.03, -0.01), counter(2, 300, -0.02, 0.04), counter(3, 300, 0.01), counter(4, 2, 0.09), counter(5, 100, 0)]

  it('splits the opponents by the sign of the score, strongest first, and drops those under half a percent of the games', () => {
    const { strong, weak } = counterTables(rows, false)
    expect(strong.map(row => row.championId)).toEqual([1, 3])
    expect(weak.map(row => row.championId)).toEqual([2])
  })

  it('ranks by the lane\'s score when laning only, leaving out the rows without one', () => {
    const { strong, weak } = counterTables(rows, true)
    expect(strong.map(row => row.championId)).toEqual([2])
    expect(weak.map(row => row.championId)).toEqual([1])
  })

  it('breaks a tie on the games', () => {
    const { strong } = counterTables([counter(1, 100, 0.02), counter(2, 300, 0.02)], false)
    expect(strong.map(row => row.championId)).toEqual([2, 1])
  })
})

describe('counterTier and formatPoints', () => {
  it('grades a score on Blitz\'s steps', () => {
    expect([0.025, 0.02, 0.015, 0.01, 0, -0.0099, -0.01, -0.019, -0.02, -0.05].map(counterTier)).toEqual(['S', 'S', 'A', 'A', 'B', 'B', 'C', 'C', 'D', 'D'])
  })

  it('writes points with their sign, none on zero', () => {
    expect([0.0234, -0.01, 0.00004, 0].map(formatPoints)).toEqual(['+2.3', '−1.0', '0.0', '0.0'])
  })
})

describe('synergies', () => {
  const pair = (championId: number, allyChampionId: number, tier: string, winRate: number): SynergyRow =>
    ({ championId, allyChampionId, position: 'BOTTOM', allyPosition: 'UTILITY', games: 100, winRate, delta: null, tier })

  it('grades a delta on Blitz\'s steps, and leaves a pair without one ungraded', () => {
    expect([0.02, 0.011, 0.005, 0, -0.005, -0.02].map(synergyTier)).toEqual(['S', 'S', 'A', 'B', 'C', 'D'])
    expect(synergyTier(null)).toBe('')
  })

  it('sorts the best tier first, the higher win rate within a tier, the ungraded last', () => {
    const rows = [pair(1, 2, 'B', 0.55), pair(3, 4, '', 0.6), pair(5, 6, 'S', 0.5), pair(7, 8, 'B', 0.57)]
    expect([...rows].sort(bySynergy).map(row => row.championId)).toEqual([5, 7, 1, 3])
  })

  it('leaves out the allies met in under half a percent of the pairs, however well they did', () => {
    const thin = { ...pair(9, 360, 'S', 1), games: 1 }
    const rows = [{ ...pair(1, 412, 'B', 0.49), games: 4_000 }, { ...pair(1, 117, 'B', 0.5), games: 3_000 }, thin]
    expect(withEnoughGames(rows).map(row => row.allyChampionId)).toEqual([412, 117])
  })

  it('finds a pair by either champion\'s name, accents ignored', () => {
    const names: Record<number, string> = { 1: 'Kai\'Sa', 2: 'Nautilus', 3: 'Jhin', 4: 'Lulu' }
    const rows = [pair(1, 2, 'S', 0.5), pair(3, 4, 'A', 0.5)]
    expect(searchPairs(rows, 'naut', id => names[id]!).map(row => row.championId)).toEqual([1])
    expect(searchPairs(rows, 'JHÍN lulu', id => names[id]!).map(row => row.championId)).toEqual([3])
    expect(searchPairs(rows, '  ', id => names[id]!)).toHaveLength(2)
  })
})

describe('mastery', () => {
  const stats = (levels: Record<string, number>) => Object.fromEntries(Object.entries(levels).map(([level, rate]) => [level, { win_rate: rate, num_games: 100 }]))
  const raw = [
    { champion_id: 1, individual_position: 'TOP', patch: '16.22', win_rate: 0.5, role_pct_games: 0.9, mastery_stats: stats({ 1: 0.48, 5: 0.49, 20: 0.51, 50: 0.53, 100: 0.55 }) },
    { champion_id: 1, individual_position: 'MIDDLE', patch: '16.22', win_rate: 0.5, role_pct_games: 0.05, mastery_stats: stats({ 5: 0.5, 20: 0.5, 50: 0.5, 100: 0.49 }) },
    { champion_id: 2, individual_position: 'BOT', patch: '16.22', win_rate: 0.5, role_pct_games: 0.8, mastery_stats: stats({ 5: 0.5, 20: 0.52 }) },
    { champion_id: 3, individual_position: 'ALL', patch: '16.22', win_rate: 0.5, role_pct_games: 1, mastery_stats: stats({ 5: 0.5, 20: 0.5, 50: 0.5, 100: 0.5 }) },
  ]

  it('reads the four levels and the improvement, leaving out a lane without 50 and 100 and the every-lane row', () => {
    const rows = masteryRows(raw)
    expect(rows.map(row => [row.championId, row.position])).toEqual([[1, 'TOP'], [1, 'MIDDLE']])
    expect(rows[0]!.levels).toEqual([0.49, 0.51, 0.53, 0.55])
    expect(rows[0]!.improvement).toBeCloseTo(0.06)
  })

  it('leaves an off-role out unless it is searched for', () => {
    const rows = masteryRows(raw)
    const names = () => 'Aatrox'
    expect(visibleMastery(rows, null, '', names).map(row => row.position)).toEqual(['TOP'])
    expect(visibleMastery(rows, null, 'aat', names).map(row => row.position)).toEqual(['TOP', 'MIDDLE'])
    expect(visibleMastery(rows, 'MIDDLE', 'aat', names).map(row => row.position)).toEqual(['MIDDLE'])
  })
})

describe('standInOrder', () => {
  const carriers = ['blitz', 'truemain', 'lolalytics', 'opgg'] as const

  it('asks the picked source first when it measures the data, then Blitz, then the others', () => {
    expect(standInOrder('lolalytics', carriers)).toEqual(['lolalytics', 'blitz', 'opgg'])
    expect(standInOrder('blitz', carriers)).toEqual(['blitz', 'lolalytics', 'opgg'])
  })

  it('starts on Blitz when the picked source does not measure it', () => {
    expect(standInOrder('tencent', carriers)).toEqual(['blitz', 'lolalytics', 'opgg'])
    expect(standInOrder('opgg', ['blitz', 'lolalytics'])).toEqual(['blitz', 'lolalytics'])
  })

  it('asks TrueMain only when it is the pick', () => {
    expect(standInOrder('truemain', carriers)).toEqual(['truemain', 'blitz', 'lolalytics', 'opgg'])
    expect(standInOrder('truemain', ['blitz', 'lolalytics'])).toEqual(['blitz', 'lolalytics'])
  })
})

describe('readFirst', () => {
  const empty = (answer: number[]) => !answer.length

  it('keeps the first answer that says something, with its source', async () => {
    const asked: string[] = []
    const answers: Record<string, number[]> = { blitz: [], lolalytics: [1] }
    const read = await readFirst(['blitz', 'lolalytics', 'opgg'], async (source) => {
      asked.push(source)
      return answers[source] ?? [2]
    }, empty)
    expect(read).toEqual({ source: 'lolalytics', answer: [1] })
    expect(asked).toEqual(['blitz', 'lolalytics'])
  })

  it('moves past a failure, and gives back the first empty answer when nothing said anything', async () => {
    const read = await readFirst(['blitz', 'lolalytics'], async (source) => {
      if (source === 'blitz') throw new Error('down')
      return []
    }, empty)
    expect(read).toEqual({ source: 'lolalytics', answer: [] })
  })

  it('throws the last failure when every source failed', async () => {
    await expect(readFirst(['blitz', 'lolalytics'], async (source) => {
      throw new Error(source)
    }, empty)).rejects.toThrow('lolalytics')
  })
})
