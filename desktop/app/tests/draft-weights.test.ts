import { describe, expect, it } from 'vitest'
import {
  BALANCED, DEFAULT_SETTINGS, PRESETS, PRESET_KEYS, WEIGHT_KEYS,
  clearsMastery, comfortScore, familiarity, normalized, presetOf, rateScore, rebalanced, settingsOf, shrunkRate, tierScore, weightedScore, winsOverExpected,
} from '~/utils/draft-weights'

const sum = (weights: Record<string, number>) => WEIGHT_KEYS.reduce((total, key) => total + weights[key]!, 0)

describe('suggestion weight presets', () => {
  it('are Blitz\'s own values', () => {
    expect(BALANCED.counter).toBeCloseTo(1.2 / 3.35)
    expect(PRESETS['one-trick']).toEqual({ weights: { meta: 0.1, counter: 0.1, teamFit: 0.05, comfort: 0.75 }, minMastery: 75 })
    expect(PRESETS['meta-follower'].weights.comfort).toBe(0)
    expect(PRESETS['hard-counter'].weights.counter).toBe(0.7)
    expect(PRESETS['lane-bully'].weights).toEqual({ meta: 0.2, counter: 0.55, teamFit: 0.05, comfort: 0.2 })
    expect(PRESETS['team-player'].weights.teamFit).toBe(0.5)
    expect(PRESETS.climber.minMastery).toBe(25)
  })

  it('each total 100%, and each reads back as itself', () => {
    for (const key of PRESET_KEYS) {
      expect(sum(PRESETS[key].weights)).toBeCloseTo(1)
      expect(presetOf(PRESETS[key])).toBe(key)
    }
  })

  it('reads a mix of the player\'s own as no preset, and the default as Balanced', () => {
    expect(presetOf(DEFAULT_SETTINGS)).toBe('balanced')
    expect(presetOf({ weights: BALANCED, minMastery: 50 })).toBeNull()
    expect(presetOf({ weights: { meta: 0.25, counter: 0.25, teamFit: 0.25, comfort: 0.25 }, minMastery: 0 })).toBeNull()
  })
})

describe('the weights', () => {
  it('are shares of their sum, Balanced when unusable', () => {
    expect(normalized({ meta: 2, counter: 1, teamFit: 1, comfort: 0 })).toEqual({ meta: 0.5, counter: 0.25, teamFit: 0.25, comfort: 0 })
    expect(normalized({ meta: 0, counter: 0, teamFit: 0, comfort: 0 })).toEqual(BALANCED)
    expect(normalized({ meta: -1, counter: Number.NaN })).toEqual(normalized({ ...BALANCED, meta: 0 }))
  })

  it('give way to the one moved, in their proportions, still totalling 100%', () => {
    const next = rebalanced({ meta: 0.4, counter: 0.2, teamFit: 0.2, comfort: 0.2 }, 'meta', 0.7)
    expect(next.meta).toBeCloseTo(0.7)
    expect(next.counter).toBeCloseTo(0.1)
    expect(next.teamFit).toBeCloseTo(0.1)
    expect(sum(next)).toBeCloseTo(1)
    // The others all at zero share what is left evenly.
    const even = rebalanced({ meta: 1, counter: 0, teamFit: 0, comfort: 0 }, 'meta', 0.4)
    expect(even.counter).toBeCloseTo(0.2)
    expect(sum(even)).toBeCloseTo(1)
  })

  it('come back from storage usable, whatever it held', () => {
    expect(settingsOf(null)).toEqual({ weights: BALANCED, minMastery: 0 })
    expect(settingsOf({ weights: 'nope', minMastery: 250 })).toEqual({ weights: BALANCED, minMastery: 100 })
    const kept = settingsOf(JSON.parse(JSON.stringify(PRESETS.climber)))
    expect(presetOf(kept)).toBe('climber')
  })
})

describe('the mastery floor', () => {
  it('keeps the champions at the share of the top level asked for', () => {
    expect(clearsMastery(5, 10, 50)).toBe(true)
    expect(clearsMastery(4, 10, 50)).toBe(false)
    expect(clearsMastery(null, 10, 10)).toBe(false)
  })

  it('lets everything through with no floor or no mastery read', () => {
    expect(clearsMastery(0, 10, 0)).toBe(true)
    expect(clearsMastery(undefined, 0, 90)).toBe(true)
  })
})

describe('each category', () => {
  it('pulls a win rate toward even by its games, then places it between 40% and 60%', () => {
    expect(shrunkRate(0.6, 0)).toBe(0.5)
    expect(shrunkRate(0.6, 100)).toBeCloseTo(0.55)
    expect(rateScore(0.55)).toBeCloseTo(0.75)
    expect(rateScore(0.3)).toBe(0)
  })

  it('reads the tier as a step, an unknown one as the lowest', () => {
    expect(tierScore('S')).toBe(1)
    expect(tierScore('A+')).toBe(0.75)
    expect(tierScore('D')).toBe(0)
    expect(tierScore(null)).toBe(0)
  })

  it('reads comfort from mastery, games, recency and wins, and nothing as unknown', () => {
    const now = Date.UTC(2026, 10, 6)
    expect(familiarity({ points: 100_000, games: 20, lastPlayedAt: now, now })).toBeCloseTo(1)
    expect(familiarity({})).toBeNull()
    expect(winsOverExpected({ games: 0 })).toBeNull()
    // 15 wins of 20 against an even lane: (15 + 10) / 40 − 0.5 = +12.5 points, past the +5 that reads 1.
    expect(winsOverExpected({ games: 20, wins: 15, expectedWinRate: 0.5 })).toBe(1)
    expect(comfortScore({})).toBeNull()
    expect(comfortScore({ games: 20, wins: 15, points: 100_000, lastPlayedAt: now, now })).toBeCloseTo(1)
  })
})

describe('a suggestion\'s weighted score', () => {
  const counterPick = { tier: 'C', matchupDelta: 0.06, matchupGames: 900, synergyDelta: 0, synergyGames: 0, comfort: null }
  const metaPick = { tier: 'S', matchupDelta: -0.02, matchupGames: 900, synergyDelta: 0, synergyGames: 0, comfort: null }

  it('is each category times its weight, summed', () => {
    const score = weightedScore(metaPick, BALANCED)
    expect(score.parts.meta.value).toBe(1)
    expect(score.parts.comfort.value).toBe(0.5)
    expect(score.total).toBeCloseTo(WEIGHT_KEYS.reduce((total, key) => total + score.parts[key].points, 0))
  })

  it('orders as the preset asks', () => {
    expect(weightedScore(counterPick, PRESETS['hard-counter'].weights).total).toBeGreaterThan(weightedScore(metaPick, PRESETS['hard-counter'].weights).total)
    expect(weightedScore(metaPick, PRESETS['meta-follower'].weights).total).toBeGreaterThan(weightedScore(counterPick, PRESETS['meta-follower'].weights).total)
  })

  it('reads an unknown opponent as an even matchup', () => {
    expect(weightedScore({ ...counterPick, matchupGames: 0 }, BALANCED).parts.counter.value).toBe(0.5)
  })
})
