import type { FitRead, ItemRead } from '~/utils/jev-read'
import type { Answer, Needs, Resist } from '~/utils/jev-needs'
import type { PickRead } from '~/utils/jev-read-pick'
import type { JevOption, JevSlot, LaidBuild, SlotKind } from '~/utils/jev-build'
import type { ItemSetBuild, PlaceItemBlock } from '~/utils/item-set'
import { MIN_GAMES } from '~/utils/jev-build'
import { PLACE_ALTERNATIVES } from '~/utils/item-set'
import { STANDS_OUT, answerTo, fitOf } from '~/utils/jev-needs'
import { edgesOf, shareOf, statsPart } from '~/utils/jev-stats'

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
 *    kit, weighed as `WEIGHTS` says — an item's draft the more the later it is
 *    bought, the kit only as far as the option's games are few (`modeled`).
 * 5. The pick, as the AI builders pick (Hexgate, LoLDraftAI, iTero: the
 *    statistics make the pool, the draft ranks inside it): the highest total
 *    of the slot's popular options (`POPULAR`); a rarer option only with a
 *    reason (`DEVIATE`, `reasonOf`); none that wins credibly less.
 */

export type { Answer, EnemyLine, Fit, Needs } from '~/utils/jev-needs'
export { NEEDS, STANDS_OUT, answerTo, answersDraft, callsOf, draftNeeds, fitOf, laneNeeds, needsOf } from '~/utils/jev-needs'

export type Weights = Partial<Record<keyof Parts, number>>

/**
 * How the parts weigh in a total, by what the slot is. A part missing
 * (unread, unmeasured) gives its weight to the others; an item's kit weighs
 * its share only on thin evidence (`modeled`).
 *
 * An item's weights go by its place in the buying order (`itemWeights`): the
 * draft weighs the more the later the item. The first item is the lane's and
 * what nearly every player of the champion rushes, its measures the densest;
 * past it the measures thin out — Hexgate falls back from the bought path to
 * the slot's pool under 50 games — while the draft's answers fall due: armor
 * by the second item, magic resist by the third (LoLTheory's rules,
 * `utils/jev-rules`). LoLDraftAI weighs the draft at every purchase. The
 * numbers are a judgment, not a measure: the second item keeps the weights
 * every item had before.
 */
export const WEIGHTS: { item: readonly Weights[], boots: Weights, starter: Weights, choice: Weights, skills: Weights } = {
  item: [
    { stats: 0.45, draft: 0.3, kit: 0.25 },
    { stats: 0.4, draft: 0.35, kit: 0.25 },
    { stats: 0.3, draft: 0.45, kit: 0.25 },
  ],
  boots: { stats: 0.4, draft: 0.35, kit: 0.25 },
  starter: { stats: 0.5, lane: 0.5 },
  choice: { stats: 0.5, lane: 0.5 },
  skills: { stats: 1 },
}

/** An item's weights at its place in the buying order (1 the first completed item); the last row from the third item on, and where the place is not known. */
export const itemWeights = (place?: number): Weights => WEIGHTS.item[Math.min(Math.max(place ?? WEIGHTS.item.length, 1), WEIGHTS.item.length) - 1]!

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
 * the most played defends only against damage the team barely deals), a
 * lane Jev read it suits better (`fit` against the most played's), or — for a
 * popular option alone (`POPULAR`) — Jev's read that it suits our champion's
 * kit better.
 */
export type DeviationReason =
  | { kind: 'proven', edge: number }
  | { kind: 'draft', need: keyof Needs | null }
  | { kind: 'lane', fit: number, standard: number }
  | { kind: 'kit' }

export interface Scored {
  total: number
  parts: Parts
  /** The weights its total was made with. */
  weights: Weights
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
  /** The items a slot before gave up for its pick: one leading this slot is taken (`rankSlot`). */
  owed?: number[]
}

function total(parts: Parts, weights: Weights): number {
  const present = (Object.keys(weights) as (keyof Parts)[]).filter(part => parts[part] !== undefined)
  const weight = present.reduce((sum, part) => sum + weights[part]!, 0)
  return weight ? present.reduce((sum, part) => sum + weights[part]! * parts[part]!, 0) / weight : 0
}

/**
 * A draft whose damage is of one kind and comes in bursts: boots of that
 * resistance answer it whatever our champion makes of them — Plated Steelcaps
 * against assassins that kill a marksman before it attacks, Mercury's Treads
 * against mages whose combo kills an assassin before his own lands. Boots
 * only: on an item the kit still weighs, or a tank's Randuin's Omen took a
 * marksman's third item.
 */
const RESIST_BURST = { share: 0.8, burst: 0.5 }

/**
 * When the pick parts from the slot's most played option, which the sources
 * show first (Buildzcrank leads with it; Blitz shows it). The AI builders do
 * not keep it: Hexgate ranks the champion's measured items at the slot by the
 * enemy team, LoLDraftAI takes each purchase's best predicted win rate given
 * the draft, iTero's model weighs the draft's features — the statistics make
 * the pool, the draft ranks inside it. So a popular option (`POPULAR`)
 * competes on its total: the highest of them is taken, a total within
 * `POPULAR.margin` of the most played's a tie the most played keeps (Hexgate
 * pins its first pick against flicker). A rarer option is mostly the games of
 * the players and situations that pick it (`utils/jev-stats`), and a rare
 * item Jev's read liked used to beat what the bracket builds; it takes the
 * place only with a reason (`reasonOf`):
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
 *   0.3 more than the most played, with a confidence of 0.7 or more;
 * - `due` (items): it holds a resistance a rule makes due at this place
 *   (`utils/jev-rules`) that the most played does not — the rule is the
 *   reason, no margin to clear, and a shortfall is read against twice the bar
 *   (`DEVIATE.due`): the rule is LoLTheory's, not Jev's read, and the measures
 *   average over every draft, most of which do not call for it (Maw of
 *   Malmortius on Zed reads 1.4 points short of Lord Dominik's Regards over
 *   all of Zed's games, against five magic damage dealers as against none).
 * And never one that wins credibly less, popular or not: a shortfall of a
 * point or more (0.27 on the stats part), twice the edge a deviation must
 * prove — a shortfall counts at its estimate, not at a bound, and what the
 * measures average over every draft is not this draft, which a reason
 * answers. A misfit never takes the place; a misfit most played gives it to
 * any option that is not one, as its halved score always did. The skill
 * order (its statistics alone already keep the most played) and the boots'
 * timing (no most played: the lane's urgency places it) keep the highest
 * total.
 */
export const DEVIATE = {
  proven: 0.005,
  worse: -0.01,
  due: -0.02,
  draft: 0.25,
  answer: 0.25,
  lane: { margin: 0.3, confidence: 0.7 },
} as const

/**
 * The share of the slot's games from which an option competes with the most
 * played on its total (`share`), and the total it must beat the most
 * played's by (`margin`) — about a fifth of a point of win rate on the stats
 * part, a tenth of an item's fit to the draft. What one player in ten of the
 * bracket builds there is a build, not a rumour: its win rate carries little
 * of the selection a rare option's does (`SELECTION`, `0.63·ln(1/share)`
 * points: 1.5 at a tenth against 2.9 at a hundredth). It still needs its
 * games (`MIN_GAMES`); an option added from the champion's pool, not measured
 * at the slot (`situational`), never is one.
 */
export const POPULAR = { share: 0.1, margin: 0.02 } as const

/** The slots whose pick is the most played unless an option has a reason (`DEVIATE`). */
const BY_REASON: SlotKind[] = ['item', 'boots', 'runes', 'spells', 'starter']

/** The need `answers` answers most beyond what `standard` answers of it, and by how much. */
function gained(answers: Answer[], standard: Answer[]): Answer | null {
  return answers
    .map(answer => ({ need: answer.need, value: answer.value - (standard.find(other => other.need === answer.need)?.value ?? 0) }))
    .reduce<Answer | null>((best, answer) => (answer.value > (best?.value ?? 0) ? answer : best), null)
}

/**
 * Why a popular option's total beats the most played's: the part that gains
 * it the most, weighed as its total weighs it — the edge its games show, the
 * need it answers that the most played does not, the lane Jev read it suits,
 * or Jev's read of our champion's kit. Null where no part explains it.
 */
function leadOf(mine: Scored, theirs: Scored, edge: number | null, fits: { mine?: FitRead, theirs?: FitRead }): DeviationReason | null {
  const gains = (Object.keys(mine.weights) as (keyof Parts)[])
    .filter(part => mine.parts[part] !== undefined)
    .map(part => ({ part, gain: mine.weights[part]! * (mine.parts[part]! - (theirs.parts[part] ?? 0.5)) }))
    .filter(entry => entry.gain > 0)
    .sort((a, b) => b.gain - a.gain)
  for (const { part } of gains) {
    if (part === 'stats' && (edge ?? 0) > 0) return { kind: 'proven', edge: edge! }
    const need = part === 'draft' ? gained(mine.answers, theirs.answers)?.need : undefined
    if (need) return { kind: 'draft', need }
    if (part === 'lane' && fits.mine) return { kind: 'lane', fit: fits.mine.fit, standard: fits.theirs?.fit ?? 0.5 }
    if (part === 'kit') return { kind: 'kit' }
  }
  return null
}

/**
 * Why an option (`mine`) may take the place of the slot's most played
 * (`theirs`), as `DEVIATE` says, or null: the first that holds of a misfit
 * most played, a due resistance, a proven edge, a popular option's higher
 * total (`POPULAR`), the draft and the lane — `edge` the option's over the
 * most played, `fits` Jev's lane reads of both, `due` the resistances a rule
 * makes due at the slot.
 */
function reasonOf(kind: SlotKind, mine: Scored, theirs: Scored, edge: number | null, fits: { mine?: FitRead, theirs?: FitRead }, popular: boolean, due: Resist[]): DeviationReason | null {
  if (mine.misfit) return null
  const items = kind === 'item' || kind === 'boots'
  if (items && theirs.misfit) return { kind: 'draft', need: gained(mine.answers, theirs.answers)?.need ?? null }
  const owed = items ? due.find(resist => answerTo(mine.answers, resist) >= STANDS_OUT && answerTo(theirs.answers, resist) < STANDS_OUT) : undefined
  if (owed && (edge ?? 0) > DEVIATE.due) return { kind: 'draft', need: owed }
  if ((edge ?? 0) <= DEVIATE.worse) return null
  if ((edge ?? 0) >= DEVIATE.proven) return { kind: 'proven', edge: edge! }
  if (popular) return mine.total - theirs.total > POPULAR.margin ? leadOf(mine, theirs, edge, fits) : null
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
    let weights: Weights = WEIGHTS.choice
    if (slot.kind === 'item' || slot.kind === 'boots') {
      const fit = fitOf(option.itemIds, slot.lane ? context.lane : context.team, context.itemReads, context.tags, { due: context.due })
      const reads = option.itemIds.map(id => context.itemReads.get(id)).filter(read => !!read)
      if (reads.length) parts.kit = reads.reduce((sum, read) => sum + read.kit, 0) / reads.length
      // Answering nothing of the draft is neutral, not a fault: a damage item answers it by killing.
      // And an answer counts as far as our champion makes use of the item: armor boots answer a physical lane, not for a marksman —
      // unless what the resistance answers is burst of its kind, assassins that kill the marksman before it attacks
      // (LoLTheory: Plated Steelcaps for a marksman into an AD assassin, blog.loltheory.gg/what-is-armor-league-of-legends),
      // magic burst alike (`RESIST_BURST`).
      const needs = slot.lane ? context.lane : context.team
      const intoBurst = slot.kind === 'boots' && needs.burst >= RESIST_BURST.burst && (['physical', 'magic'] as const).some(resist => needs[resist] >= RESIST_BURST.share && fit.answers.some(answer => answer.need === resist))
      parts.draft = 0.5 + 0.5 * fit.fit * (intoBurst ? 1 : parts.kit ?? 1)
      answers = fit.answers
      misfit = fit.misfit
      const base = slot.kind === 'boots' ? WEIGHTS.boots : itemWeights(slot.place)
      weights = { ...base, kit: base.kit! * modeled(option.games) }
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
    scored[option.key] = { total: total(parts, weights) * (misfit ? 0.5 : 1), parts, weights, answers, misfit }
  }
  const standard = slot.options[0]!
  const best = (options: JevOption[]) => options.reduce((top, option) => (scored[option.key]!.total > scored[top.key]!.total + 1e-9 ? option : top), options[0]!)
  if (!BY_REASON.includes(slot.kind)) return { slot, pick: best(slot.options), standard, scored }
  // An item a slot before gave up leads this one: taken, an answer moves a measured item one place, not out of the
  // build — Jinx's Infinity Edge fourth after Lord Dominik's Regards, not given up again for Guardian Angel and Maw.
  if (standard.itemIds.some(id => context.owed?.includes(id))) return { slot, pick: standard, standard, scored }
  const others = slot.options.slice(1)
  const share = shareOf(slot.options)
  const popular = (option: JevOption) => !option.situational && option.games >= MIN_GAMES && share(option) >= POPULAR.share
  for (const option of others) {
    const reason = reasonOf(slot.kind, scored[option.key]!, scored[standard.key]!, edges[option.key] ?? null, { mine: fits[option.key], theirs: fits[standard.key] }, popular(option), context.due ?? [])
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
  return { key: `jev.reason.${reason.kind}` }
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

/** One place of a laid build: the slot that offers its item, the option taken, and the place (0 the boots, else the completed item's, 1 the first). */
export interface BuildStep {
  entry: RankedSlot
  option: JevOption
  place: number
}

/** A laid build's boots and items in buying order, each matched to the slot that offers it: the board's steps (`JevBuildPath`). */
export function buildSteps(ranked: RankedSlot[], build: LaidBuild): BuildStep[] {
  const taken = new Set<string>()
  let count = 0
  return build.order.flatMap((id): BuildStep[] => {
    const entry = ranked.find(candidate => (candidate.slot.kind === 'item' || candidate.slot.kind === 'boots') && !taken.has(candidate.slot.name) && candidate.slot.options.some(option => option.itemIds[0] === id))
    if (!entry) return []
    taken.add(entry.slot.name)
    const option = entry.slot.options.find(candidate => candidate.itemIds[0] === id)!
    return [{ entry, option, place: entry.slot.kind === 'boots' ? 0 : ++count }]
  })
}

/** A step's other options as the board lists them under it, the highest total first. */
export const stepOthers = (step: Pick<BuildStep, 'entry' | 'option'>): JevOption[] =>
  step.entry.slot.options.filter(option => option.key !== step.option.key).sort((a, b) => (step.entry.scored[b.key]?.total ?? 0) - (step.entry.scored[a.key]?.total ?? 0))

/**
 * Each place of a laid build with the items to choose from there
 * (`PlaceItemBlock`): the item taken, then the slot's other options as the
 * board lists them — none seen in under `MIN_GAMES` games, no misfit, none the
 * build bought at an earlier place.
 */
function placesOf(ranked: RankedSlot[], build: LaidBuild): PlaceItemBlock[] {
  const steps = buildSteps(ranked, build)
  return steps.map((step, index) => {
    const held = steps.slice(0, index).map(earlier => earlier.option.itemIds[0]!)
    const others = stepOthers(step)
      .filter(option => option.games >= MIN_GAMES && !step.entry.scored[option.key]?.misfit && !held.includes(option.itemIds[0]!))
      .map(option => option.itemIds[0]!)
    return { place: step.place, items: [...new Set([step.option.itemIds[0]!, ...others])].slice(0, 1 + PLACE_ALTERNATIVES) }
  }).filter(entry => entry.items.length > 1)
}

/**
 * A build as the client's item set, laid out as Blitz's: its starter, its
 * boots where the build buys them, every item in buying order (the final
 * build), then as situational every other item its slots offered, best score
 * first — what also suits this draft when the game asks for it —, and each
 * place with the items to choose from there (`placesOf`).
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
  return { starter: build.starterItems?.itemIds ?? [], boots, core, situational: [...new Set(offered.map(option => option.id))], bootsAt: at >= 0 ? at : undefined, places: placesOf(ranked, build) }
}
