import { describe, expect, it } from 'vitest'
import type { MatchDetailResponse } from '#shared/types/match-detail'
import type { FormBenchmarkResponse } from '~/utils/form-benchmark'
import type { PostMatchBenchmark } from '~/utils/post-match'
import { deathTimes, finishedGame, ownAverage, postMatchInsights } from '~/utils/post-match'
import { benchmarkOrder, firstBenchmark, fromBlitzRows, fromTruemainForm } from '~/utils/post-match-benchmark'
import { MINUTE, game } from './fixtures'

const ENDED = 1_790_000_000_000

describe('finishedGame', () => {
  it('finds the newest game that ended around the moment the app saw it end', () => {
    // Filed by its creation: the loading screen comes before the game's clock.
    const latest = game({ gameId: 2, playedAt: ENDED - 33 * MINUTE, durationSeconds: 30 * 60 })
    const earlier = game({ gameId: 1, playedAt: ENDED - 80 * MINUTE })
    expect(finishedGame([latest, earlier], ENDED)?.gameId).toBe(2)
  })

  it('is null while the client\'s history does not have the game yet', () => {
    expect(finishedGame([game({ playedAt: ENDED - 3 * 60 * MINUTE })], ENDED)).toBeNull()
  })
})

describe('ownAverage', () => {
  const finished = game({ gameId: 9, playedAt: 10 * MINUTE * 100 })
  const before = (gameId: number, cs: number, overrides = {}) => game({ gameId, playedAt: gameId, cs, visionScore: 30, deaths: 4, ...overrides })

  it('averages the latest games before this one on the same lane and map, remakes left out', () => {
    const games = [finished, before(5, 240), before(4, 180), before(3, 300, { position: 'TOP' }), before(2, 210, { remake: true }), before(1, 210)]
    const average = ownAverage(games, finished)
    expect(average).toMatchObject({ origin: 'own', tier: null, samples: 3, deaths: 4 })
    expect(average?.csPerMinute).toBeCloseTo((8 + 6 + 7) / 3)
    expect(average?.visionPerMinute).toBeCloseTo(1)
  })

  it('says nothing over fewer than three games', () => {
    expect(ownAverage([finished, before(1, 200), before(2, 200)], finished)).toBeNull()
  })
})

describe('deathTimes', () => {
  const detail = (events: { type: string, ms: number, victimId?: number }[]) =>
    ({ winProbabilityTimeline: { durationMs: 0, participants: [], frames: [], events } }) as unknown as MatchDetailResponse

  it('reads the player\'s deaths off the timeline\'s kills, in minutes', () => {
    const times = deathTimes(detail([
      { type: 'CHAMPION_KILL', ms: 20 * MINUTE, victimId: 3 },
      { type: 'CHAMPION_KILL', ms: 6 * MINUTE, victimId: 3 },
      { type: 'CHAMPION_KILL', ms: 7 * MINUTE, victimId: 4 },
      { type: 'BUILDING_KILL', ms: 8 * MINUTE },
    ]), 3)
    expect(times).toEqual([6, 20])
  })

  it('is unknown, not zero, without a timeline', () => {
    expect(deathTimes(null, 3)).toBeNull()
    expect(deathTimes(detail([]), 3)).toBeNull()
  })
})

describe('postMatchInsights', () => {
  const benchmark: PostMatchBenchmark = { origin: 'truemain', tier: 'EMERALD', samples: 900, csPerMinute: 7, visionPerMinute: 0.66, deaths: 5 }

  it('sets the game against the yardstick, deaths read the other way, small gaps even', () => {
    // Thirty minutes: 6.0 CS, 1.0 vision per minute.
    const insights = postMatchInsights(game({ cs: 180, visionScore: 30, deaths: 7 }), benchmark, [3, 9, 20])
    expect(insights.csPerMinute).toEqual({ value: 6, reference: 7, verdict: 'worse' })
    expect(insights.visionPerMinute.verdict).toBe('better')
    expect(insights.deaths).toEqual({ value: 7, reference: 5, verdict: 'worse' })
    expect(insights.laneDeaths).toBe(2)
    expect(postMatchInsights(game({ cs: 213 }), benchmark, null).csPerMinute.verdict).toBe('even')
  })

  it('keeps the figures without a yardstick', () => {
    const insights = postMatchInsights(game(), null, null)
    expect(insights.csPerMinute).toEqual({ value: 200 / 30, reference: null, verdict: null })
    expect(insights.laneDeaths).toBeNull()
  })
})

describe('the yardstick\'s sources', () => {
  it('asks the picked source when it carries the figures, else Blitz, and TrueMain only when picked', () => {
    expect(benchmarkOrder('truemain')).toEqual(['truemain', 'blitz'])
    expect(benchmarkOrder('blitz')).toEqual(['blitz'])
    for (const picked of ['opgg', 'lolalytics', 'tencent'] as const) expect(benchmarkOrder(picked)).toEqual(['blitz'])
  })

  it('hands over to the next source when one fails or has nothing', async () => {
    const blitz: PostMatchBenchmark = { origin: 'blitz', tier: 'EMERALD', samples: 40, csPerMinute: 7.5, visionPerMinute: null, deaths: null }
    const empty: PostMatchBenchmark = { ...blitz, origin: 'truemain', csPerMinute: null }
    expect(await firstBenchmark(['truemain', 'blitz'], { truemain: () => Promise.reject(new Error('offline')), blitz: async () => blitz })).toBe(blitz)
    expect(await firstBenchmark(['truemain', 'blitz'], { truemain: async () => empty, blitz: async () => blitz })).toBe(blitz)
    expect(await firstBenchmark(['blitz'], { truemain: async () => empty, blitz: async () => null })).toBeNull()
  })

  it('reads TrueMain\'s form benchmark at the player\'s tier', () => {
    const quartiles = (median: number) => ({ p25: median - 1, median, p75: median + 1 })
    const answer: FormBenchmarkResponse = {
      position: 'MIDDLE',
      patches: ['16.22'],
      minSamples: 50,
      tiers: [{ tier: 'EMERALD', samples: 812, kda: null, killParticipation: null, csPerMinute: quartiles(7.2), deaths: quartiles(5.1), visionPerMinute: quartiles(0.7) }],
    }
    expect(fromTruemainForm(answer, 'emerald')).toEqual({ origin: 'truemain', tier: 'EMERALD', samples: 812, csPerMinute: 7.2, visionPerMinute: 0.7, deaths: 5.1 })
    expect(fromTruemainForm(answer, 'GOLD')).toBeNull()
  })

  it('reads Blitz\'s tables: vision and deaths by game length, lane and jungle farm at the last minute', () => {
    const byLength = [{
      tier: 'EMERALD',
      stats_by_game_duration: {
        25: { num_games: 300, stats: { vision_score: { mean: 20 }, deaths: { mean: 4 }, time_played: { mean: 1500 } } },
        30: { num_games: 200, stats: { vision_score: { mean: 30 }, deaths: { mean: 5 }, time_played: { mean: 1800 } } },
      },
    }]
    const byMinute = [{ stats_by_minute: { 31: { creep_score: { mean: 200 }, jungle_creep_score: { mean: 17 } }, 40: { creep_score: { mean: 300 } } } }]
    // A 31:30 game: the 30-minute bucket, the farm at 31:00.
    expect(fromBlitzRows(byLength, byMinute, 31 * 60 + 30, 'EMERALD')).toEqual({
      origin: 'blitz', tier: 'EMERALD', samples: 200, csPerMinute: 7, visionPerMinute: 1, deaths: 5,
    })
    expect(fromBlitzRows([], [], 1800, 'EMERALD')).toBeNull()
  })
})
