/**
 * The probability distributions the nerd page's tests read their p-values and
 * intervals from — the normal, Student's t and the beta — written out rather
 * than imported, since nothing in the app's dependencies carries them and each
 * is a few lines of well-known numerical recipe.
 *
 * Precision is far past what a sample of a couple of hundred games can use:
 * the normal CDF is good to ~1e-7, its quantile to ~1e-9, the incomplete beta
 * to ~1e-10. Every function is pure and total: an argument out of range
 * clamps rather than throws, so a degenerate sample reads as "no evidence",
 * never as a crash.
 */

/** The standard normal's CDF, Φ(x) (Abramowitz & Stegun 26.2.17 through erfc's symmetry). */
export function normalCdf(x: number): number {
  if (!Number.isFinite(x)) return x > 0 ? 1 : 0
  const z = Math.abs(x) / Math.SQRT2
  // erfc(z) by the Numerical Recipes Chebyshev fit (erfcc), fractional error < 1.2e-7.
  const t = 1 / (1 + 0.5 * z)
  const erfc = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418
    + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))))
  return x >= 0 ? 1 - erfc / 2 : erfc / 2
}

/** Φ⁻¹(p), the standard normal's quantile (Acklam's rational approximation, refined once by Halley's step). */
export function normalQuantile(p: number): number {
  if (p <= 0) return Number.NEGATIVE_INFINITY
  if (p >= 1) return Number.POSITIVE_INFINITY
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const low = 0.02425
  let x: number
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p))
    x = (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  }
  else if (p <= 1 - low) {
    const q = p - 0.5
    const r = q * q
    x = (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
  }
  else {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    x = -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  }
  // One Halley step against the CDF above.
  const e = normalCdf(x) - p
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2)
  return x - u / (1 + x * u / 2)
}

/** The z of a two-sided 95% interval, Φ⁻¹(0.975). */
export const Z95 = 1.959963984540054

/** Two-sided p-value of a z statistic: 2·(1 − Φ(|z|)). */
export function twoSidedP(z: number): number {
  if (!Number.isFinite(z)) return Number.isNaN(z) ? 1 : 0
  return Math.min(1, 2 * (1 - normalCdf(Math.abs(z))))
}

/** ln Γ(x) for x > 0 (Lanczos, g = 7, nine terms). */
export function logGamma(x: number): number {
  const g = [0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406,
    12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7]
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x)
  const shifted = x - 1
  let sum = g[0]!
  for (let i = 1; i < 9; i++) sum += g[i]! / (shifted + i)
  const t = shifted + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(sum)
}

/** The continued fraction of the incomplete beta (Numerical Recipes `betacf`, modified Lentz). */
function betaContinuedFraction(x: number, a: number, b: number): number {
  const TINY = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - qab * x / qap
  if (Math.abs(d) < TINY) d = TINY
  d = 1 / d
  let h = d
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < TINY) d = TINY
    c = 1 + aa / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < TINY) d = TINY
    c = 1 + aa / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < 1e-12) break
  }
  return h
}

/** The regularized incomplete beta Iₓ(a, b) — the beta distribution's CDF at x. */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  // The fraction converges fast on the side of the mode; the other side by symmetry.
  return x < (a + 1) / (a + b + 2)
    ? front * betaContinuedFraction(x, a, b) / a
    : 1 - front * betaContinuedFraction(1 - x, b, a) / b
}

/** The beta distribution's quantile: the x with Iₓ(a, b) = p, by bisection (60 halvings: below 1e-15). */
export function betaQuantile(p: number, a: number, b: number): number {
  if (p <= 0) return 0
  if (p >= 1) return 1
  let low = 0
  let high = 1
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2
    if (incompleteBeta(mid, a, b) < p) low = mid
    else high = mid
  }
  return (low + high) / 2
}

/** Two-sided p-value of a t statistic on `df` degrees of freedom: I_{df/(df+t²)}(df/2, 1/2). */
export function studentTwoSidedP(t: number, df: number): number {
  if (!Number.isFinite(t)) return Number.isNaN(t) ? 1 : 0
  if (df <= 0) return 1
  return Math.min(1, incompleteBeta(df / (df + t * t), df / 2, 0.5))
}
