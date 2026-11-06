import type { ChampionRead, ItemRead } from '~/utils/jev-read'

/**
 * What the enemy team throws at us and how items answer it — the first two
 * steps of the Jev ranking (`utils/jev-recommend`): the team's needs from its
 * measured damage split and what Jev read of each kit, and each item's answer
 * to them by Riot's resistance tags and what Jev read of the item.
 */

export interface Needs {
  physical: number
  magic: number
  cc: number
  heal: number
  burst: number
  autos: number
  tanks: number
}

export const NEEDS: (keyof Needs)[] = ['physical', 'magic', 'cc', 'heal', 'burst', 'autos', 'tanks']

/** An enemy as the needs read it: what Jev read of its kit, its measured damage split and its weight in the team's damage. */
export interface EnemyLine {
  id: number
  read: ChampionRead
  physical: number
  magic: number
  /** Its share of the team's damage to champions, 0–1. */
  weight: number
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

/**
 * What a usual team of five holds, summed as Jev reads it, and how much more
 * makes a need full: every team has some crowd control, a healer or a
 * fighter that sustains, someone durable — a need is what stands out of that,
 * or every defensive item would answer every draft. Measured (16.22): the 173
 * champions played on a lane in Emerald+ read by Jev, 20,000 solo-queue teams
 * drawn one champion per lane — a team's usual sum is the median, a need full
 * at the 97th percentile. Guessed before (burst usual at 1), burst read full
 * in nearly every draft and a defensive item answered all of them.
 */
const USUAL: Record<'cc' | 'heal' | 'burst' | 'tank', { usual: number, more: number }> = {
  cc: { usual: 2.2, more: 0.8 },
  heal: { usual: 0.85, more: 0.8 },
  burst: { usual: 2.45, more: 0.7 },
  tank: { usual: 1.65, more: 1.15 },
}

/** The share of damage dealt with basic attacks a usual team has, and how much more makes the need full: measured as `USUAL`. */
const USUAL_AUTOS = { usual: 0.43, more: 0.15 }

/**
 * What a team throws at us, each 0–1: the damage split weighed by what each
 * champion deals (a share, as measured); the rest as what stands out of a
 * usual team of as many — crowd control, healing, burst and tankiness summed
 * over the champions, the basic-attack share weighed by damage — 0 at the
 * usual, 1 well past it.
 *
 * Crowd control and healing count only as far as their answers reach them
 * (LoLTheory, blog.loltheory.gg/what-is-cc-league-of-legends and
 * /grievous-wounds-lol): Tenacity does not shorten airborne, suppression,
 * stasis, drowsy or nearsight, and Grievous Wounds — three seconds from an
 * item — has run out before the regeneration out of combat of Garen, Tahm
 * Kench or a Warmog's Armor. So the need is what stands out, times the share
 * of the team's crowd control Tenacity shortens and of its healing done in
 * fights, each champion's share weighed by how much it has. `USUAL` was
 * measured on the whole of both; the share's own usual was not.
 */
export function needsOf(enemies: EnemyLine[]): Needs {
  if (!enemies.length) return { physical: 0.5, magic: 0.5, cc: 0, heal: 0, burst: 0, autos: 0, tanks: 0 }
  const weights = enemies.map(enemy => enemy.weight)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const share = (index: number) => (total > 0 ? weights[index]! / total : 1 / enemies.length)
  const weighed = (pick: (enemy: EnemyLine) => number) => enemies.reduce((sum, enemy, index) => sum + share(index) * pick(enemy), 0)
  const scale = enemies.length / 5
  // One champion alone (the lane opponent) fills a need only near the top of the scale, not by being a little more than a fifth of a team.
  const past = (fact: keyof typeof USUAL) => clamp((enemies.reduce((sum, enemy) => sum + enemy.read[fact], 0) - USUAL[fact].usual * scale) / Math.max(0.5, USUAL[fact].more * scale))
  const reached = (fact: 'cc' | 'heal', part: 'ccReducible' | 'healInFight') => {
    const sum = enemies.reduce((all, enemy) => all + enemy.read[fact], 0)
    return sum > 0 ? enemies.reduce((all, enemy) => all + enemy.read[fact] * enemy.read[part], 0) / sum : 1
  }
  return {
    physical: weighed(enemy => enemy.physical),
    magic: weighed(enemy => enemy.magic),
    cc: past('cc') * reached('cc', 'ccReducible'),
    heal: past('heal') * reached('heal', 'healInFight'),
    burst: past('burst'),
    autos: clamp((weighed(enemy => enemy.read.autos) - USUAL_AUTOS.usual) / USUAL_AUTOS.more),
    tanks: past('tank'),
  }
}

/** While laning, the lane opponent is most of what we face: 60% its needs, 40% the team's. */
export function laneNeeds(team: Needs, opponent: Needs | null): Needs {
  if (!opponent) return team
  return Object.fromEntries(NEEDS.map(need => [need, 0.6 * opponent[need] + 0.4 * team[need]])) as unknown as Needs
}

/** A need an option answers, and how much: the need times what the option has against it. */
export interface Answer { need: keyof Needs, value: number }

export interface Fit {
  /** 0–1: how much of what the team throws at us the option answers. */
  fit: number
  /** The needs it answers, most first, the negligible left out. */
  answers: Answer[]
  /** It defends only against the kind of damage the team does not deal. */
  misfit: boolean
}

/** The resistances a draft can call for. */
export type Resist = 'physical' | 'magic'

export interface FitOptions {
  /** How much each item weighs in the answer, in order; equal when absent. */
  weights?: number[]
  /** The resistances a draft rule makes due now (`utils/jev-rules`): their need reads full. */
  due?: Resist[]
}

/** Tags that make an item a damage item too: its resistances come with what the champion builds it for. */
const OFFENSIVE = ['Damage', 'SpellDamage', 'AttackSpeed', 'CriticalStrike', 'ArmorPenetration', 'MagicPenetration', 'LifeSteal', 'OnHit']

/** Below this share, a team does not deal that kind of damage to speak of. */
const LITTLE = 0.3

/**
 * Crowd control heavy enough to buy Tenacity on magic resist into physical
 * damage: well past a usual team's. A lone lane opponent with one stun does
 * not reach it — into a physical laner, resist its damage.
 */
const HEAVY_CC = 0.6

/**
 * How much a damage share calls for resisting it: nothing at an even split
 * (armor into a usual team buys little), all of it from four fifths.
 */
const resistNeed = (share: number) => clamp((share - 0.45) / 0.35)

/**
 * How well items answer the needs: Riot's resistance tags against the share
 * of the damage past an even split — the whole of it where a rule makes the
 * resistance due (`due`) — Jev's facts against the rest; the items weighed as
 * `weights` says.
 */
export function fitOf(itemIds: number[], needs: Needs, reads: Map<number, ItemRead>, tags: (id: number) => string[], options: FitOptions = {}): Fit {
  if (!itemIds.length) return { fit: 0, answers: [], misfit: false }
  const due = options.due ?? []
  const per = itemIds.map((id) => {
    const read = reads.get(id)
    const own = tags(id)
    const has: Record<keyof Needs, number> = {
      physical: own.includes('Armor') ? 1 : 0,
      magic: own.includes('SpellBlock') ? 1 : 0,
      cc: read?.tenacity ?? 0,
      heal: read?.antiHeal ?? 0,
      burst: read?.antiBurst ?? 0,
      autos: read?.vsAutos ?? 0,
      tanks: read?.vsTanks ?? 0,
    }
    // An item that resists only the damage the team does not deal guards against nothing it throws: its
    // protection against burst or basic attacks is that resistance's (Maw of Malmortius shields magic
    // damage only), so it answers neither — a damage item too, though it is never a misfit.
    const offKind = (has.physical && !has.magic && needs.physical < LITTLE) || (has.magic && !has.physical && needs.magic < LITTLE)
    if (offKind) {
      has.burst = 0
      has.autos = 0
    }
    const defensiveOnly = (has.physical || has.magic) && !own.some(tag => OFFENSIVE.includes(tag))
    const misfit = defensiveOnly && (
      (has.physical && !has.magic && needs.physical < LITTLE && !due.includes('physical'))
      || (has.magic && !has.physical && needs.magic < LITTLE && !due.includes('magic') && !(has.cc > 0.5 && needs.cc >= HEAVY_CC))
    )
    return { has, misfit: !!misfit }
  })
  const weightOf = (index: number) => options.weights?.[index] ?? 1
  const weight = per.reduce((sum, _, index) => sum + weightOf(index), 0)
  const calls: Needs = {
    ...needs,
    physical: due.includes('physical') ? 1 : resistNeed(needs.physical),
    magic: due.includes('magic') ? 1 : resistNeed(needs.magic),
  }
  const answers = NEEDS
    .map(need => ({ need, value: weight ? per.reduce((sum, item, index) => sum + weightOf(index) * item.has[need], 0) / weight * calls[need] : 0 }))
    .filter(answer => answer.value >= 0.12)
    .sort((a, b) => b.value - a.value)
  const raw = answers.reduce((sum, answer) => sum + answer.value, 0)
  return { fit: 1 - Math.exp(-1.6 * raw), answers, misfit: per.some(item => item.misfit) }
}

/** Whether an item answers the team's needs well enough to be offered where it was not measured. */
export function answersDraft(id: number, team: Needs, reads: Map<number, ItemRead>, tags: (id: number) => string[], due: Resist[] = []): boolean {
  const fit = fitOf([id], team, reads, tags, { due })
  return !fit.misfit && fit.fit >= 0.35
}
