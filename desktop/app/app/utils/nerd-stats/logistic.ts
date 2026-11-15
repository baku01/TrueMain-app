import { Z95 } from './distributions'
import { mean, ranks, sd } from './stats'

/**
 * The nerd page's "formula of victory": an L2-regularised (ridge) logistic
 * regression of winning on the player's standardised metrics,
 *
 *   P(win) = σ(β₀ + Σ βᵢ·zᵢ),   σ(t) = 1 / (1 + e⁻ᵗ),   zᵢ = (xᵢ − μᵢ) / sᵢ
 *
 * fitted by Newton–Raphson (iteratively reweighted least squares) on the
 * penalised log-likelihood ℓ(β) − λ/2·Σ βᵢ² (the intercept is not penalised).
 * The penalty is what keeps a small sample honest: with a hundred games and
 * eight metrics an unpenalised fit chases noise, and on a sample the metrics
 * separate perfectly its coefficients run off to infinity; ridge pulls every
 * coefficient toward zero by an amount the data has to overcome.
 *
 * How well it predicts is measured out of sample — k-fold cross-validation,
 * every game predicted by a model that never saw it, the standardisation
 * itself refitted inside each fold — so the accuracy and AUC it shows are what
 * the formula would score on the next games, not on the ones it was fitted to.
 */

export const sigmoid = (t: number) => (t >= 0 ? 1 / (1 + Math.exp(-t)) : Math.exp(t) / (1 + Math.exp(t)))

/** Solves A·x = b by Gaussian elimination with partial pivoting; null when A is singular. */
export function solve(matrix: readonly number[][], rhs: readonly number[]): number[] | null {
  const n = rhs.length
  const a = matrix.map((row, i) => [...row, rhs[i]!])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row
    if (Math.abs(a[pivot]![col]!) < 1e-12) return null
    const swapped = a[col]!
    a[col] = a[pivot]!
    a[pivot] = swapped
    for (let row = col + 1; row < n; row++) {
      const factor = a[row]![col]! / a[col]![col]!
      for (let k = col; k <= n; k++) a[row]![k]! -= factor * a[col]![k]!
    }
  }
  const x = Array.from({ length: n }, () => 0)
  for (let row = n - 1; row >= 0; row--) {
    let total = a[row]![n]!
    for (let k = row + 1; k < n; k++) total -= a[row]![k]! * x[k]!
    x[row] = total / a[row]![row]!
  }
  return x
}

/** The inverse of a small square matrix, column by column; null when singular. */
export function invert(matrix: readonly number[][]): number[][] | null {
  const n = matrix.length
  const columns: number[][] = []
  for (let col = 0; col < n; col++) {
    const unit = Array.from({ length: n }, (_, i) => (i === col ? 1 : 0))
    const solved = solve(matrix, unit)
    if (!solved) return null
    columns.push(solved)
  }
  return Array.from({ length: n }, (_, row) => columns.map(column => column[row]!))
}

export interface LogisticFit {
  /** β₀ then β₁…βₚ, on the scale of the columns passed (standardised by the caller). */
  beta: number[]
  /** Wald standard errors from the penalised information matrix (XᵀWX + Λ)⁻¹, same order. */
  se: number[]
  iterations: number
  converged: boolean
  lambda: number
}

/**
 * Fits the ridge logistic regression. `rows` hold the p predictors of each
 * game (no intercept column: it is added here), `y` 1 for a win.
 *
 * Newton's step on the penalised likelihood is
 *
 *   β ← β + (XᵀWX + Λ)⁻¹ · (Xᵀ(y − p) − Λβ),   W = diag(pᵢ(1 − pᵢ)),  Λ = diag(0, λ, …, λ)
 *
 * repeated until no coefficient moves by more than 1e-8.
 */
export function fitLogistic(rows: readonly number[][], y: readonly number[], lambda = 1, maxIterations = 100): LogisticFit {
  const p = (rows[0]?.length ?? 0) + 1
  const x = rows.map(row => [1, ...row])
  const beta = Array.from({ length: p }, () => 0)
  // Start the intercept at the base rate's log-odds: the fit then begins where
  // the "no metric matters" model is, and converges in a handful of steps.
  const base = Math.min(Math.max(mean(y), 1e-3), 1 - 1e-3)
  beta[0] = Math.log(base / (1 - base))
  let converged = false
  let iterations = 0
  let information: number[][] = []
  for (; iterations < maxIterations; iterations++) {
    const gradient = Array.from({ length: p }, () => 0)
    information = Array.from({ length: p }, () => Array.from({ length: p }, () => 0))
    for (let i = 0; i < x.length; i++) {
      const row = x[i]!
      let eta = 0
      for (let j = 0; j < p; j++) eta += beta[j]! * row[j]!
      const prob = sigmoid(eta)
      const weight = Math.max(prob * (1 - prob), 1e-10)
      const residual = y[i]! - prob
      for (let j = 0; j < p; j++) {
        gradient[j]! += row[j]! * residual
        for (let k = j; k < p; k++) information[j]![k]! += weight * row[j]! * row[k]!
      }
    }
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < j; k++) information[j]![k] = information[k]![j]!
      if (j > 0) {
        information[j]![j]! += lambda
        gradient[j]! -= lambda * beta[j]!
      }
    }
    const step = solve(information, gradient)
    if (!step) break
    let largest = 0
    for (let j = 0; j < p; j++) {
      beta[j]! += step[j]!
      largest = Math.max(largest, Math.abs(step[j]!))
    }
    if (largest < 1e-8) {
      converged = true
      iterations++
      break
    }
  }
  const covariance = invert(information)
  const se = beta.map((_, j) => (covariance ? Math.sqrt(Math.max(covariance[j]![j]!, 0)) : Number.NaN))
  return { beta, se, iterations, converged, lambda }
}

/** The fitted log-odds of one row (standardised predictors, no intercept column). */
export function linearPredictor(fit: Pick<LogisticFit, 'beta'>, row: readonly number[]): number {
  let eta = fit.beta[0]!
  for (let j = 0; j < row.length; j++) eta += fit.beta[j + 1]! * row[j]!
  return eta
}

/**
 * The area under the ROC curve: the chance a random win was given a higher
 * score than a random loss (ties count half) — the Mann–Whitney U over
 * n₁·n₀. 0.5 is a coin flip, 1 a perfect ranking.
 */
export function auc(scores: readonly number[], outcomes: readonly number[]): number {
  const positives = outcomes.filter(value => value === 1).length
  const negatives = outcomes.length - positives
  if (!positives || !negatives) return Number.NaN
  const ranked = ranks(scores)
  let rankSum = 0
  for (let i = 0; i < outcomes.length; i++) if (outcomes[i] === 1) rankSum += ranked[i]!
  return (rankSum - positives * (positives + 1) / 2) / (positives * negatives)
}

/**
 * The ROC curve of a set of scores: the true-positive rate against the
 * false-positive rate as the threshold sweeps from the highest score down,
 * tied scores taken together (one diagonal step).
 */
export function rocCurve(scores: readonly number[], outcomes: readonly number[]): { fpr: number, tpr: number }[] {
  const positives = outcomes.filter(value => value === 1).length
  const negatives = outcomes.length - positives
  if (!positives || !negatives) return []
  const order = scores.map((score, index) => ({ score, win: outcomes[index] === 1 })).sort((a, b) => b.score - a.score)
  const points = [{ fpr: 0, tpr: 0 }]
  let tp = 0
  let fp = 0
  for (let i = 0; i < order.length; i++) {
    if (order[i]!.win) tp++
    else fp++
    if (i === order.length - 1 || order[i + 1]!.score !== order[i]!.score) points.push({ fpr: fp / negatives, tpr: tp / positives })
  }
  return points
}

/** Hanley & McNeil's standard error of an AUC, for its 95% interval. */
export function aucInterval(area: number, positives: number, negatives: number): { low: number, high: number } {
  const q1 = area / (2 - area)
  const q2 = 2 * area * area / (1 + area)
  const variance = (area * (1 - area) + (positives - 1) * (q1 - area * area) + (negatives - 1) * (q2 - area * area)) / (positives * negatives)
  const se = Math.sqrt(Math.max(variance, 0))
  return { low: Math.max(0, area - Z95 * se), high: Math.min(1, area + Z95 * se) }
}

/** Each column's mean and standard deviation, for zᵢ = (xᵢ − μᵢ)/sᵢ; a constant column keeps s = 1. */
export function columnScales(rows: readonly number[][]): { mean: number[], sd: number[] } {
  const p = rows[0]?.length ?? 0
  const means: number[] = []
  const sds: number[] = []
  for (let j = 0; j < p; j++) {
    const column = rows.map(row => row[j]!)
    means.push(mean(column))
    const spread = sd(column)
    sds.push(spread > 0 ? spread : 1)
  }
  return { mean: means, sd: sds }
}

export function standardise(rows: readonly number[][], scales: { mean: number[], sd: number[] }): number[][] {
  return rows.map(row => row.map((value, j) => (value - scales.mean[j]!) / scales.sd[j]!))
}

/** The out-of-sample reading of the model. */
export interface Validation {
  folds: number
  /** Every game's predicted P(win) from the fold that left it out, in input order. */
  predictions: number[]
  /** The ROC curve of those out-of-fold predictions. */
  roc: { fpr: number, tpr: number }[]
  auc: number
  accuracy: number
  /** Always guessing the more common result: the accuracy to beat. */
  baseline: number
  /** Mean of (P(win) − y)², 0 perfect, 0.25 a constant 50%. */
  brier: number
  logLoss: number
}

/**
 * k-fold cross-validation, the folds dealt round-robin within wins and within
 * losses (stratified) so each holds the sample's win rate. Each fold's model
 * standardises with its own training games' means and spreads: borrowing the
 * held-out games' would leak them into the fit. `folds` ≥ n is leave-one-out.
 */
export function crossValidate(rows: readonly number[][], y: readonly number[], folds = 10, lambda = 1): Validation {
  const n = y.length
  const k = Math.max(2, Math.min(folds, n))
  const fold = Array.from({ length: n }, () => 0)
  let wins = 0
  let losses = 0
  for (let i = 0; i < n; i++) fold[i] = y[i] === 1 ? wins++ % k : losses++ % k
  const predictions = Array.from({ length: n }, () => 0.5)
  for (let f = 0; f < k; f++) {
    const train = fold.flatMap((value, i) => (value === f ? [] : [i]))
    const test = fold.flatMap((value, i) => (value === f ? [i] : []))
    if (!test.length || !train.length) continue
    const scales = columnScales(train.map(i => rows[i]!))
    const fit = fitLogistic(standardise(train.map(i => rows[i]!), scales), train.map(i => y[i]!), lambda)
    const held = standardise(test.map(i => rows[i]!), scales)
    test.forEach((i, index) => {
      predictions[i] = sigmoid(linearPredictor(fit, held[index]!))
    })
  }
  const rate = mean(y)
  let correct = 0
  let brier = 0
  let logLoss = 0
  for (let i = 0; i < n; i++) {
    const prob = Math.min(Math.max(predictions[i]!, 1e-12), 1 - 1e-12)
    if ((prob >= 0.5 ? 1 : 0) === y[i]) correct++
    brier += (prob - y[i]!) ** 2
    logLoss -= y[i] === 1 ? Math.log(prob) : Math.log(1 - prob)
  }
  return {
    folds: k,
    predictions,
    roc: rocCurve(predictions, y),
    auc: auc(predictions, y),
    accuracy: correct / n,
    baseline: Math.max(rate, 1 - rate),
    brier: brier / n,
    logLoss: logLoss / n,
  }
}
