import { describe, expect, it } from 'vitest'
import { betaQuantile, incompleteBeta, normalCdf, normalQuantile, studentTwoSidedP } from '~/utils/nerd-stats/distributions'
import { benjaminiHochberg, clopperPearson, cohensD, correlationReading, kernelRate, pearson, pointBiserial, quantileBins, ranks, spearman, twoProportion, versusCoinFlip, wilson } from '~/utils/nerd-stats/stats'
import { auc, crossValidate, fitLogistic, rocCurve, sigmoid, solve } from '~/utils/nerd-stats/logistic'
import { betaBinomialPrior, MAX_STRENGTH, MIN_STRENGTH, shrink } from '~/utils/nerd-stats/shrinkage'
import { runsTest, sessionPositions, streaks, transitions } from '~/utils/nerd-stats/sequence'

/** A seeded uniform generator (mulberry32), so a randomised sample is the same on every run. */
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('distributions', () => {
  it('reads the normal at its table values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7)
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 6)
    expect(normalCdf(-1)).toBeCloseTo(0.158655, 6)
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 6)
    expect(normalQuantile(0.05)).toBeCloseTo(-1.644854, 6)
  })

  it('gives Student\'s t its two-sided 5% critical values', () => {
    expect(studentTwoSidedP(2.776445, 4)).toBeCloseTo(0.05, 5)
    expect(studentTwoSidedP(2.228139, 10)).toBeCloseTo(0.05, 5)
    expect(studentTwoSidedP(12.7062, 1)).toBeCloseTo(0.05, 4)
    expect(studentTwoSidedP(0, 10)).toBeCloseTo(1, 8)
  })

  it('integrates the beta exactly where it has a closed form', () => {
    // Beta(2, 3): F(x) = x²(6 − 8x + 3x²).
    expect(incompleteBeta(0.5, 2, 3)).toBeCloseTo(0.6875, 9)
    expect(incompleteBeta(0.3, 1, 1)).toBeCloseTo(0.3, 9)
    expect(betaQuantile(0.6875, 2, 3)).toBeCloseTo(0.5, 9)
  })
})

describe('win-rate intervals', () => {
  it('matches the published Wilson bounds', () => {
    const eight = wilson(8, 10)
    expect(eight.rate).toBe(0.8)
    expect(eight.low).toBeCloseTo(0.4902, 4)
    expect(eight.high).toBeCloseTo(0.9433, 4)
    const none = wilson(0, 5)
    expect(none.low).toBe(0)
    expect(none.high).toBeCloseTo(0.4345, 4)
  })

  it('never leaves [0, 1], even at 2 of 2', () => {
    const two = wilson(2, 2)
    expect(two.high).toBe(1)
    expect(two.low).toBeGreaterThan(0.15)
    expect(two.low).toBeLessThan(0.4)
  })

  it('agrees with the exact interval it approximates', () => {
    const exact = clopperPearson(8, 10)
    expect(exact.low).toBeCloseTo(0.4439, 4)
    expect(exact.high).toBeCloseTo(0.9748, 4)
  })

  it('tests a record against a coin flip', () => {
    expect(versusCoinFlip(50, 100)).toBe(1)
    expect(versusCoinFlip(65, 100)).toBeLessThan(0.01)
    expect(versusCoinFlip(55, 100)).toBeGreaterThan(0.3)
  })
})

describe('correlation with winning', () => {
  const values = [1, 2, 3, 4, 5, 6]
  const wins = [false, false, false, true, true, true]

  it('computes the point-biserial r as Pearson against a 0/1 outcome and as its closed form', () => {
    const reading = pointBiserial(values, wins)!
    // (M₁ − M₀)/s · √(n₁n₀/n²) = (5 − 2)/√(17.5/6) · 0.5
    expect(reading.r).toBeCloseTo(3 / Math.sqrt(17.5 / 6) * 0.5, 10)
    expect(reading.r).toBeCloseTo(0.87831, 5)
    expect(reading.n).toBe(6)
    // t = r·√(4/(1 − r²)) ≈ 3.674 on 4 df: between the 5% (2.776) and 2% (3.747) critical values.
    expect(reading.p).toBeGreaterThan(0.02)
    expect(reading.p).toBeLessThan(0.05)
    expect(reading.low).toBeLessThan(reading.r)
    expect(reading.high).toBeGreaterThan(reading.r)
    expect(reading.high).toBeLessThan(1)
  })

  it('reads the Fisher-z interval symmetric in z, not in r', () => {
    const reading = correlationReading(0.5, 103)
    // atanh(0.5) ± 1.96/10
    expect(reading.low).toBeCloseTo(Math.tanh(Math.atanh(0.5) - 0.195996), 6)
    expect(reading.high).toBeCloseTo(Math.tanh(Math.atanh(0.5) + 0.195996), 6)
  })

  it('has no correlation without spread', () => {
    expect(pearson([1, 1, 1, 1], [1, 2, 3, 4])).toBeNull()
    expect(pointBiserial([1, 2, 3], [true, true, true])).toBeNull()
  })

  it('ranks ties at their average and scores a monotone curve 1', () => {
    expect(ranks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4])
    expect(spearman([1, 2, 3, 4, 5], [1, 8, 27, 64, 125])).toBeCloseTo(1, 12)
    expect(spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBeCloseTo(-1, 12)
  })

  it('measures Cohen\'s d in pooled standard deviations', () => {
    const effect = cohensD([5, 6, 7], [1, 2, 3])!
    expect(effect.d).toBe(4)
    expect(effect.meanA).toBe(6)
    expect(effect.meanB).toBe(2)
    expect(effect.low).toBeLessThan(4)
    expect(effect.high).toBeGreaterThan(4)
    expect(cohensD([1], [2, 3])).toBeNull()
  })

  it('adjusts p-values by Benjamini–Hochberg', () => {
    expect(benjaminiHochberg([0.01, 0.04, 0.03, 0.005]).map(q => Number(q.toFixed(6)))).toEqual([0.02, 0.04, 0.04, 0.02])
  })

  it('compares two win rates', () => {
    const same = twoProportion(5, 10, 50, 100)!
    expect(same.difference).toBe(0)
    expect(same.p).toBe(1)
    expect(twoProportion(80, 100, 40, 100)!.p).toBeLessThan(0.001)
  })
})

describe('quantile bins', () => {
  it('cuts twelve distinct values into equal terciles', () => {
    const values = Array.from({ length: 12 }, (_, i) => i + 1)
    const bins = quantileBins(values, values.map(value => value > 6), 3)
    expect(bins.map(bin => bin.games)).toEqual([4, 4, 4])
    expect(bins.map(bin => bin.wins)).toEqual([0, 2, 4])
    expect(bins[0]!.from).toBe(1)
    expect(bins[2]!.to).toBe(12)
  })

  it('never splits equal values across two bins', () => {
    const bins = quantileBins([0, 0, 0, 0, 1, 1, 2, 2], [false, false, true, false, true, true, true, false], 4)
    expect(bins.map(bin => [bin.from, bin.to, bin.games])).toEqual([[0, 0, 4], [1, 1, 2], [2, 2, 2]])
  })
})

describe('kernel-smoothed win rate', () => {
  it('follows a step from losing to winning, and leaves out what rests on too few games', () => {
    const xs = Array.from({ length: 40 }, (_, i) => i)
    const curve = kernelRate(xs, xs.map(x => x >= 20), [5, 20, 35, 200], 3)
    expect(curve.map(point => point.x)).toEqual([5, 20, 35])
    expect(curve[0]!.rate).toBeLessThan(0.05)
    expect(curve[2]!.rate).toBeGreaterThan(0.95)
    expect(curve[1]!.rate).toBeGreaterThan(0.4)
    expect(curve[1]!.rate).toBeLessThan(0.65)
    expect(curve[1]!.low).toBeLessThan(curve[1]!.rate)
  })
})

describe('logistic regression', () => {
  it('solves a linear system', () => {
    expect(solve([[2, 1], [1, 3]], [3, 5])!.map(x => Number(x.toFixed(10)))).toEqual([0.8, 1.4])
    expect(solve([[1, 2], [2, 4]], [1, 2])).toBeNull()
  })

  it('recovers the closed-form fit of one binary predictor without a penalty', () => {
    // x = 0: 3 wins in 10; x = 1: 7 in 10. β₀ = logit(0.3), β₁ = logit(0.7) − logit(0.3).
    const rows = Array.from({ length: 20 }, (_, i) => [i < 10 ? 0 : 1])
    const y = Array.from({ length: 20 }, (_, i) => (i < 10 ? (i < 3 ? 1 : 0) : (i < 17 ? 1 : 0)))
    const fit = fitLogistic(rows, y, 0)
    const logit = (p: number) => Math.log(p / (1 - p))
    expect(fit.converged).toBe(true)
    expect(fit.beta[0]).toBeCloseTo(logit(0.3), 8)
    expect(fit.beta[1]).toBeCloseTo(logit(0.7) - logit(0.3), 8)
    // Wald SEs of a 2×2 table: √(1/a + 1/b + 1/c + 1/d) for the log odds ratio.
    expect(fit.se[1]).toBeCloseTo(Math.sqrt(1 / 3 + 1 / 7 + 1 / 7 + 1 / 3), 6)
    expect(fit.se[0]).toBeCloseTo(Math.sqrt(1 / 3 + 1 / 7), 6)
  })

  it('zeroes the score equations at the unpenalised optimum', () => {
    const next = random(7)
    const rows = Array.from({ length: 200 }, () => [next() * 4 - 2, next() * 4 - 2])
    const y = rows.map(([a, b]) => (next() < sigmoid(1.2 * a! - 0.7 * b! + 0.3) ? 1 : 0))
    const fit = fitLogistic(rows, y, 0)
    const residuals = rows.map((row, i) => y[i]! - sigmoid(fit.beta[0]! + fit.beta[1]! * row[0]! + fit.beta[2]! * row[1]!))
    expect(Math.abs(residuals.reduce((a, b) => a + b, 0))).toBeLessThan(1e-6)
    expect(Math.abs(residuals.reduce((a, r, i) => a + r * rows[i]![0]!, 0))).toBeLessThan(1e-6)
    // The generating coefficients, within sampling error.
    expect(fit.beta[1]).toBeGreaterThan(0.7)
    expect(fit.beta[2]).toBeLessThan(-0.3)
  })

  it('stays finite on a sample the metric separates perfectly, where only the penalty bounds it', () => {
    const rows = [[-2], [-1], [-0.5], [0.5], [1], [2]]
    const y = [0, 0, 0, 1, 1, 1]
    const fit = fitLogistic(rows, y, 1)
    expect(fit.converged).toBe(true)
    expect(Number.isFinite(fit.beta[1]!)).toBe(true)
    expect(fit.beta[1]).toBeGreaterThan(0)
    // A heavier penalty pulls it further in.
    expect(fitLogistic(rows, y, 10).beta[1]!).toBeLessThan(fit.beta[1]!)
  })

  it('computes the AUC as Mann–Whitney', () => {
    expect(auc([0.1, 0.4, 0.35, 0.8], [0, 0, 1, 1])).toBe(0.75)
    expect(auc([1, 1, 1, 1], [0, 1, 0, 1])).toBe(0.5)
  })

  it('cross-validates out of sample, stratified', () => {
    const next = random(11)
    const rows = Array.from({ length: 120 }, () => [next() * 2 - 1, next() * 2 - 1])
    const y = rows.map(([a]) => (next() < sigmoid(4 * a!) ? 1 : 0))
    const validation = crossValidate(rows, y, 10, 1)
    expect(validation.folds).toBe(10)
    expect(validation.predictions).toHaveLength(120)
    expect(validation.auc).toBeGreaterThan(0.8)
    expect(validation.accuracy).toBeGreaterThan(validation.baseline)
    expect(validation.brier).toBeLessThan(0.25)
    // Noise predicts nothing: out of sample it does no better than a coin.
    const noise = crossValidate(rows, rows.map(() => (next() < 0.5 ? 1 : 0)), 10, 1)
    expect(noise.auc).toBeLessThan(0.65)
    expect(crossValidate(rows.slice(0, 12), y.slice(0, 12), 50, 1).folds).toBe(12)
  })
})

describe('empirical-Bayes shrinkage', () => {
  it('pulls every group to the pooled rate when they vary no more than luck', () => {
    const prior = betaBinomialPrior([{ games: 10, wins: 5 }, { games: 10, wins: 5 }, { games: 10, wins: 5 }])
    expect(prior.mean).toBe(0.5)
    expect(prior.strength).toBe(MAX_STRENGTH)
    expect(shrink({ games: 2, wins: 2 }, prior).rate).toBeCloseTo(52 / 102, 10)
  })

  it('estimates the prior\'s strength by the method of moments', () => {
    // μ = 0.5, Q/μ(1−μ) = 6.4, G − 1 = 2, N − Σn²/N = 40 → ρ = 0.11, κ = 1/ρ − 1.
    const prior = betaBinomialPrior([{ games: 20, wins: 14 }, { games: 20, wins: 6 }, { games: 20, wins: 10 }])
    expect(prior.strength).toBeCloseTo(1 / 0.11 - 1, 8)
    expect(prior.alpha).toBeCloseTo(prior.strength / 2, 8)
  })

  it('keeps the strength inside its bounds when the groups are wildly apart', () => {
    expect(betaBinomialPrior([{ games: 50, wins: 45 }, { games: 50, wins: 5 }]).strength).toBe(MIN_STRENGTH)
  })

  it('reads a group without games as the prior itself', () => {
    const flat = { alpha: 1, beta: 1, mean: 0.5, strength: 2, correlation: 1 / 3 }
    const empty = shrink({ games: 0, wins: 0 }, flat)
    expect(empty.rate).toBe(0.5)
    expect(empty.low).toBeCloseTo(0.025, 8)
    expect(empty.high).toBeCloseTo(0.975, 8)
    expect(empty.pull).toBe(1)
  })
})

describe('streaks and sessions', () => {
  it('counts the runs a streaky sequence and an alternating one make', () => {
    const streaky = runsTest([true, true, true, false, false, false])!
    expect(streaky.runs).toBe(2)
    expect(streaky.expected).toBe(4)
    expect(streaky.sd).toBeCloseTo(Math.sqrt(1.2), 10)
    expect(streaky.z).toBeCloseTo(-2 / Math.sqrt(1.2), 10)
    const alternating = runsTest([true, false, true, false, true, false])!
    expect(alternating.runs).toBe(6)
    expect(alternating.z).toBeCloseTo(2 / Math.sqrt(1.2), 10)
    expect(alternating.p).toBeCloseTo(streaky.p, 10)
    expect(runsTest([true, true, true])).toBeNull()
  })

  it('tallies the game after each result', () => {
    const results = [true, true, false, true, false, false, true]
    expect(transitions(results)).toEqual({
      afterWin: { games: 3, wins: 1 },
      afterLoss: { games: 3, wins: 2 },
      afterTwoWins: { games: 1, wins: 0 },
      afterTwoLosses: { games: 1, wins: 1 },
    })
    expect(streaks(results)).toEqual({ longestWin: 2, longestLoss: 2, current: 1 })
    expect(streaks([false, false]).current).toBe(-2)
  })

  it('numbers each game within its sitting', () => {
    const minute = 60_000
    const games = [
      { playedAt: 0, durationSeconds: 1800 },
      { playedAt: 35 * minute, durationSeconds: 1800 },
      { playedAt: 70 * minute, durationSeconds: 1800 },
      { playedAt: 300 * minute, durationSeconds: 1800 },
    ]
    expect(sessionPositions(games)).toEqual([1, 2, 3, 1])
  })
})

describe('the ROC curve', () => {
  it('steps through every threshold and encloses the AUC', () => {
    const curve = rocCurve([0.1, 0.4, 0.35, 0.8], [0, 0, 1, 1])
    expect(curve).toEqual([{ fpr: 0, tpr: 0 }, { fpr: 0, tpr: 0.5 }, { fpr: 0.5, tpr: 0.5 }, { fpr: 0.5, tpr: 1 }, { fpr: 1, tpr: 1 }])
    const area = curve.slice(1).reduce((sum, point, i) => sum + (point.fpr - curve[i]!.fpr) * (point.tpr + curve[i]!.tpr) / 2, 0)
    expect(area).toBe(auc([0.1, 0.4, 0.35, 0.8], [0, 0, 1, 1]))
  })

  it('takes tied scores together, as one diagonal step', () => {
    expect(rocCurve([0.5, 0.5], [0, 1])).toEqual([{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }])
  })
})
