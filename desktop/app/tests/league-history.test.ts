import { describe, expect, it } from 'vitest'
import type { BlitzLeagueRow } from '~/utils/league-history'
import { leagueSnapshots, seasonStarts, sinceDays } from '~/utils/league-history'
import { DAY } from './fixtures'

const T = Date.UTC(2026, 0, 7) / 1000
const row = (days: number, tier: string, rank: string, lp: number, wins: number, losses: number): BlitzLeagueRow =>
  ({ tier, rank, league_points: lp, wins, losses, timestamp: T + days * 86_400 })

describe('leagueSnapshots', () => {
  it('reads Blitz\'s rows oldest first, dropping a row that repeats the one before it', () => {
    const rows = [
      row(3, 'DIAMOND', 'III', 31, 9, 11),
      row(2, 'DIAMOND', 'IV', 50, 6, 10),
      row(2.5, 'DIAMOND', 'IV', 50, 6, 10),
      row(0, 'GRANDMASTER', 'I', 666, 741, 721),
    ]
    const snapshots = leagueSnapshots(rows)
    expect(snapshots.map(entry => [entry.tier, entry.division, entry.leaguePoints])).toEqual([
      ['GRANDMASTER', 'I', 666],
      ['DIAMOND', 'IV', 50],
      ['DIAMOND', 'III', 31],
    ])
    expect(snapshots[0]!.capturedAtUtc).toBe('2026-01-07T00:00:00.000Z')
    expect(snapshots[1]).toMatchObject({ wins: 6, losses: 10 })
  })

  it('keeps a standing that moved without a game (apex decay), and drops unranked rows', () => {
    const snapshots = leagueSnapshots([
      row(0, 'MASTER', '', 120, 40, 30),
      row(1, 'MASTER', '', 45, 40, 30),
      row(2, 'NONE', '', 0, 0, 0),
    ])
    expect(snapshots.map(entry => entry.leaguePoints)).toEqual([120, 45])
    expect(snapshots[0]!.division).toBe('I')
  })
})

describe('seasonStarts', () => {
  it('marks the first snapshot whose games played fell — Riot\'s reset — named by its year', () => {
    const snapshots = leagueSnapshots([
      row(-30, 'GRANDMASTER', 'I', 600, 700, 700),
      row(0, 'GRANDMASTER', 'I', 666, 741, 721),
      row(2, 'DIAMOND', 'IV', 50, 6, 10),
      row(3, 'DIAMOND', 'III', 31, 9, 11),
    ])
    expect(seasonStarts(snapshots)).toEqual([{ index: 2, year: 2026 }])
  })

  it('marks nothing within one season, nor without records', () => {
    expect(seasonStarts(leagueSnapshots([row(0, 'GOLD', 'I', 10, 5, 5), row(1, 'GOLD', 'I', 30, 6, 5)]))).toEqual([])
    expect(seasonStarts([
      { capturedAtUtc: '2026-01-01T00:00:00Z', tier: 'GOLD', division: 'I', leaguePoints: 10 },
      { capturedAtUtc: '2026-01-02T00:00:00Z', tier: 'GOLD', division: 'I', leaguePoints: 30 },
    ])).toEqual([])
  })
})

describe('sinceDays', () => {
  it('keeps the snapshots of the window', () => {
    const now = Date.UTC(2026, 10, 6)
    const at = (days: number) => ({ capturedAtUtc: new Date(now - days * DAY).toISOString(), tier: 'GOLD', division: 'I', leaguePoints: days })
    expect(sinceDays([at(120), at(89), at(1)], 90, now).map(entry => entry.leaguePoints)).toEqual([89, 1])
  })
})
