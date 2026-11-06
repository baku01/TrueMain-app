import { describe, expect, it } from 'vitest'
import type { ChampionBuildResponse } from '~/types/build'
import { winRate } from '~/utils/high-elo'
import { statsFromSite } from '~/utils/site-build'

const build = (games: number, rate: number) => ({ games, winRate: rate, primaryKeystoneId: 8010, core: {} })

describe('statsFromSite', () => {
  it('reads the lane win rate from its listed builds, not against every game of the lane', () => {
    // Blitz lists a lane's top builds only: 4,000 of its 10,000 games.
    const lane = { totalGames: 10_000, patch: '16.22', builds: [build(3_000, 0.54), build(1_000, 0.5)] } as unknown as ChampionBuildResponse
    const stats = statsFromSite(64, { JUNGLE: lane }, 'JUNGLE')
    expect(stats.games).toBe(10_000)
    expect(winRate(stats)).toBeCloseTo(0.53, 3)
  })

  it('has no wins when the lane lists no build', () => {
    const lane = { totalGames: 500, patch: '16.22', builds: [] } as unknown as ChampionBuildResponse
    expect(statsFromSite(64, { JUNGLE: lane }, 'JUNGLE').wins).toBe(0)
  })
})
