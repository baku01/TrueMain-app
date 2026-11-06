import type { FitRead, ItemRead } from '~/utils/jev-read'
import type { Answer, Needs, Resist } from '~/utils/jev-needs'
import type { PickRead } from '~/utils/jev-read-pick'
import type { JevOption, JevSlot, LaidBuild } from '~/utils/jev-build'
import type { ItemSetBuild } from '~/utils/item-set'
import { fitOf } from '~/utils/jev-needs'
import { statsOf } from '~/utils/jev-stats'

/**
 * The Jev matchup page's ranking, all arithmetic and all in code — TypeSafe's
 * "composite scoring": the judgments Jev made on texts (`utils/jev-read`) are
 * combined here with weights that stay visible, beside what lolalytics and
 * Blitz measured.
 *
 * 1. The enemy team's needs (`utils/jev-needs`): its damage split from
 *    Blitz's measured profiles, each champion weighed by the damage it deals,
 *    and what Jev read of each kit — crowd control, healing, burst, basic
 *    attacks, tankiness — as what stands out of a usual team. The lane
 *    opponent alone weighs more on what is bought or set while laning.
 * 2. Each item option's fit to those needs (`fitOf`): armour against physical
 *    damage, magic resist against magic (Riot's own item tags), and each fact
 *    Jev read of the item against the need it answers (Tenacity against crowd
 *    control, Grievous Wounds against healing…). An item that defends only
 *    against the damage the team does not deal is a misfit, and weighs half.
 *    LoLTheory's draft rules (`utils/jev-rules`) make a resistance due by an
 *    item slot, and keep a build to one Grievous Wounds item.
 * 3. Each option's measured signal: its win rate shrunk toward its slot's by
 *    its sample, and what Blitz measures it adds to the win probability over
 *    the slot's — only where every option of the slot was measured so.
 * 4. The total: statistics, the draft and how well it suits our champion's
 *    kit, weighed as `WEIGHTS` says; the slot takes the highest.
 */

export type { Answer, EnemyLine, Fit, Needs } from '~/utils/jev-needs'
export { NEEDS, answersDraft, fitOf, laneNeeds, needsOf } from '~/utils/jev-needs'

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
  /** The resistances a draft rule makes due at this slot (`utils/jev-rules`). */
  due?: Resist[]
}

function total(parts: Parts, weights: Partial<Record<keyof Parts, number>>): number {
  const present = (Object.keys(weights) as (keyof Parts)[]).filter(part => parts[part] !== undefined)
  const weight = present.reduce((sum, part) => sum + weights[part]!, 0)
  return weight ? present.reduce((sum, part) => sum + weights[part]! * parts[part]!, 0) / weight : 0
}

/** A draft whose damage is physical and comes in bursts: armor answers it whatever our champion makes of armor. */
const PHYSICAL_BURST = { physical: 0.8, burst: 0.5 }

/** Every option of a slot scored, and the one it takes. */
export function rankSlot(slot: JevSlot, context: RankContext): RankedSlot {
  const stats = statsOf(slot.options, slot.kind === 'item' ? 'item' : slot.kind === 'boots' ? 'boots' : 'choice')
  const scored: Record<string, Scored> = {}
  for (const option of slot.options) {
    const parts: Parts = {}
    if (stats[option.key] !== null && stats[option.key] !== undefined) parts.stats = stats[option.key]!
    let answers: Answer[] = []
    let misfit = false
    let weights = WEIGHTS.choice
    if (slot.kind === 'item' || slot.kind === 'boots') {
      const fit = fitOf(option.itemIds, slot.lane ? context.lane : context.team, context.itemReads, context.tags, { due: context.due })
      const reads = option.itemIds.map(id => context.itemReads.get(id)).filter(read => !!read)
      if (reads.length) parts.kit = reads.reduce((sum, read) => sum + read.kit, 0) / reads.length
      // Answering nothing of the draft is neutral, not a fault: a damage item answers it by killing.
      // And an answer counts as far as our champion makes use of the item: armor boots answer a physical lane, not for a marksman —
      // unless what the armor answers is physical burst, assassins that kill the marksman before it attacks
      // (LoLTheory: Plated Steelcaps for a marksman into an AD assassin, blog.loltheory.gg/what-is-armor-league-of-legends).
      const needs = slot.lane ? context.lane : context.team
      const intoBurst = needs.physical >= PHYSICAL_BURST.physical && needs.burst >= PHYSICAL_BURST.burst && fit.answers.some(answer => answer.need === 'physical')
      parts.draft = 0.5 + 0.5 * fit.fit * (intoBurst ? 1 : parts.kit ?? 1)
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

/** How a pick's parts weigh: the source's own ranking, then the lane, the team and the enemy team as Jev read them. */
export const PICK_WEIGHTS = { stats: 0.4, lane: 0.25, team: 0.2, enemy: 0.15 } as const

export interface PickParts { stats: number, lane?: number, team?: number, enemy?: number }
export interface RankedPick { championId: number, total: number, parts: PickParts, confidence: number | null }

/**
 * The champions we could pick, ranked: the source's ranking key (its own
 * mix of matchup, strength and synergy, measured) as where each stands among
 * these candidates — 0.5 the middle of them — beside what Jev read of the
 * lane, our team and the enemy team, weighed as `PICK_WEIGHTS` says, a part
 * Jev did not read giving its weight to the others.
 */
export function rankPicks(candidates: { championId: number, score: number }[], reads: Map<number, PickRead>): RankedPick[] {
  if (!candidates.length) return []
  const mean = candidates.reduce((sum, candidate) => sum + candidate.score, 0) / candidates.length
  const spread = Math.sqrt(candidates.reduce((sum, candidate) => sum + (candidate.score - mean) ** 2, 0) / candidates.length)
  return candidates.map((candidate) => {
    const read = reads.get(candidate.championId)
    const parts: PickParts = { stats: spread > 0 ? 1 / (1 + Math.exp(-(candidate.score - mean) / spread)) : 0.5 }
    if (read?.lane !== null && read?.lane !== undefined) parts.lane = read.lane
    if (read?.team !== null && read?.team !== undefined) parts.team = read.team
    if (read?.enemy !== null && read?.enemy !== undefined) parts.enemy = read.enemy
    const present = (Object.keys(PICK_WEIGHTS) as (keyof PickParts)[]).filter(part => parts[part] !== undefined)
    const weight = present.reduce((sum, part) => sum + PICK_WEIGHTS[part], 0)
    const total = present.reduce((sum, part) => sum + PICK_WEIGHTS[part] * parts[part]!, 0) / weight
    return { championId: candidate.championId, total, parts, confidence: read?.confidence ?? null }
  }).sort((a, b) => b.total - a.total)
}

/**
 * A build as the client's item set, laid out as Blitz's: its starter, its
 * boots where the build buys them, every item in buying order (the final
 * build), then as situational every other item its slots offered, best score
 * first — what also suits this draft when the game asks for it.
 */
export function itemSetOf(ranked: RankedSlot[], build: LaidBuild): ItemSetBuild {
  const boots = build.boots?.itemIds ?? []
  const core = build.order.filter(id => !boots.includes(id))
  const at = build.order.findIndex(id => boots.includes(id))
  const offered = ranked
    .filter(entry => entry.slot.kind === 'item')
    .flatMap(entry => entry.slot.options.map(option => ({ id: option.itemIds[0]!, score: entry.scored[option.key]?.total ?? 0 })))
    .filter(option => !core.includes(option.id))
    .sort((a, b) => b.score - a.score)
  return { starter: build.starterItems?.itemIds ?? [], boots, core, situational: [...new Set(offered.map(option => option.id))], bootsAt: at >= 0 ? at : undefined }
}
