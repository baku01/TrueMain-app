import { afterEach, describe, expect, it, vi } from 'vitest'
import { bracketLift, lowered } from '~/utils/sources/lolalytics'

describe('bracketLift', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is how far the bracket\'s games are won above half of them, over every lane', async () => {
    // Emerald+ as lolalytics counts it: its players' games won more often than lost.
    const list = { tier: { 1: { lane: { middle: { cid: { 103: { wr: 53, games: 600, rank: 1, pctLane: 90, pr: 5, br: 2 } } } } }, 5: { lane: { top: { cid: { 7: { wr: 50, games: 400, rank: 2, pctLane: 80, pr: 3, br: 1 } } } } } } }
    vi.stubGlobal('insideTauri', () => false)
    vi.stubGlobal('$fetch', vi.fn(async () => list))
    expect(await bracketLift('DIAMOND_PLUS')).toBeCloseTo(0.018)
  })

  it('is 0 when the list cannot be read', async () => {
    vi.stubGlobal('insideTauri', () => false)
    vi.stubGlobal('$fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await bracketLift('MASTER_PLUS', 'kr')).toBe(0)
  })

  it('lowers a rate and keeps it one', () => {
    expect(lowered(0.5302, 0.0174)).toBeCloseTo(0.5128)
    expect(lowered(0.01, 0.0174)).toBe(0)
  })
})
