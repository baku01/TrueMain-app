import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Provider } from '~/utils/sources'

const synergies = vi.hoisted(() => ({ calls: [] as unknown[][], tables: {} as Record<number, { allyChampionId: number, delta: number | null, games: number }[] | null> }))

vi.mock('~/utils/sources/synergies', () => ({
  readAllySynergies: vi.fn(async (...args: unknown[]) => {
    synergies.calls.push(args)
    return synergies.tables[args[0] as number] ?? null
  }),
}))

const { draftRecommendationFromSource } = await import('~/utils/sources/draft')

const entry = (championId: number, position: string, pickRate: number, winRate = 0.5) => ({ championId, position, games: 10_000, winRate, pickRate, banRate: null })

function provider(entries: ReturnType<typeof entry>[], matchups: { opponentChampionId: number, winRate: number, games: number }[] = []) {
  return {
    tierList: vi.fn(async () => ({ patchVersion: '16.23', tiers: [{ tier: 'A', entries }] })),
    matchups: vi.fn(async () => ({ matchups })),
  } as unknown as Provider & { tierList: ReturnType<typeof vi.fn>, matchups: ReturnType<typeof vi.fn> }
}

const MID = [entry(1, 'MIDDLE', 0.2), entry(2, 'MIDDLE', 0.2), entry(3, 'MIDDLE', 0.2)]

beforeEach(() => {
  synergies.calls.length = 0
  synergies.tables = {}
})

describe('the draft recommendation from a source', () => {
  it('answers no candidate with none — never the lane\'s most picked in their place — and still places the enemies', async () => {
    const source = provider([...MID, entry(9, 'TOP', 1)])
    const answer = await draftRecommendationFromSource(source, { position: 'MIDDLE', enemyChampions: [9], candidates: [] })
    expect(answer.candidates).toEqual([])
    expect(answer.enemyLanes).toMatchObject([{ championId: 9, position: 'TOP' }])
    expect(source.matchups).not.toHaveBeenCalled()
  })

  it('leaves out a champion an ally only hovers', async () => {
    const answer = await draftRecommendationFromSource(provider(MID), { position: 'MIDDLE', enemyChampions: [], candidates: [1, 2, 3], hoveredAllies: { JUNGLE: 2 } })
    expect(answer.candidates.map(candidate => candidate.championId).sort()).toEqual([1, 3])
  })

  it('reads each ally\'s table once for every candidate, and says the synergy', async () => {
    synergies.tables = { 64: [{ allyChampionId: 1, delta: 0.03, games: 2_000 }], 117: null }
    const answer = await draftRecommendationFromSource(provider(MID), {
      position: 'MIDDLE', enemyChampions: [], candidates: [1, 3], allies: { JUNGLE: 64 }, hoveredAllies: { UTILITY: 117 }, eloBracket: 'GOLD_PLUS',
    })
    // The ally's table on our lane: ally, its lane, our lane, the bracket.
    expect(synergies.calls).toEqual([[64, 'JUNGLE', 'MIDDLE', 'GOLD_PLUS'], [117, 'UTILITY', 'MIDDLE', 'GOLD_PLUS']])
    const one = answer.candidates.find(candidate => candidate.championId === 1)!
    // Lulu's table failed: she does not count, so Lee Sin's pairing is the whole mean.
    expect(one.synergyGames).toBe(2_000)
    expect(one.synergyDelta).toBeCloseTo(0.03 * 2_000 / 2_400)
    expect(one.reasons![0]).toMatchObject({ kind: 'synergy', championId: 64, tentative: false })
    expect(answer.candidates.find(candidate => candidate.championId === 3)!.synergyGames).toBe(0)
  })

  it('reports the lane opponent with the chance it plays our lane', async () => {
    const entries = [...MID, entry(9, 'MIDDLE', 0.6), entry(9, 'TOP', 0.4), entry(8, 'TOP', 0.9), entry(8, 'MIDDLE', 0.1)]
    const source = provider(entries, [{ opponentChampionId: 1, winRate: 0.45, games: 3_000 }])
    const answer = await draftRecommendationFromSource(source, { position: 'MIDDLE', enemyChampions: [9, 8], candidates: [1] })
    expect(answer.laneOpponentChampionId).toBe(9)
    expect(answer.laneOpponentConfidence).toBeGreaterThan(0.85)
    expect(answer.laneOpponentConfidence).toBeLessThan(1)
    expect(answer.candidates[0]!.reasons![0]).toMatchObject({ kind: 'laneMatchup', probability: answer.laneOpponentConfidence })
  })
})
