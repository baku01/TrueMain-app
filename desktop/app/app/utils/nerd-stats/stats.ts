import { betaQuantile, normalQuantile, studentTwoSidedP, twoSidedP, Z95 } from './distributions'

/**
 * The descriptive and two-sample statistics of the nerd page: means and
 * spreads, the Wilson interval of a win rate, the point-biserial correlation
 * of a metric with winning (with its t-test and Fisher-z interval), Cohen's d
 * between wins and losses, Spearman's ρ, a two-proportion test, and the
 * Benjamini–Hochberg correction for testing thirty metrics at once.
 *
 * Inputs are plain arrays; a value that cannot be measured is left out by the
 * caller, never passed as zero. Every function answers `null` (or an empty
 * interval) when the sample is too small for it to mean anything, rather than
 * a number that only looks precise.
 */

export interface Interval {
  low: number
  high: number
}

export function sum(xs: readonly number[]): number {
  let total = 0
  for (const x of xs) total += x
  return total
}

export function mean(xs: readonly number[]): number {
  return xs.length ? sum(xs) / xs.length : Number.NaN
}

/** The sample variance, Σ(x − x̄)² / (n − 1). */
export function variance(xs: readonly number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  let total = 0
  for (const x of xs) total += (x - m) ** 2
  return total / (xs.length - 1)
}

export const sd = (xs: readonly number[]) => Math.sqrt(variance(xs))

/** The q-quantile of an ascending array, linearly interpolated (Hyndman & Fan type 7, as R and NumPy default). */
export function quantile(sorted: readonly number[], q: number): number {
  if (!sorted.length) return Number.NaN
  const position = (sorted.length - 1) * Math.min(Math.max(q, 0), 1)
  const below = Math.floor(position)
  const above = Math.ceil(position)
  return sorted[below]! + (sorted[above]! - sorted[below]!) * (position - below)
}

export const ascending = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)

/** 1-based ranks, ties sharing the average of the ranks they span — what Spearman's ρ and the AUC read. */
export function ranks(xs: readonly number[]): number[] {
  const order = xs.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value)
  const out = Array.from({ length: xs.length }, () => 0)
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && order[j + 1]!.value === order[i]!.value) j++
    const rank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) out[order[k]!.index] = rank
    i = j + 1
  }
  return out
}

/** Pearson's r, or null when either side has no spread (a constant says nothing about the other). */
export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return null
  const mx = mean(xs)
  const my = mean(ys)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx
    const dy = ys[i]! - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  if (sxx <= 0 || syy <= 0) return null
  return Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)))
}

/** Spearman's ρ: Pearson's r of the ranks, so a monotone relation scores 1 whatever its shape. */
export function spearman(xs: readonly number[], ys: readonly number[]): number | null {
  return pearson(ranks(xs), ranks(ys))
}

/**
 * The Wilson score interval of k successes in n tries:
 *
 *   (p̂ + z²/2n ± z·√(p̂(1−p̂)/n + z²/4n²)) / (1 + z²/n)
 *
 * Unlike p̂ ± z·√(p̂(1−p̂)/n) it never leaves [0, 1] and stays honest at 2/2 or
 * 0/3, where the textbook interval collapses to a point.
 */
export function wilson(k: number, n: number, z = Z95): Interval & { rate: number } {
  if (n <= 0) return { rate: Number.NaN, low: 0, high: 1 }
  const p = k / n
  const z2 = z * z
  const centre = p + z2 / (2 * n)
  const half = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))
  const denominator = 1 + z2 / n
  return { rate: p, low: Math.max(0, (centre - half) / denominator), high: Math.min(1, (centre + half) / denominator) }
}

/** The exact (Clopper–Pearson) 95% interval of k in n, from the beta quantiles — for the tests to check Wilson against. */
export function clopperPearson(k: number, n: number): Interval {
  return {
    low: k === 0 ? 0 : betaQuantile(0.025, k, n - k + 1),
    high: k === n ? 1 : betaQuantile(0.975, k + 1, n - k),
  }
}

/** A correlation coefficient with its evidence: the t-test's p-value and the Fisher-z 95% interval. */
export interface CorrelationReading extends Interval {
  r: number
  n: number
  /** Two-sided, H₀: ρ = 0, from t = r·√((n−2)/(1−r²)) on n − 2 degrees of freedom. */
  p: number
}

/**
 * r with its p-value and interval. The interval is Fisher's: z = atanh(r) is
 * close to normal with SE 1/√(n−3), so the bounds are tanh(z ± 1.96/√(n−3)).
 */
export function correlationReading(r: number, n: number): CorrelationReading {
  const df = n - 2
  const t = Math.abs(r) >= 1 ? Number.POSITIVE_INFINITY : r * Math.sqrt(df / (1 - r * r))
  const p = df > 0 ? studentTwoSidedP(t, df) : 1
  if (n <= 3) return { r, n, p, low: -1, high: 1 }
  const z = Math.atanh(Math.max(-0.999999, Math.min(0.999999, r)))
  const half = Z95 / Math.sqrt(n - 3)
  return { r, n, p, low: Math.tanh(z - half), high: Math.tanh(z + half) }
}

/**
 * The point-biserial correlation of a metric with winning: Pearson's r
 * against a 0/1 outcome, which works out as
 *
 *   r_pb = (M₁ − M₀) / s · √(n₁·n₀ / n²)
 *
 * with M₁, M₀ the metric's means in wins and losses and s its standard
 * deviation over all games (with n in the denominator).
 */
export function pointBiserial(values: readonly number[], wins: readonly boolean[]): CorrelationReading | null {
  const r = pearson(values, wins.map(win => (win ? 1 : 0)))
  return r === null ? null : correlationReading(r, values.length)
}

/** Cohen's d between two groups, with the large-sample 95% interval (Hedges & Olkin's SE). */
export interface EffectSize extends Interval {
  d: number
  /** Mean of the first group (wins) and of the second (losses). */
  meanA: number
  meanB: number
}

/**
 * Cohen's d = (x̄_A − x̄_B) / s_pooled, s_pooled = √(((n_A−1)s_A² + (n_B−1)s_B²) / (n_A+n_B−2)):
 * how many standard deviations apart the two groups' means sit. SE(d) =
 * √((n_A+n_B)/(n_A·n_B) + d²/(2(n_A+n_B))).
 */
export function cohensD(a: readonly number[], b: readonly number[]): EffectSize | null {
  if (a.length < 2 || b.length < 2) return null
  const pooled = Math.sqrt(((a.length - 1) * variance(a) + (b.length - 1) * variance(b)) / (a.length + b.length - 2))
  if (!(pooled > 0)) return null
  const meanA = mean(a)
  const meanB = mean(b)
  const d = (meanA - meanB) / pooled
  const se = Math.sqrt((a.length + b.length) / (a.length * b.length) + d * d / (2 * (a.length + b.length)))
  return { d, meanA, meanB, low: d - Z95 * se, high: d + Z95 * se }
}

/** Two win rates compared: the difference, and the pooled two-proportion z-test. */
export interface ProportionDifference {
  difference: number
  z: number
  p: number
}

export function twoProportion(k1: number, n1: number, k2: number, n2: number): ProportionDifference | null {
  if (n1 <= 0 || n2 <= 0) return null
  const pooled = (k1 + k2) / (n1 + n2)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))
  const difference = k1 / n1 - k2 / n2
  const z = se > 0 ? difference / se : 0
  return { difference, z, p: se > 0 ? twoSidedP(z) : 1 }
}

/** The binomial test of k in n against a fair coin, by the normal approximation with continuity correction. */
export function versusCoinFlip(k: number, n: number): number {
  if (n <= 0) return 1
  const z = (Math.abs(k - n / 2) - 0.5) / Math.sqrt(n / 4)
  return z <= 0 ? 1 : twoSidedP(z)
}

/**
 * Benjamini–Hochberg q-values: each p-value adjusted for the number tested,
 * so that "q < 0.05" bounds the share of false discoveries at 5% among the
 * metrics flagged. Thirty metrics tested at p < 0.05 would otherwise flag one
 * or two by chance alone.
 */
export function benjaminiHochberg(ps: readonly number[]): number[] {
  const m = ps.length
  const order = ps.map((p, index) => ({ p, index })).sort((a, b) => a.p - b.p)
  const q = Array.from({ length: m }, () => 1)
  let running = 1
  for (let rank = m; rank >= 1; rank--) {
    const entry = order[rank - 1]!
    running = Math.min(running, entry.p * m / rank)
    q[entry.index] = Math.min(1, running)
  }
  return q
}

/** One bin of a metric: its range, its games and the win rate in them. */
export interface RateBin extends Interval {
  from: number
  to: number
  games: number
  wins: number
  rate: number
}

/**
 * The win rate in `count` bins of a metric cut at its quantiles (terciles,
 * quartiles), each with its Wilson interval. Ties never straddle a cut — every
 * game with the same value lands in the same bin — so a metric with few
 * distinct values (deaths, first blood) gets fewer, honest bins.
 */
export function quantileBins(values: readonly number[], wins: readonly boolean[], count: number): RateBin[] {
  const pairs = values.map((value, index) => ({ value, win: wins[index]! })).sort((a, b) => a.value - b.value)
  if (!pairs.length) return []
  const sorted = pairs.map(pair => pair.value)
  const cuts = [...new Set(Array.from({ length: count - 1 }, (_, i) => quantile(sorted, (i + 1) / count)))]
  // A value lands past every cut it exceeds; one equal to a cut stays below it,
  // so equal values always share a bin. Bins no value reached are dropped.
  const bins = new Map<number, { from: number, to: number, games: number, wins: number }>()
  for (const pair of pairs) {
    const index = cuts.filter(cut => pair.value > cut).length
    const bin = bins.get(index) ?? { from: pair.value, to: pair.value, games: 0, wins: 0 }
    bin.to = pair.value
    bin.games++
    if (pair.win) bin.wins++
    bins.set(index, bin)
  }
  return [...bins.values()].map(bin => ({ ...bin, ...wilson(bin.wins, bin.games) }))
}

/** A point of a smoothed win-rate curve, with the band its effective sample allows. */
export interface CurvePoint extends Interval {
  x: number
  rate: number
  /** Kish's effective sample size, (Σw)² / Σw²: how many games the point really rests on. */
  effective: number
}

/**
 * The win rate along a metric, smoothed by a Gaussian kernel (Nadaraya–Watson):
 *
 *   p̂(x) = Σ wᵢ·yᵢ / Σ wᵢ,   wᵢ = exp(−(x − xᵢ)² / 2h²)
 *
 * with a Wilson band on Kish's effective sample. Points resting on fewer than
 * `minEffective` games are dropped rather than drawn from almost nothing.
 */
export function kernelRate(xs: readonly number[], wins: readonly boolean[], grid: readonly number[], bandwidth: number, minEffective = 4): CurvePoint[] {
  const out: CurvePoint[] = []
  for (const x of grid) {
    let total = 0
    let squares = 0
    let won = 0
    for (let i = 0; i < xs.length; i++) {
      const w = Math.exp(-((x - xs[i]!) ** 2) / (2 * bandwidth * bandwidth))
      total += w
      squares += w * w
      if (wins[i]) won += w
    }
    if (total <= 0) continue
    const effective = total * total / squares
    if (effective < minEffective) continue
    const rate = won / total
    const band = wilson(rate * effective, effective)
    out.push({ x, rate, effective, low: band.low, high: band.high })
  }
  return out
}

/** The z for a two-sided interval of the given coverage (0.95 → 1.96). */
export const zFor = (coverage: number) => normalQuantile(0.5 + coverage / 2)
