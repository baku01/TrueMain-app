import { describe, expect, it } from 'vitest'
import type { CounterRow } from '~/utils/counters'
import type { BlitzMasteryRow } from '~/utils/blitz/mastery'
import { counterRisk, laneOdds, riskLevel, unknownOpponent } from '~/utils/draft-risk'
import { experienceShifts, shiftOf } from '~/utils/draft-experience'

const matchup = (championId: number, score: number | null, games: number): CounterRow => ({ championId, games, winRate: 0.5, score, laneWinRate: null, laneScore: null })

describe('the counter-pick risk', () => {
  it('reads the lane\'s odds from its pick rates, over the champions still available', () => {
    const odds = laneOdds([{ championId: 1, pickRate: 0.1 }, { championId: 2, pickRate: 0.3 }, { championId: 3, pickRate: 0.6 }, { championId: 4, pickRate: 0 }], new Set([3]))
    expect([...odds.keys()]).toEqual([1, 2])
    expect(odds.get(1)).toBeCloseTo(0.25)
    expect(odds.get(2)).toBeCloseTo(0.75)
    expect(laneOdds([{ championId: 1, pickRate: 0.1 }], new Set([1])).size).toBe(0)
  })

  it('counts while the lane opponent is still to come, by the doubt of where it was placed', () => {
    expect(unknownOpponent(1, null)).toBe(1)
    expect(unknownOpponent(2, { confidence: 0.6, pinned: false })).toBeCloseTo(0.4)
    expect(unknownOpponent(2, { confidence: 0.6, pinned: true })).toBe(0)
    expect(unknownOpponent(5, null)).toBe(0)
  })

  it('is the harm of each likely counter by its chance, the candidate itself no opponent', () => {
    const odds = new Map([[1, 0.2], [2, 0.4], [3, 0.4]])
    const rows = [matchup(2, -0.05, 1_000_000), matchup(3, 0.03, 1_000_000)]
    // Without the candidate, 2 and 3 are even odds: half of a five-point loss; the win is no comfort.
    expect(counterRisk(1, odds, rows, 1)).toBeCloseTo(0.025, 4)
    expect(counterRisk(1, odds, rows, 0.5)).toBeCloseTo(0.0125, 4)
    expect(counterRisk(1, odds, rows, 0)).toBe(0)
  })

  it('pulls a thin matchup toward even, and reads one with no score or no row as even', () => {
    const odds = new Map([[2, 0.5], [3, 0.5]])
    expect(counterRisk(1, odds, [matchup(2, -0.05, 100)], 1)).toBeCloseTo(0.0125, 4)
    expect(counterRisk(1, odds, [matchup(2, null, 5000)], 1)).toBe(0)
    expect(counterRisk(1, new Map(), [], 1)).toBe(0)
  })

  it('is worded none, medium, high or extreme on Blitz\'s matchup steps, as the figure reads', () => {
    expect(riskLevel(0)).toBe('none')
    expect(riskLevel(0.0004)).toBe('none')
    expect(riskLevel(0.005)).toBe('medium')
    // Read as shown: 0.98 points reads −1.0, so it is high.
    expect(riskLevel(0.0098)).toBe('high')
    expect(riskLevel(0.0094)).toBe('medium')
    expect(riskLevel(0.012)).toBe('high')
    expect(riskLevel(0.03)).toBe('extreme')
    expect(riskLevel(Number.NaN)).toBe('none')
  })
})

const row = (championId: number, position: string, brackets: Record<string, [number, number]>): BlitzMasteryRow => ({
  champion_id: championId,
  individual_position: position,
  patch: '16.22',
  win_rate: 0.5,
  role_pct_games: 1,
  mastery_stats: Object.fromEntries(Object.entries(brackets).map(([level, [games, rate]]) => [level, { num_games: games, win_rate: rate }])),
})

describe('the experience shift', () => {
  // Both win 47.5% under mastery 20 and 55% from it; the one-trick's players are mostly past it.
  const oneTrick = row(1, 'MIDDLE', { 1: [1000, 0.52], 20: [600, 0.55] })
  const newcomer = row(2, 'MIDDLE', { 1: [1000, 0.49], 20: [200, 0.55] })

  it('reads every champion at the lane\'s experience mix', () => {
    const shifts = experienceShifts([oneTrick, newcomer])
    // The lane: 1,200 of its 2,000 games under 20, so 60% × 47.5% + 40% × 55% = 50.5% for both.
    expect(shiftOf(shifts, 1, 'MIDDLE')).toBeCloseTo(-0.015, 6)
    expect(shiftOf(shifts, 2, 'MIDDLE')).toBeCloseTo(0.015, 6)
  })

  it('folds a bracket a champion lacks into the one below, and leaves out one it cannot split', () => {
    const thin = row(3, 'MIDDLE', { 1: [1000, 0.5] })
    const coarse = row(4, 'MIDDLE', { 1: [2000, 0.5], 50: [500, 0.6] })
    const shifts = experienceShifts([oneTrick, newcomer, thin, coarse, { ...oneTrick, individual_position: 'ALL' }])
    expect(shiftOf(shifts, 3, 'MIDDLE')).toBe(0)
    expect('3:MIDDLE' in shifts).toBe(false)
    expect(Object.keys(shifts).some(key => key.endsWith(':ALL'))).toBe(false)
    // The lane: 5,000 games from 1, 500 from 50 — 10% at 60%, 90% at (1000 − 300) / 1500.
    expect(shiftOf(shifts, 4, 'MIDDLE')).toBeCloseTo(0.9 * (700 / 1500) + 0.1 * 0.6 - 0.5, 6)
  })

  it('names the lane as TrueMain does', () => {
    expect(shiftOf(experienceShifts([{ ...oneTrick, individual_position: 'SUPPORT' }, { ...newcomer, individual_position: 'SUPPORT' }]), 1, 'UTILITY')).toBeCloseTo(-0.015, 6)
  })
})
