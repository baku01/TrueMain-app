import type { FitRead, ItemRead } from '~/utils/jev-read'
import type { Answer, Needs, Resist } from '~/utils/jev-needs'
import type { PickRead } from '~/utils/jev-read-pick'
import type { JevOption, JevSlot, LaidBuild, SlotKind } from '~/utils/jev-build'
import type { ItemSetBuild } from '~/utils/item-set'
import { MIN_GAMES } from '~/utils/jev-build'
import { fitOf } from '~/utils/jev-needs'
import { edgesOf, statsPart } from '~/utils/jev-stats'

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
 *    kit, weighed as `WEIGHTS` says — the kit only as far as the option's
 *    games are few (`modeled`).
 * 5. The pick: the slot's most played option, unless another has a reason to
 *    take its place and does not win credibly less (`DEVIATE`, `reasonOf`) —
 *    then the highest total of those and the most played.
 */

export type { Answer, EnemyLine, Fit, Needs } from '~/utils/jev-needs'
export { NEEDS, answersDraft, fitOf, laneNeeds, needsOf } from '~/utils/jev-needs'

/**
 * How the parts weigh in a total, by what the slot is. A part missing
 * (unread, unmeasured) gives its weight to the others; an item's kit weighs
 * its share only on thin evidence (`modeled`).
 */
export const WEIGHTS: Record<'item' | 'starter' | 'choice' | 'skills', Partial<Record<keyof Parts, number>>> = {
  item: { stats: 0.4, draft: 0.35, kit: 0.25 },
  starter: { stats: 0.5, lane: 0.5 },
  choice: { stats: 0.5, lane: 0.5 },
  skills: { stats: 1 },
}

/**
 * How much of its weight Jev's read of how an item suits our champion keeps,
 * by the option's games: all of it under `MIN_GAMES` — LoLTheory's own 30, under
 * which it shows a "Modeled" win rate that pulls from similar builds instead of
 * the observed one — then as `MIN_GAMES / games`, a tenth at 300 games, a
 * hundredth at 3,000. The read is an opinion no game confirmed: where the
 * games speak, it only breaks a tie.
 */
export const modeled = (games: number): number => Math.min(1, MIN_GAMES / Math.max(games, 1))

/** The parts of an option's total, each 0–1; absent where the slot has none. */
export interface Parts {
  stats?: number
  draft?: number
  kit?: number
  lane?: number
}

/**
 * Why an option may take the place of the slot's most played: an edge its
 * games prove (`edge`, in win rate, over the most played), a need of the
 * enemy team it answers that the most played does not (`need`; null where
 * the most played defends only against damage the team barely deals), or a
 * lane Jev read it suits clearly better (`fit` against the most played's).
 */
export type DeviationReason =
  | { kind: 'proven', edge: number }
  | { kind: 'draft', need: keyof Needs | null }
  | { kind: 'lane', fit: number, standard: number }

export interface Scored {
  total: number
  parts: Parts
  answers: Answer[]
  misfit: boolean
  /** Its reason to take the most played's place, where it has one (`reasonOf`). */
  reason?: DeviationReason
}

export interface RankedSlot {
  slot: JevSlot
  /** The option taken: the most played, unless another has a reason to take its place (`DEVIATE`). */
  pick: JevOption
  /** The most played option. */
  standard: JevOption
  scored: Record<string, Scored>
  /** Why the pick is not the most played; absent where it is. */
  reason?: DeviationReason
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

/**
 * What it takes to part from the slot's most played option. The most played
 * is what thousands of players of the bracket chose, and a source shows it
 * first: Buildzcrank leads with it, shows its "highest win rate" apart and only
 * over a few hundred games (342 its fewest), and falls back to the most common
 * build where a role has too few; Blitz shows the most played. LoLTheory's
 * score is win rate and popularity together — ten times less play costs about
 * six or seven points of win rate — and its blog builds defensively only when
 * the draft calls for it. Before, a stats part even with the most played's
 * (most slots: no option proven different) left the pick to Jev's read of the
 * kit, and rare items it liked beat what the bracket builds. So an option
 * takes the most played's place only with a reason (`reasonOf`):
 * - `proven`: its credible edge over the most played (`utils/jev-stats`, at
 *   its 95% lower bound) is half a point of win rate or more — 0.62 on the
 *   stats part;
 * - `draft` (items, boots): it answers a need of the enemy team by a quarter
 *   of the need more than the most played answers it, and its draft part
 *   stands a quarter of the scale above the most played's — its fit, times
 *   what our champion makes of it, higher by half. A resistance a rule makes
 *   due, armor into physical burst, Grievous Wounds into heavy healing,
 *   Tenacity into heavy crowd control get there; armor boots a marksman half
 *   uses, into a physical lane without burst, do not;
 * - `lane` (runes, spells, starters): Jev read it suits the lane opponent by
 *   0.3 more than the most played, with a confidence of 0.7 or more.
 * And none of them where it wins credibly less: a shortfall of a point or
 * more (0.27 on the stats part), twice the edge a deviation must prove — a
 * shortfall counts at its estimate, not at a bound, and what the measures
 * average over every draft is not this draft, which a reason answers. A
 * misfit never takes the place; a misfit most played gives it to any option
 * that is not one, as its halved score always did. The skill order (its
 * statistics alone already keep the most played) and the boots' timing (no
 * most played: the lane's urgency places it) keep the highest total.
 */
export const DEVIATE = {
  proven: 0.005,
  worse: -0.01,
  draft: 0.25,
  answer: 0.25,
  lane: { margin: 0.3, confidence: 0.7 },
} as const

/** The slots whose pick is the most played unless an option has a reason (`DEVIATE`). */
const BY_REASON: SlotKind[] = ['item', 'boots', 'runes', 'spells', 'starter']

/** The need `answers` answers most beyond what `standard` answers of it, and by how much. */
function gained(answers: Answer[], standard: Answer[]): Answer | null {
  return answers
    .map(answer => ({ need: answer.need, value: answer.value - (standard.find(other => other.need === answer.need)?.value ?? 0) }))
    .reduce<Answer | null>((best, answer) => (answer.value > (best?.value ?? 0) ? answer : best), null)
}

/**
 * Why an option (`mine`) may take the place of the slot's most played
 * (`theirs`), as `DEVIATE` says, or null: the first that holds of a misfit
 * most played, a proven edge, the draft and the lane — `edge` the option's
 * over the most played, `fits` Jev's lane reads of both.
 */
function reasonOf(kind: SlotKind, mine: Scored, theirs: Scored, edge: number | null, fits: { mine?: FitRead, theirs?: FitRead }): DeviationReason | null {
  if (mine.misfit) return null
  const items = kind === 'item' || kind === 'boots'
  if (items && theirs.misfit) return { kind: 'draft', need: gained(mine.answers, theirs.answers)?.need ?? null }
  if ((edge ?? 0) <= DEVIATE.worse) return null
  if ((edge ?? 0) >= DEVIATE.proven) return { kind: 'proven', edge: edge! }
  if (items) {
    const answer = gained(mine.answers, theirs.answers)
    if (answer && answer.value >= DEVIATE.answer && (mine.parts.draft ?? 0.5) - (theirs.parts.draft ?? 0.5) >= DEVIATE.draft) return { kind: 'draft', need: answer.need }
  }
  else if (fits.mine && fits.mine.confidence >= DEVIATE.lane.confidence) {
    const standard = fits.theirs?.fit ?? 0.5
    if (fits.mine.fit - standard >= DEVIATE.lane.margin) return { kind: 'lane', fit: fits.mine.fit, standard }
  }
  return null
}

/** Every option of a slot scored, and the one it takes. */
export function rankSlot(slot: JevSlot, context: RankContext): RankedSlot {
  const edges = edgesOf(slot.options, slot.kind === 'item' ? 'item' : slot.kind === 'boots' ? 'boots' : 'choice')
  const scored: Record<string, Scored> = {}
  const fits: Record<string, FitRead | undefined> = {}
  for (const option of slot.options) {
    const parts: Parts = {}
    const edge = edges[option.key]
    if (edge !== null && edge !== undefined) parts.stats = statsPart(edge)
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
      weights = { ...WEIGHTS.item, kit: WEIGHTS.item.kit! * modeled(option.games) }
    }
    else if (slot.kind === 'starter') {
      const fit = context.fits[`st_${option.key}`]
      if (fit) parts.lane = fit.fit
      fits[option.key] = fit
      weights = WEIGHTS.starter
    }
    else if (slot.kind === 'runes' || slot.kind === 'spells') {
      const fit = context.fits[`${slot.kind === 'runes' ? 'r' : 's'}_${option.key}`]
      if (fit) parts.lane = fit.fit
      fits[option.key] = fit
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
  const standard = slot.options[0]!
  const best = (options: JevOption[]) => options.reduce((top, option) => (scored[option.key]!.total > scored[top.key]!.total + 1e-9 ? option : top), options[0]!)
  if (!BY_REASON.includes(slot.kind)) return { slot, pick: best(slot.options), standard, scored }
  const others = slot.options.slice(1)
  for (const option of others) {
    const reason = reasonOf(slot.kind, scored[option.key]!, scored[standard.key]!, edges[option.key] ?? null, { mine: fits[option.key], theirs: fits[standard.key] })
    if (reason) scored[option.key]!.reason = reason
  }
  // Among the options with a reason and the most played, the highest total; the most played on a tie.
  const pick = best([standard, ...others.filter(option => scored[option.key]!.reason)])
  return { slot, pick, standard, scored, ...(pick !== standard ? { reason: scored[pick.key]!.reason } : {}) }
}

/**
 * A reason as the line the build shows under a pick that is not the most
 * played: its message key and parameters, the proven edge in points of win
 * rate written as `locale` writes numbers.
 */
export function reasonMessage(reason: DeviationReason, locale?: string): { key: string, params?: Record<string, string> } {
  if (reason.kind === 'proven') return { key: 'jev.reason.proven', params: { points: (reason.edge * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) } }
  if (reason.kind === 'draft') return { key: `jev.reason.draft.${reason.need ?? 'misfit'}` }
  return { key: 'jev.reason.lane' }
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
