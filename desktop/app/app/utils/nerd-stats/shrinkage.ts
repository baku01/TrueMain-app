import { betaQuantile } from './distributions'

/**
 * Win rates of small groups — a champion played twice, a keystone tried three
 * times — read through empirical-Bayes shrinkage, so 2/2 does not stand as
 * "100%" beside a 30-game main at 54%.
 *
 * Each group's true rate is taken to come from one Beta(α, β) prior shared by
 * all of the player's groups, and the prior is estimated from the groups
 * themselves by the method of moments. A group's estimate is then its
 * posterior mean
 *
 *   p̃ = (wins + α) / (games + α + β)
 *
 * — its own record pulled toward the player's overall rate μ = α/(α+β) with
 * the weight of κ = α + β imaginary games. A group with many games barely
 * moves; one with two is mostly prior.
 */

export interface GroupCount {
  games: number
  wins: number
}

export interface BetaPrior {
  alpha: number
  beta: number
  /** μ = α / (α + β), the pooled win rate. */
  mean: number
  /** κ = α + β, how many games of evidence the prior is worth. */
  strength: number
  /** ρ = 1 / (κ + 1), the share of the spread between groups that is real rather than luck. */
  correlation: number
}

/** κ is kept inside these bounds: a handful of groups estimates it roughly at best. */
export const MIN_STRENGTH = 2
export const MAX_STRENGTH = 100

/**
 * Fits the Beta prior by the method of moments (the ANOVA estimator of the
 * intraclass correlation for binomial counts). With N games over G groups,
 * pooled rate μ and Q = Σ nᵢ(p̂ᵢ − μ)²,
 *
 *   E[Q] = μ(1 − μ)·[(G − 1) + ρ·(N − Σnᵢ²/N)]
 *
 * so ρ̂ = (Q / μ(1 − μ) − (G − 1)) / (N − Σnᵢ²/N), and κ = 1/ρ̂ − 1. When the
 * groups vary no more than luck would make them (ρ̂ ≤ 0) the prior is as
 * strong as allowed: every group reads close to the overall rate.
 */
export function betaBinomialPrior(groups: readonly GroupCount[]): BetaPrior {
  const played = groups.filter(group => group.games > 0)
  const total = played.reduce((sum, group) => sum + group.games, 0)
  const won = played.reduce((sum, group) => sum + group.wins, 0)
  const mu = total ? Math.min(Math.max(won / total, 0.01), 0.99) : 0.5
  let strength = MAX_STRENGTH
  if (played.length >= 2 && total > 0) {
    const q = played.reduce((sum, group) => sum + group.games * (group.wins / group.games - mu) ** 2, 0)
    const spread = total - played.reduce((sum, group) => sum + group.games * group.games, 0) / total
    const rho = spread > 0 ? (q / (mu * (1 - mu)) - (played.length - 1)) / spread : 0
    if (rho > 0) strength = 1 / rho - 1
  }
  strength = Math.min(Math.max(strength, MIN_STRENGTH), MAX_STRENGTH)
  return { alpha: mu * strength, beta: (1 - mu) * strength, mean: mu, strength, correlation: 1 / (strength + 1) }
}

export interface ShrunkRate {
  /** The posterior mean (wins + α) / (games + α + β). */
  rate: number
  /** The equal-tailed 95% credible interval of Beta(wins + α, losses + β). */
  low: number
  high: number
  /** How far the raw rate was pulled, as the prior's share of the evidence: κ / (games + κ). */
  pull: number
}

export function shrink(group: GroupCount, prior: BetaPrior): ShrunkRate {
  const a = group.wins + prior.alpha
  const b = group.games - group.wins + prior.beta
  return {
    rate: a / (a + b),
    low: betaQuantile(0.025, a, b),
    high: betaQuantile(0.975, a, b),
    pull: prior.strength / (group.games + prior.strength),
  }
}
