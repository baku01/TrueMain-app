import type { MatchBadge, MatchBadgeKind } from '#shared/types/matches'

/**
 * How each of Blitz's match accolades ranks and looks: its weight (the higher,
 * the earlier it is shown — a tile shows the first three), its tier (gold,
 * silver, bronze, or blue for the losing side's best player) and its icon.
 * The weights and tiers are Blitz's own; the hosts that grade a game sort its
 * badges with `sortBadges`.
 */
export type BadgeTier = 'gold' | 'silver' | 'bronze' | 'blue'

export interface BadgeLook { weight: number, tier: BadgeTier, icon: string }

export const BADGE_LOOK: Record<MatchBadgeKind, BadgeLook> = {
  mvp: { weight: 999, tier: 'gold', icon: 'i-lucide-crown' },
  svp: { weight: 999, tier: 'blue', icon: 'i-lucide-crown' },
  second: { weight: 999, tier: 'silver', icon: 'i-lucide-medal' },
  third: { weight: 999, tier: 'bronze', icon: 'i-lucide-medal' },
  pentaKill: { weight: 10, tier: 'gold', icon: 'i-lucide-swords' },
  quadraKill: { weight: 9, tier: 'silver', icon: 'i-lucide-swords' },
  tripleKill: { weight: 8, tier: 'silver', icon: 'i-lucide-swords' },
  doubleKill: { weight: 5, tier: 'bronze', icon: 'i-lucide-swords' },
  filthyRich: { weight: 8, tier: 'gold', icon: 'i-lucide-hand-coins' },
  cashMoney: { weight: 6, tier: 'silver', icon: 'i-lucide-hand-coins' },
  goldDigger: { weight: 3, tier: 'bronze', icon: 'i-lucide-hand-coins' },
  csGod: { weight: 8, tier: 'gold', icon: 'i-lucide-piggy-bank' },
  csLegend: { weight: 6, tier: 'silver', icon: 'i-lucide-piggy-bank' },
  csMaster: { weight: 3, tier: 'bronze', icon: 'i-lucide-piggy-bank' },
  unkillable: { weight: 7, tier: 'gold', icon: 'i-lucide-skull' },
  stable: { weight: 5, tier: 'silver', icon: 'i-lucide-skull' },
  allSeeing: { weight: 8, tier: 'gold', icon: 'i-lucide-eye' },
  goodEye: { weight: 6, tier: 'silver', icon: 'i-lucide-eye' },
  trueSupport: { weight: 2, tier: 'silver', icon: 'i-lucide-hand-heart' },
  firstBlood: { weight: 7, tier: 'gold', icon: 'i-lucide-droplet' },
  topDamage: { weight: 6, tier: 'gold', icon: 'i-lucide-hand-fist' },
  goodDamage: { weight: 5, tier: 'silver', icon: 'i-lucide-hand-fist' },
  bigChungus: { weight: 5, tier: 'gold', icon: 'i-lucide-shield' },
  beefy: { weight: 4, tier: 'silver', icon: 'i-lucide-shield' },
  wreckingBall: { weight: 5, tier: 'gold', icon: 'i-lucide-castle' },
  bulldozer: { weight: 4, tier: 'bronze', icon: 'i-lucide-castle' },
  perfectGame: { weight: 10, tier: 'gold', icon: 'i-lucide-trophy' },
}

/** Heaviest first; equal weights keep the order they were earned in. */
export function sortBadges(badges: MatchBadge[]): MatchBadge[] {
  return [...badges].sort((a, b) => BADGE_LOOK[b.kind].weight - BADGE_LOOK[a.kind].weight)
}
