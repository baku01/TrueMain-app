import { describe, expect, it } from 'vitest'
import type { PlayerGame } from '~/types/record'
import { analyse } from '~/utils/nerd-stats/analysis'
import { buildCoachReport } from '~/utils/nerd-stats/coach'
import { gameRows } from '~/utils/nerd-stats/features'

function fakeGame(index: number, win: boolean, overrides: Partial<PlayerGame> = {}): PlayerGame {
  const baseTime = Date.UTC(2026, 0, 1) + index * 25 * 60 * 1000
  return {
    gameId: 1000 + index,
    queueId: 420,
    championId: win ? 103 : 238,
    position: win ? 'MIDDLE' : 'TOP',
    win,
    kills: win ? 9 : 2,
    deaths: win ? 2 : 8,
    assists: win ? 8 : 3,
    cs: win ? 220 : 140,
    goldEarned: win ? 13500 : 9200,
    damageToChampions: win ? 28000 : 14000,
    visionScore: win ? 28 : 12,
    durationSeconds: win ? 22 * 60 : 38 * 60,
    playedAt: baseTime,
    participants: [],
    items: [],
    spells: [4, 14],
    ...overrides,
  } as PlayerGame
}

describe('buildCoachReport', () => {
  it('surfaces top actionable levers, champion pool, lane, and pace in plain terms', () => {
    const games: PlayerGame[] = []
    for (let i = 0; i < 24; i++) {
      games.push(fakeGame(i, i % 2 === 0))
    }
    const report = analyse(gameRows(games, []))
    const coach = buildCoachReport(report)

    expect(coach.levers.length).toBeGreaterThan(0)
    expect(coach.levers.length).toBeLessThanOrEqual(3)
    expect(coach.levers[0]!.gap).toBeGreaterThan(0.2)
    expect(coach.champions.climb.some(c => c.key === '103')).toBe(true)
    expect(coach.champions.avoid.some(c => c.key === '238')).toBe(true)
    expect(coach.positions?.best.key).toBe('MIDDLE')
    expect(coach.positions?.worst?.key).toBe('TOP')
    expect(coach.pace?.kind).toBe('early')
  })
})
