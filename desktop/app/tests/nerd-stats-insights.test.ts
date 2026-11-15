import { describe, expect, it } from 'vitest'
import type { CellRate, MetricAssociation, ModelReport } from '~/utils/nerd-stats/analysis'
import { analyse } from '~/utils/nerd-stats/analysis'
import { DEFINITION_BY_KEY, filterRows, gameRows } from '~/utils/nerd-stats/features'
import { formulaWeights, modelGrade, naturalUnit, niceStep } from '~/utils/nerd-stats/formula-insights'
import { confidenceOf, contrast, dayParts, groupConfidence, metricSplit, overviewVerdict, sittingContrast, streakReading } from '~/utils/nerd-stats/insights'
import { sigmoid } from '~/utils/nerd-stats/logistic'
import { quantileBins } from '~/utils/nerd-stats/stats'
import { syntheticHistory } from '~/fixtures/synthetic-history'
import { game } from './fixtures'

function association(key: 'goldDiff15' | 'firstBlood' | 'csPerMin', winValues: number[], lossValues: number[], q = 0.03): MetricAssociation {
  const values = [...winValues, ...lossValues]
  return {
    definition: DEFINITION_BY_KEY.get(key)!,
    games: values.length,
    winValues,
    lossValues,
    effect: null,
    correlation: { r: 0.3, p: q / 2, low: 0.1, high: 0.5 },
    q,
    bins: quantileBins(values, values.map((_, i) => i < winValues.length), 3),
    mean: 0,
    sd: 1,
    p5: 0,
    p95: 0,
  } as MetricAssociation
}

describe('confidence in words', () => {
  it('reads a p- or q-value on four steps', () => {
    expect(confidenceOf(0.004)).toBe('strong')
    expect(confidenceOf(0.03)).toBe('moderate')
    expect(confidenceOf(0.12)).toBe('weak')
    expect(confidenceOf(0.5)).toBe('uncertain')
    expect(confidenceOf(null)).toBe('uncertain')
    expect(confidenceOf(Number.NaN)).toBe('uncertain')
  })
})

describe('a metric split for a sentence', () => {
  it('splits a lead at zero: ahead against behind, ties left out', () => {
    const split = metricSplit(association('goldDiff15', [500, 300, -100, 200, 0], [-400, -200, 100, -50, 0]))!
    expect(split.kind).toBe('sign')
    expect(split.high).toMatchObject({ games: 4, wins: 3, rate: 0.75, from: 100, to: 500 })
    expect(split.low).toMatchObject({ games: 4, wins: 1, rate: 0.25, from: -400, to: -50 })
    expect(split.difference).toBeCloseTo(0.5)
    expect(split.confidence).toBe('moderate')
  })

  it('splits a yes/no metric into yes and no', () => {
    const split = metricSplit(association('firstBlood', [1, 1, 1, 0, 0], [1, 0, 0, 0, 0], 0.5))!
    expect(split.kind).toBe('binary')
    expect(split.high.rate).toBeCloseTo(3 / 4)
    expect(split.low.rate).toBeCloseTo(2 / 6)
    expect(split.confidence).toBe('uncertain')
  })

  it('compares a rate\'s top bin with its bottom one, and gives up without games enough', () => {
    const split = metricSplit(association('csPerMin', [8, 8.5, 9, 7.5, 7], [5, 5.5, 6, 6.5, 7.2]))!
    expect(split.kind).toBe('bins')
    expect(split.high.rate).toBeGreaterThan(split.low.rate)
    expect(split.high.from).toBeGreaterThanOrEqual(split.low.to)
    expect(metricSplit(association('csPerMin', [8], [5]))).toBeNull()
  })
})

describe('contrasts', () => {
  it('says whether the win rate is above, below or not told apart from a coin flip', () => {
    expect(overviewVerdict({ low: 0.52, high: 0.6, pVersusHalf: 0.004 } as never)).toEqual({ verdict: 'above', confidence: 'strong' })
    expect(overviewVerdict({ low: 0.4, high: 0.55, pVersusHalf: 0.6 } as never)).toEqual({ verdict: 'even', confidence: 'uncertain' })
    expect(overviewVerdict({ low: 0.3, high: 0.45, pVersusHalf: 0.03 } as never).verdict).toBe('below')
  })

  it('picks the best and worst cells with games enough, and tests the gap', () => {
    const read = contrast([{ id: 'a', games: 40, wins: 30 }, { id: 'b', games: 3, wins: 0 }, { id: 'c', games: 40, wins: 12 }, { id: 'd', games: 20, wins: 10 }])!
    expect(read.best.id).toBe('a')
    expect(read.worst.id).toBe('c')
    expect(read.difference).toBeCloseTo(0.45)
    expect(read.confidence).toBe('strong')
    expect(contrast([{ games: 4, wins: 4 }, { games: 30, wins: 10 }])).toBeNull()
  })

  it('pools the hours into four parts of the day', () => {
    const hours: CellRate[] = Array.from({ length: 24 }, (_, key) => ({ key, games: key < 6 ? 2 : 1, wins: key < 6 ? 0 : 1, rate: 0, shrunk: null }))
    expect(dayParts(hours)).toEqual([
      { key: 'night', games: 12, wins: 0 },
      { key: 'morning', games: 6, wins: 6 },
      { key: 'afternoon', games: 6, wins: 6 },
      { key: 'evening', games: 6, wins: 6 },
    ])
  })

  it('reads the first game of a sitting against the latest place with games enough', () => {
    const sessions = [
      { position: 1, games: 30, wins: 20, rate: 2 / 3, low: 0, high: 1 },
      { position: 2, games: 20, wins: 10, rate: 0.5, low: 0, high: 1 },
      { position: 3, games: 10, wins: 3, rate: 0.3, low: 0, high: 1 },
      { position: 4, games: 2, wins: 0, rate: 0, low: 0, high: 1 },
    ]
    const read = sittingContrast(sessions)!
    expect(read.late.position).toBe(3)
    expect(read.difference).toBeCloseTo(2 / 3 - 0.3)
  })
})

const model = (features: ModelReport['features'], intercept = 0): ModelReport => ({
  games: 100, wins: 55, intercept, interceptSe: 0.2, features, lambda: 1, converged: true,
  validation: { folds: 10, auc: 0.72, accuracy: 0.66, baseline: 0.55, brier: 0.21, roc: [] } as never,
  aucLow: 0.62, aucHigh: 0.82, eventsPerVariable: 15, held: [],
})
const feature = (key: ModelReport['features'][number]['key'], mean: number, sd: number, beta: number, se = 0.1) =>
  ({ key, mean, sd, beta, se, oddsRatio: Math.exp(beta), low: 0, high: 0, gap: 0, coverage: 1, p5: mean - 2 * sd, p95: mean + 2 * sd })

describe('the formula in the player\'s units', () => {
  it('rounds a step to a figure a player would name', () => {
    expect(niceStep(0.87)).toBe(1)
    expect(niceStep(1.8)).toBe(2)
    expect(niceStep(3)).toBe(2.5)
    expect(niceStep(620)).toBe(500)
    expect(niceStep(870)).toBe(1000)
    expect(niceStep(0)).toBe(1)
  })

  it('reads deaths and vision per game, at the player\'s average length', () => {
    expect(naturalUnit('deathsPerMin', 30)).toEqual({ scale: 30, format: 'decimal' })
    expect(naturalUnit('csPerMin', 30)).toEqual({ scale: 1, format: 'perMin' })
  })

  it('turns each weight into a chance before and after a typical step, strongest first', () => {
    const weights = formulaWeights(model([feature('deathsPerMin', 0.2, 0.1, -0.4), feature('csPerMin', 6, 1, 0.5), feature('firstBlood', 0.4, 0.49, 0.15, 0.5)]), 30)
    expect(weights.map(weight => weight.key)).toEqual(['csPerMin', 'deathsPerMin', 'firstBlood'])
    const [cs, deaths, blood] = weights
    // The average game: every metric at its mean, first blood at the commoner answer (no, 0.4 rounds to 0).
    const typical = 0.15 * (0 - 0.4) / 0.49
    expect(cs).toMatchObject({ from: 6, to: 7, step: 1 })
    expect(cs!.before).toBeCloseTo(sigmoid(typical))
    expect(cs!.after).toBeCloseTo(sigmoid(typical + 0.5))
    // 0.1 deaths a minute over 30 minutes is 3 a game: a step of 2.5, from 6 to 8.5.
    expect(deaths).toMatchObject({ step: 2.5 })
    expect(deaths!.from).toBeCloseTo(6)
    expect(deaths!.after).toBeCloseTo(sigmoid(typical - 0.4 * ((8.5 / 30 - 0.2) / 0.1)))
    expect(deaths!.change).toBeLessThan(0)
    expect(blood).toMatchObject({ binary: true, from: 0, to: 1 })
    expect(blood!.before).toBeCloseTo(sigmoid(typical))
    expect(blood!.after).toBeCloseTo(sigmoid(0.15 * (1 - 0.4) / 0.49))
    expect(cs!.confidence).toBe('strong')
    expect(blood!.confidence).toBe('uncertain')
  })

  it('grades the formula\'s predictions in a word', () => {
    expect(modelGrade(model([]))).toEqual({ grade: 'fair', confidence: 'strong', guessWin: true })
  })
})

describe('on a whole report', () => {
  const rows = filterRows(gameRows(syntheticHistory([game({ gameId: 9_000_000_000 })], 200, 'insights')), 'rift')
  const report = analyse(rows)

  it('has a sentence for every metric the games carry enough of', () => {
    const splits = report.metrics.map(metricSplit)
    expect(splits.filter(Boolean).length).toBeGreaterThan(report.metrics.length * 0.8)
    const lead = metricSplit(report.metrics.find(entry => entry.definition.key === 'goldDiff15')!)!
    expect(lead.kind).toBe('sign')
    expect(lead.high.games + lead.low.games).toBeLessThanOrEqual(report.metrics.find(entry => entry.definition.key === 'goldDiff15')!.games)
  })

  it('reads the formula, the streaks and the choices', () => {
    expect(formulaWeights(report.model!, report.overview.duration)).toHaveLength(report.model!.features.length)
    expect(['none', 'random', 'streaky', 'alternating']).toContain(streakReading(report.sequence).pattern)
    const champion = report.champions.groups[0]!
    expect(['strong', 'moderate', 'weak', 'uncertain']).toContain(groupConfidence(champion, report.champions.prior))
  })
})
