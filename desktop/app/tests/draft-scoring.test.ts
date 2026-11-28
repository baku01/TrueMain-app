import { describe, expect, it } from 'vitest'
import type { AllyTable, CandidateInput } from '~/utils/draft-scoring'
import { laneOpponent, sharesOf, solveEnemyLanes } from '~/utils/draft-lanes'
import { SYNERGY_WEIGHT, THIN_MATCHUP_GAMES, scoreCandidate, synergyOf } from '~/utils/draft-scoring'
import { DELTA_SHRINK_GAMES, shrinkDelta, weightedScore, BALANCED } from '~/utils/draft-weights'
import { medianRisk } from '~/utils/draft-risk'

const share = (rows: [number, string, number][]) => sharesOf(rows.map(([championId, position, pickRate]) => ({ championId, position, pickRate })))

describe('the enemy lanes as probabilities', () => {
  it('reads each enemy\'s chance of a lane over every placement, not its raw share', () => {
    // Sylas: mid 60%, top 40%. Jayce: top 90%, mid 10%. Sylas mid with Jayce top is 0.54 of the mass,
    // Sylas top with Jayce mid 0.04, the rest goes to the three other lanes at the floor.
    const shares = share([[1, 'MIDDLE', 0.6], [1, 'TOP', 0.4], [2, 'TOP', 0.9], [2, 'MIDDLE', 0.1]])
    const { lanes, occupancy } = solveEnemyLanes([1, 2], {}, shares)
    expect(lanes.map(lane => lane.position)).toEqual(['MIDDLE', 'TOP'])
    const total = Object.values(occupancy.get(1)!).reduce((sum, chance) => sum + chance, 0)
    expect(total).toBeCloseTo(1)
    // Sylas is more likely mid than its 60% share says: Jayce takes top.
    expect(occupancy.get(1)!.MIDDLE).toBeGreaterThan(0.85)
    expect(lanes[0]!.confidence).toBeCloseTo(occupancy.get(1)!.MIDDLE!)
  })

  it('gives a pinned enemy its lane for certain', () => {
    const shares = share([[1, 'MIDDLE', 1], [2, 'MIDDLE', 1]])
    const solution = solveEnemyLanes([1, 2], { 2: 'MIDDLE' }, shares)
    expect(solution.occupancy.get(2)).toEqual({ MIDDLE: 1 })
    expect(laneOpponent(solution, 'MIDDLE', shares)).toEqual({ championId: 2, confidence: 1 })
  })

  it('takes the most probable enemy on our lane as the opponent, with that chance', () => {
    const shares = share([[1, 'MIDDLE', 0.6], [1, 'TOP', 0.4], [2, 'TOP', 0.9], [2, 'MIDDLE', 0.1]])
    const solution = solveEnemyLanes([1, 2], {}, shares)
    const opponent = laneOpponent(solution, 'TOP', shares)
    expect(opponent?.championId).toBe(2)
    expect(opponent?.confidence).toBeCloseTo(solution.occupancy.get(2)!.TOP!)
    expect(opponent!.confidence).toBeLessThan(1)
  })

  it('never makes an enemy the source does not see on our lane our opponent', () => {
    // A support alone: nearly certain on its lane, and no top laner at all.
    const shares = share([[1, 'UTILITY', 1]])
    const solution = solveEnemyLanes([1], {}, shares)
    expect(laneOpponent(solution, 'TOP', shares)).toBeNull()
    expect(laneOpponent(solution, 'UTILITY', shares)!.confidence).toBeGreaterThan(0.99)
  })

  it('is near certain once five enemies sit on their own lanes', () => {
    const shares = share([[1, 'TOP', 0.95], [1, 'MIDDLE', 0.05], [2, 'JUNGLE', 1], [3, 'MIDDLE', 0.9], [3, 'TOP', 0.1], [4, 'BOTTOM', 1], [5, 'UTILITY', 1]])
    const solution = solveEnemyLanes([1, 2, 3, 4, 5], {}, shares)
    expect(laneOpponent(solution, 'TOP', shares)!.confidence).toBeGreaterThan(0.99)
  })

  it('breaks a tie towards the lanes on screen', () => {
    // Two flex picks, each as likely top as mid: either placement is as good, the previous one stays.
    const shares = share([[1, 'TOP', 0.5], [1, 'MIDDLE', 0.5], [2, 'TOP', 0.5], [2, 'MIDDLE', 0.5]])
    expect(solveEnemyLanes([1, 2], {}, shares).lanes.map(lane => lane.position)).toEqual(['TOP', 'MIDDLE'])
    const kept = solveEnemyLanes([1, 2], {}, shares, { 1: 'MIDDLE', 2: 'TOP' })
    expect(kept.lanes.map(lane => lane.position)).toEqual(['MIDDLE', 'TOP'])
    expect(laneOpponent(kept, 'TOP', shares, { 1: 'MIDDLE', 2: 'TOP' })?.championId).toBe(2)
  })
})

const ally = (championId: number, tentative: boolean, rows: [number, number | null, number][]): AllyTable =>
  ({ championId, tentative, rows: new Map(rows.map(([id, delta, games]) => [id, { delta, games }])) })

describe('the synergy with the allies', () => {
  it('is the mean of the shrunk deltas, a hovered ally at half weight, the games summed', () => {
    const allies = [ally(10, false, [[1, 0.04, 400]]), ally(11, true, [[1, -0.02, 1200]])]
    const synergy = synergyOf(1, allies)
    expect(synergy.delta).toBeCloseTo((1 / 1.5) * 0.02 + (0.5 / 1.5) * -0.015)
    expect(synergy.games).toBe(1600)
    expect(synergy.parts.map(part => [part.reason.championId, part.reason.tentative])).toEqual([[10, false], [11, true]])
  })

  it('counts an ally whose table lacks the pick as no effect, and nothing as unmeasured', () => {
    const one = synergyOf(1, [ally(10, false, [[1, 0.04, 400]])])
    const diluted = synergyOf(1, [ally(10, false, [[1, 0.04, 400]]), ally(11, false, [[7, 0.05, 900]])])
    expect(diluted.delta).toBeCloseTo(one.delta / 2)
    expect(synergyOf(1, [])).toEqual({ delta: 0, games: 0, parts: [] })
  })

  it('reads even in the weights when nothing was measured, and is marked so', () => {
    const base = { winRate: 0.5, games: 10_000, matchupDelta: 0, matchupGames: 0, comfort: null }
    const none = weightedScore({ ...base, synergyDelta: 0, synergyGames: 0 }, BALANCED)
    expect(none.parts.teamFit).toMatchObject({ value: 0.5, measured: false })
    const some = weightedScore({ ...base, synergyDelta: 0.02, synergyGames: 800 }, BALANCED)
    expect(some.parts.teamFit.measured).toBe(true)
    // The delta is already shrunk: +2 points read as such, 0.6 on the 40–60% scale.
    expect(some.parts.teamFit.value).toBeCloseTo(0.6)
  })
})

const input = (fields: Partial<CandidateInput> = {}): CandidateInput => ({
  championId: 1,
  position: 'MIDDLE',
  own: { winRate: 0.52, games: 20_000 },
  average: 0.5,
  opponent: { championId: 9, confidence: 0.5 },
  matchupsRead: true,
  versus: { winRate: 0.45, games: 2_000 },
  allies: [],
  patch: '16.23',
  ...fields,
})

describe('a candidate from the sources', () => {
  it('weighs the matchup by the chance its opponent is ours', () => {
    const half = scoreCandidate(input())
    const sure = scoreCandidate(input({ opponent: { championId: 9, confidence: 1 } }))
    const matchup = shrinkDelta(0.55 - 0.52, 2_000)
    expect(sure.score - half.score).toBeCloseTo(0.5 * matchup)
    expect(half.reasons![0]).toMatchObject({ kind: 'laneMatchup', championId: 9, probability: 0.5 })
  })

  it('leads with the reason that moves the score most, not the largest raw delta', () => {
    // A +6 pts matchup over 40 games barely counts once shrunk; a +2 pts strength over 20,000 games carries it.
    const candidate = scoreCandidate(input({ own: { winRate: 0.52, games: 20_000 }, versus: { winRate: 0.42, games: 40 }, opponent: { championId: 9, confidence: 1 } }))
    expect(candidate.reasons!.map(reason => reason.kind)).toEqual(['laneStrength', 'laneMatchup'])
    expect(candidate.matchupDelta).toBeGreaterThan(candidate.strengthDelta!)
  })

  it('says a synergy with the allies on the board, a hover as one', () => {
    const candidate = scoreCandidate(input({ opponent: null, versus: null, matchupsRead: false, own: { winRate: 0.5, games: 20_000 }, allies: [ally(117, true, [[1, 0.05, 4_000]])] }))
    expect(candidate.reasons![0]).toMatchObject({ kind: 'synergy', championId: 117, tentative: true, delta: 0.05, games: 4_000 })
    expect(candidate.synergyGames).toBe(4_000)
    expect(candidate.score).toBeCloseTo(SYNERGY_WEIGHT * shrinkDelta(0.05, 4_000))
  })

  it('is a thin sample by its matchup games alone, and only once a matchup was read', () => {
    expect(scoreCandidate(input({ versus: { winRate: 0.5, games: THIN_MATCHUP_GAMES - 1 } })).thinSample).toBe(true)
    expect(scoreCandidate(input({ versus: { winRate: 0.5, games: THIN_MATCHUP_GAMES } })).thinSample).toBe(false)
    // Read, but the pick is not in the opponent's matchups: no sample at all.
    expect(scoreCandidate(input({ versus: null })).thinSample).toBe(true)
    // Before the opponent shows, or with its matchups unread, nothing makes it thin — the lane's games are many.
    expect(scoreCandidate(input({ opponent: null, versus: null })).thinSample).toBe(false)
    expect(scoreCandidate(input({ matchupsRead: false, versus: null })).thinSample).toBe(false)
  })
})

describe('the counter category\'s blend', () => {
  const base = { winRate: 0.5, games: 10_000, matchupDelta: 0.06, matchupGames: 1_000_000, synergyDelta: 0, synergyGames: 0, comfort: null }

  it('is c × matchup + (1 − c) × blind, the risk carrying its (1 − c) already', () => {
    const sure = weightedScore({ ...base, matchupConfidence: 1 }, BALANCED)
    const half = weightedScore({ ...base, matchupConfidence: 0.5, counterRisk: 0 }, BALANCED)
    // +6 pts reads 0.8 sure, half of it 0.65.
    expect(sure.parts.counter.value).toBeCloseTo(0.8, 2)
    expect(half.parts.counter.value).toBeCloseTo(0.65, 2)
    // The risk given (already × (1 − c)) comes off once: 0.01 is 0.05 of the category.
    const risky = weightedScore({ ...base, matchupConfidence: 0.5, counterRisk: 0.01 }, BALANCED)
    expect(risky.risk.points).toBeCloseTo(0.05 * BALANCED.counter)
  })

  it('shrinks with the one k the sources\' order uses', () => {
    expect(DELTA_SHRINK_GAMES).toBe(400)
    expect(shrinkDelta(0.04, 400)).toBeCloseTo(0.02)
    expect(shrinkDelta(0.04, 0)).toBe(0)
  })

  it('gives an unread candidate the median risk of the read ones', () => {
    expect(medianRisk([0.01, 0.002, 0.004])).toBeCloseTo(0.004)
    expect(medianRisk([0.01, 0.002])).toBeCloseTo(0.006)
    expect(medianRisk([])).toBe(0)
  })
})
