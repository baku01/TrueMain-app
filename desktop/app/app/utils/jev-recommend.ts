import type { ChampionRead, FitRead, ItemRead } from '~/utils/jev-read'
import type { JevOption, JevSlot } from '~/utils/jev-build'
import { MIN_GAMES } from '~/utils/jev-build'

/**
 * The Jev matchup page's ranking, all arithmetic and all in code — TypeSafe's
 * "composite scoring": the judgments Jev made on texts (`utils/jev-read`) are
 * combined here with weights that stay visible, beside what lolalytics and
 * Blitz measured.
 *
 * 1. The enemy team's needs: its damage split from Blitz's measured profiles,
 *    each champion weighed by the damage it deals, and what Jev read of each
 *    kit — crowd control, healing, burst, basic attacks, tankiness — as what
 *    stands out of a usual team. The lane opponent alone weighs more on
 *    what is bought or set while laning.
 * 2. Each item option's fit to those needs: armour against physical damage,
 *    magic resist against magic (Riot's own item tags), and each fact Jev read
 *    of the item against the need it answers (Tenacity against crowd control,
 *    Grievous Wounds against healing…). An item that defends only against the
 *    damage the team does not deal is a misfit, and weighs half.
 * 3. Each option's measured signal: its win rate shrunk toward its slot's by
 *    its sample, and what Blitz measures it adds to the win probability over
 *    the slot's — only where every option of the slot was measured so.
 * 4. The total: statistics, the draft and how well it suits our champion's
 *    kit, weighed as `WEIGHTS` says; the slot takes the highest.
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
 * or every defensive item would answer every draft.
 */
const USUAL: Record<'cc' | 'heal' | 'burst' | 'tank', { usual: number, more: number }> = {
  cc: { usual: 2, more: 1.5 },
  heal: { usual: 1, more: 1.5 },
  burst: { usual: 1, more: 1.5 },
  tank: { usual: 1, more: 1.5 },
}

/** The share of damage dealt with basic attacks a usual team has, and how much more makes the need full. */
const USUAL_AUTOS = { usual: 0.25, more: 0.5 }

/**
 * What a team throws at us, each 0–1: the damage split weighed by what each
 * champion deals (a share, as measured); the rest as what stands out of a
 * usual team of as many — crowd control, healing, burst and tankiness summed
 * over the champions, the basic-attack share weighed by damage — 0 at the
 * usual, 1 well past it.
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
  return {
    physical: weighed(enemy => enemy.physical),
    magic: weighed(enemy => enemy.magic),
    cc: past('cc'),
    heal: past('heal'),
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
 * of the damage past an even split, Jev's facts against the rest.
 */
export function fitOf(itemIds: number[], needs: Needs, reads: Map<number, ItemRead>, tags: (id: number) => string[]): Fit {
  if (!itemIds.length) return { fit: 0, answers: [], misfit: false }
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
    const defensiveOnly = (has.physical || has.magic) && !own.some(tag => OFFENSIVE.includes(tag))
    const misfit = defensiveOnly && (
      (has.physical && !has.magic && needs.physical < LITTLE)
      || (has.magic && !has.physical && needs.magic < LITTLE && !(has.cc > 0.5 && needs.cc >= HEAVY_CC))
    )
    return { has, misfit: !!misfit }
  })
  const calls: Needs = { ...needs, physical: resistNeed(needs.physical), magic: resistNeed(needs.magic) }
  const answers = NEEDS
    .map(need => ({ need, value: per.reduce((sum, item) => sum + item.has[need], 0) / per.length * calls[need] }))
    .filter(answer => answer.value >= 0.12)
    .sort((a, b) => b.value - a.value)
  const raw = answers.reduce((sum, answer) => sum + answer.value, 0)
  return { fit: 1 - Math.exp(-1.6 * raw), answers, misfit: per.some(item => item.misfit) }
}

const known = (value: number | null | undefined): value is number => value !== null && value !== undefined

/**
 * The win probability added each option of a slot is weighed by, or null when
 * the slot cannot be compared on it: only when every measured option has it
 * (an option Blitz did not measure would otherwise read as even, and beat
 * every option measured below even — boots all read negative), against the
 * lane opponent only when every one has the matchup's games, blended 60/40
 * with the lane's; centred on the slot's own average, so what a slot's items
 * share (every boots' timing) does not count.
 */
export function slotWpa(options: JevOption[]): ((option: JevOption) => number) | null {
  const measuredOptions = options.filter(option => option.games > 0)
  if (!measuredOptions.length || !measuredOptions.every(option => known(option.wpa))) return null
  const versus = measuredOptions.every(option => known(option.vsWpa) && (option.vsGames ?? 0) >= MIN_GAMES)
  const raw = (option: JevOption) => (versus ? 0.6 * option.vsWpa! + 0.4 * option.wpa! : option.wpa!)
  const games = measuredOptions.reduce((sum, option) => sum + option.games, 0)
  const mean = measuredOptions.reduce((sum, option) => sum + raw(option) * option.games, 0) / games
  return option => (known(option.wpa) ? raw(option) - mean : 0)
}

/**
 * Games of the slot's own win rate an option's is pulled toward: a win rate
 * over a thousand games is about as uncertain (±1.6 points) as options of one
 * slot usually differ, so a rare option's high win rate counts for little.
 */
const PRIOR_GAMES = 1000

/** How far over its slot an option's signal must be to read about 0.73: three points of win rate. */
const SPREAD = 0.03

/**
 * Each option's measured signal on 0–1 (0.5 even with its slot): its win rate
 * shrunk toward the slot's by its sample, plus half its win probability added
 * over the slot's (`slotWpa`); three points over the slot read about 0.73.
 * Null for an option nothing measured.
 */
export function statsOf(options: JevOption[]): Record<string, number | null> {
  const measuredOptions = options.filter(option => option.games > 0)
  const games = measuredOptions.reduce((sum, option) => sum + option.games, 0)
  if (!games) return Object.fromEntries(options.map(option => [option.key, null]))
  const average = measuredOptions.reduce((sum, option) => sum + option.winRate * option.games, 0) / games
  const wpa = slotWpa(options)
  return Object.fromEntries(options.map((option) => {
    if (!option.games) return [option.key, null]
    const shrunk = (option.winRate * option.games + average * PRIOR_GAMES) / (option.games + PRIOR_GAMES)
    const signal = shrunk - average + 0.5 * (wpa ? wpa(option) : 0)
    return [option.key, 1 / (1 + Math.exp(-signal / SPREAD))]
  }))
}

/** How the parts weigh in a total, by what the slot is. A part missing (unread, unmeasured) gives its weight to the others. */
export const WEIGHTS: Record<'item' | 'starter' | 'choice' | 'skills', Partial<Record<keyof Parts, number>>> = {
  item: { stats: 0.4, draft: 0.35, kit: 0.25 },
  starter: { stats: 0.5, lane: 0.5 },
  choice: { stats: 0.5, lane: 0.5 },
  skills: { stats: 1 },
}

/** The parts of an option's total, each 0–1; absent where the slot has none. */
export interface Parts {
  stats?: number
  draft?: number
  kit?: number
  lane?: number
}

export interface Scored {
  total: number
  parts: Parts
  answers: Answer[]
  misfit: boolean
}

export interface RankedSlot {
  slot: JevSlot
  /** The option with the highest total. */
  pick: JevOption
  /** The most played option. */
  standard: JevOption
  scored: Record<string, Scored>
}

export interface RankContext {
  team: Needs
  lane: Needs
  itemReads: Map<number, ItemRead>
  tags: (id: number) => string[]
  /** Jev's fit of each lane choice, by `r_o0` (rune page), `s_o0` (spells), `st_o0` (starter). */
  fits: Record<string, FitRead>
  /** How soon boots are needed, 0 (after the first item is fine) to 1 (before it). */
  urgency: number | null
}

function total(parts: Parts, weights: Partial<Record<keyof Parts, number>>): number {
  const present = (Object.keys(weights) as (keyof Parts)[]).filter(part => parts[part] !== undefined)
  const weight = present.reduce((sum, part) => sum + weights[part]!, 0)
  return weight ? present.reduce((sum, part) => sum + weights[part]! * parts[part]!, 0) / weight : 0
}

/** Every option of a slot scored, and the one it takes. */
export function rankSlot(slot: JevSlot, context: RankContext): RankedSlot {
  const stats = statsOf(slot.options)
  const scored: Record<string, Scored> = {}
  for (const option of slot.options) {
    const parts: Parts = {}
    if (stats[option.key] !== null && stats[option.key] !== undefined) parts.stats = stats[option.key]!
    let answers: Answer[] = []
    let misfit = false
    let weights = WEIGHTS.choice
    if (slot.kind === 'item' || slot.kind === 'boots') {
      const fit = fitOf(option.itemIds, slot.lane ? context.lane : context.team, context.itemReads, context.tags)
      const reads = option.itemIds.map(id => context.itemReads.get(id)).filter(read => !!read)
      if (reads.length) parts.kit = reads.reduce((sum, read) => sum + read.kit, 0) / reads.length
      // Answering nothing of the draft is neutral, not a fault: a damage item answers it by killing.
      // And an answer counts as far as our champion makes use of the item: armor boots answer a physical lane, not for a marksman.
      parts.draft = 0.5 + 0.5 * fit.fit * (parts.kit ?? 1)
      answers = fit.answers
      misfit = fit.misfit
      weights = WEIGHTS.item
    }
    else if (slot.kind === 'starter') {
      const fit = context.fits[`st_${option.key}`]
      if (fit) parts.lane = fit.fit
      weights = WEIGHTS.starter
    }
    else if (slot.kind === 'runes' || slot.kind === 'spells') {
      const fit = context.fits[`${slot.kind === 'runes' ? 'r' : 's'}_${option.key}`]
      if (fit) parts.lane = fit.fit
    }
    else if (slot.kind === 'skills') {
      weights = WEIGHTS.skills
    }
    else if (slot.kind === 'timing' && context.urgency !== null) {
      // Before the first item when the lane needs boots now, after the second when it can wait.
      const after = option.after ?? 1
      parts.lane = after === 0 ? context.urgency : after === 1 ? 1 - Math.abs(context.urgency - 0.5) * 2 : 1 - context.urgency
    }
    scored[option.key] = { total: total(parts, weights) * (misfit ? 0.5 : 1), parts, answers, misfit }
  }
  const pick = slot.options.reduce((best, option) => (scored[option.key]!.total > scored[best.key]!.total + 1e-9 ? option : best), slot.options[0]!)
  return { slot, pick, standard: slot.options[0]!, scored }
}

/** Whether an item answers the team's needs well enough to be offered where it was not measured. */
export function answersDraft(id: number, team: Needs, reads: Map<number, ItemRead>, tags: (id: number) => string[]): boolean {
  const fit = fitOf([id], team, reads, tags)
  return !fit.misfit && fit.fit >= 0.35
}
