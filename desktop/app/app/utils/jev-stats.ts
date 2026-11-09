import type { JevOption } from '~/utils/jev-build'

/**
 * The measured half of an option's score (`rankSlot`'s `stats` part): what
 * lolalytics' and Blitz's games say of each option of a slot against the
 * slot's most played one, chance and selection taken out.
 */

const known = (value: number | null | undefined): value is number => value !== null && value !== undefined

/**
 * Games of evidence a measure is pulled toward what is known without it:
 * `0.25 / τ²` for a true spread of τ = 1.6 points. Measured (16.22, Emerald+,
 * Blitz): an item's WPA against one lane opponent strays from its lane WPA by
 * 1.0 to 2.8 points beyond chance (647 item–matchup pairs of 70 matchups), and
 * items' WPA spread 1.9 points, chance included — so a thin matchup's reading
 * counts as far as its games outweigh a thousand, no further.
 */
const PRIOR_GAMES = 1000
const pull = (games: number) => games / (games + PRIOR_GAMES)

/**
 * Games of evidence an item's WPA at one place of the build is pulled toward
 * the same item's WPA around it, `0.25 / τ²` — LoLTheory's comparison within
 * a build's context, its thin options pulled toward the same item's estimate
 * rather than toward nothing. Measured (16.22, Emerald+, Blitz, 81 champion
 * lanes): an item's WPA as the Nth completed item (`item_slot`) strays from
 * its WPA over every slot by τ = 0.31 points beyond chance (4,608 item–slot
 * pairs; 2.7 points with chance), and after the items bought before it
 * (`items`) from its WPA at that slot by τ = 0.22 points (2,907 item–path
 * pairs). Win rates stray far more — 1.7 points at a slot from the item's
 * rate over every slot: the "more items, more wins" of later slots (50.2% at
 * the first item, 57.9% at the fourth; LoLTheory's 51.2% and 59.6%), which the
 * win odds at the purchase that WPA takes off carry (49.9% and 56.9%). So a
 * slot's or a path's reading moves an item's WPA only as far as its games
 * outweigh tens of thousands: on 906 slots of those lanes it changed the
 * option taken in 3.6%, by 0.03 points of edge on average, 0.7 at most.
 */
const CONTEXT_GAMES = { slot: 26000, path: 52000 }

/** What is known of an effect: its estimate and the games of evidence behind it (`0.25 / variance`). */
interface Belief { mean: number, games: number }

/**
 * A normal–normal posterior down nested measures, the broadest first — the
 * lane, the slot, the path: each level's true value strays from its parent's
 * by `spread` (in games), and reads the games it holds beyond the narrower
 * level's, which are a part of them (an item bought only at its slot has no
 * games elsewhere, so its lane and slot readings count once). From `root`:
 * nothing known pulls toward no effect; no games at all (`games: 0`) leaves
 * the measures alone, which gives the evidence they carry.
 */
function nested(levels: { wpa: number, games: number, spread: number }[], root: Belief): Belief {
  let belief = root
  levels.forEach((level, index) => {
    belief = { mean: belief.mean, games: 1 / (1 / belief.games + 1 / level.spread) }
    const inner = levels[index + 1]
    const games = level.games - (inner?.games ?? 0)
    if (games <= 0) return
    const wpa = inner ? (level.wpa * level.games - inner.wpa * inner.games) / games : level.wpa
    belief = { mean: belief.mean + (wpa - belief.mean) * games / (games + belief.games), games: belief.games + games }
  })
  return belief
}

/**
 * An option's WPA as the measures of its items show it: on the lane, pulled
 * toward nothing by its games (`PRIOR_GAMES`); at the slot's place of the
 * build, then after the items held before it, each pulled toward the broader
 * (`CONTEXT_GAMES`); and the games of evidence behind it, the pull toward
 * nothing left out — `statsOf` shrinks the comparison itself. Null where
 * Blitz did not measure the option on the lane.
 */
function wpaOf(option: JevOption): Belief | null {
  if (!known(option.wpa)) return null
  const levels = [{ wpa: option.wpa, games: option.wpaGames ?? 0, spread: PRIOR_GAMES }]
  if (known(option.slotWpa) && option.slotGames) levels.push({ wpa: option.slotWpa, games: option.slotGames, spread: CONTEXT_GAMES.slot })
  if (known(option.pathWpa) && option.pathGames) levels.push({ wpa: option.pathWpa, games: option.pathGames, spread: CONTEXT_GAMES.path })
  return { mean: nested(levels, { mean: 0, games: Infinity }).mean, games: nested(levels, { mean: 0, games: 0 }).games }
}

/**
 * The win probability an option adds, as far as its games show it: the
 * lane's, pulled toward nothing by its games, narrowed to its place of the
 * build (`wpaOf`), then moved by what the lane opponent changes, as far as the
 * matchup's games go. Blitz's own estimate is barely shrunk (Eclipse on
 * Aatrox into Akali: −9.6 points over 87 games read −8.3), and taken whole
 * such a matchup outweighed thousands of lane games. Null where Blitz did not
 * measure the option on the lane.
 */
export function addedWinProbability(option: JevOption): number | null {
  const own = wpaOf(option)
  if (!own || !known(option.wpa)) return null
  const lane = option.wpa * pull(option.wpaGames ?? 0)
  return known(option.vsWpa) ? own.mean + (option.vsWpa - lane) * pull(option.vsGames ?? 0) : own.mean
}

/**
 * The win probability added each option of a slot is weighed by
 * (`addedWinProbability`), or null when the slot cannot be compared on it:
 * only when every measured option has it (an option Blitz did not measure
 * would otherwise read as even, and beat every option measured below even —
 * boots all read negative); centred on the slot's own average, so what a
 * slot's items share (every boots' timing) does not count.
 */
export function slotWpa(options: JevOption[]): ((option: JevOption) => number) | null {
  const measuredOptions = options.filter(option => option.games > 0)
  if (!measuredOptions.length || !measuredOptions.every(option => known(option.wpa))) return null
  const games = measuredOptions.reduce((sum, option) => sum + option.games, 0)
  const mean = measuredOptions.reduce((sum, option) => sum + addedWinProbability(option)! * option.games, 0) / games
  return option => (addedWinProbability(option) ?? mean) - mean
}

/**
 * What a slot's measured win rates say once their two known faults are taken
 * out: chance (a rare option's rate over a few thousand games swings by
 * points) and selection — an option's games are not a random draw, and a
 * rare one's are the games of the players and situations that pick it.
 *
 * Both were measured (16.22, Emerald+):
 * - Blitz's item stats carry each item's win odds at the moment it was bought
 *   (`pre_buy_wr`): over 1,534 items of 81 champion lanes, nine tenths of an
 *   item's raw win-rate edge was already there before the purchase, more the
 *   rarer the item — `0.63·ln(1/share)` points, with 3.35 points of scatter
 *   left around it. Its win probability added (WPA, the rest) is the item.
 * - lolalytics' boots, across 29 lanes, 85 pairs: a rarer pair wins more by
 *   0.96 points per unit of `ln(standard's share / its share)` — Grevas Vorazes
 *   at 4% over Berserker's Greaves at 83% is +2.8 of its +3.4 points.
 * - Choices made before the game (spells, starters, skill orders) show none
 *   of it: a rare one wins less, not more; nothing is taken off them.
 *
 * So each option is compared with the slot's most played one — what the
 * players of the bracket choose, the reference a deviation must beat — and
 * the difference read as a normal–normal posterior (Smith & Winkler's cure
 * for the optimizer's curse; empirical Bayes as Efron & Morris's): the
 * expected selection taken off, then shrunk toward no difference (or toward
 * the edge the same items' WPA shows, `credibleEdge`) by how much
 * of what is left is noise — sampling (`se²`) and the selection the share
 * does not explain (`σ²`) — against how much options of a slot truly differ
 * (`τ²`, WPA's own spread); an edge counts at its 95% lower bound (`SURE`). Where Blitz measured the slot's items, their WPA
 * is the effect and the raw rates are left out: they are mostly selection.
 */
export interface SelectionModel {
  /** Points of win rate a share ratio buys by selection alone, per unit of `ln(reference's share / option's share)`. */
  perLog: number
  /** The selection the share leaves unexplained, as a standard deviation. */
  sigma: number
  /** How much options of one slot truly differ, as a standard deviation. */
  tau: number
}

export const SELECTION: Record<'item' | 'boots' | 'choice', SelectionModel> = {
  item: { perLog: 0.0063, sigma: 0.0335, tau: 0.015 },
  boots: { perLog: 0.0096, sigma: 0.0176, tau: 0.015 },
  choice: { perLog: 0, sigma: 0.005, tau: 0.012 },
}

/** What reads about 0.73 on the stats part: a point of win rate the slot's reference does not have. */
const SPREAD = 0.01

/**
 * How sure an edge over the reference must be to count: the posterior's lower
 * bound at 95% (one-sided), as Wilson's interval ranks a rate by what it is
 * surely worth. A deviation from what the bracket plays has to be earned: an
 * edge the games cannot vouch for reads even with the reference — unproven,
 * not bad, so a draft reason can still carry it. A shortfall counts at its
 * estimate.
 */
const SURE = 1.645

/**
 * A normal–normal posterior of the estimate `edge` (its noise `noise2`),
 * shrunk toward `prior` — what is known of the option elsewhere, else no
 * difference — by a prior of spread `tau`: an edge at its lower bound, a
 * shortfall at its mean. With no estimate (`noise2` infinite) the prior alone.
 */
function surely(edge: number, noise2: number, tau: number, prior = 0): number {
  const keep = Number.isFinite(noise2) ? tau ** 2 / (tau ** 2 + noise2) : 0
  const mean = prior + (edge - prior) * keep
  const spread = Number.isFinite(noise2) ? Math.sqrt(keep * noise2) : tau
  return mean > 0 ? Math.max(0, mean - SURE * spread) : mean
}

/**
 * An option's edge over the slot's reference, in win rate, as surely as its
 * games show it (`SELECTION`): the observed difference less the selection its
 * share explains, shrunk by `τ² / (τ² + σ² + se²)` toward `prior` — the edge
 * the same items show elsewhere (their WPA over the reference's), as
 * LoLTheory pulls a thin option toward the item's own estimate (75.9% over 29
 * games read 69.2%), else none — at the posterior's lower bound (`SURE`).
 */
export function credibleEdge(option: JevOption, reference: JevOption, model: SelectionModel, shareOf: (option: JevOption) => number, prior = 0): number {
  if (option === reference || !reference.games) return 0
  if (!option.games) return surely(prior, Infinity, model.tau, prior)
  const pooled = (option.winRate * option.games + reference.winRate * reference.games) / (option.games + reference.games)
  const variance = pooled * (1 - pooled)
  const se2 = variance / option.games + variance / reference.games
  const ratio = Math.max(shareOf(reference), 1e-4) / Math.max(shareOf(option), 1e-4)
  const selection = model.perLog * Math.log(ratio)
  return surely(option.winRate - reference.winRate - selection, model.sigma ** 2 + se2, model.tau, prior)
}

/** An edge over the reference, in win rate, as the stats part reads it on 0–1: none 0.5, a point about 0.73. */
export const statsPart = (edge: number): number => 1 / (1 + Math.exp(-edge / SPREAD))

/**
 * Each option's share of its slot's games: its pick rate as the source
 * measured it over the whole slot, else its games over those of the slot's
 * options measured there (an option added from the champion's pool, not
 * measured at the slot, is not counted among them).
 */
export function shareOf(options: JevOption[]): (option: JevOption) => number {
  const total = options.filter(option => !option.situational).reduce((sum, option) => sum + option.games, 0)
  return option => (option.pickRate > 0 ? option.pickRate : total ? option.games / total : 0)
}

/**
 * Each option's measured edge over the slot's most played option, in win
 * rate, the most played at 0: its WPA over the reference's where Blitz
 * measured every option (`slotWpa`), else its credible edge (`credibleEdge`)
 * pulled toward what its WPA says where it and the reference have one — an
 * edge at its 95% lower bound, a shortfall at its estimate. A situational
 * option's win rate was measured wherever the item was bought, not at this
 * place of the build, so only its WPA counts. Null for an option nothing
 * measured.
 */
export function edgesOf(options: JevOption[], kind: 'item' | 'boots' | 'choice' = 'choice'): Record<string, number | null> {
  if (!options.some(option => option.games > 0)) return Object.fromEntries(options.map(option => [option.key, null]))
  const compared = options.filter(option => option.games > 0 && !option.situational)
  const reference = compared.reduce<JevOption | null>((best, option) => (!best || option.games > best.games ? option : best), null)
  const share = shareOf(options)
  const wpa = slotWpa(options)
  const model = SELECTION[kind]
  // WPA's own chance: a rate over the games of evidence behind it (`0.25 / games` at most), the difference with the reference's shrunk alike.
  const evidence = (option: JevOption) => Math.max(wpaOf(option)?.games || option.games, 1)
  const wpaEdge = (option: JevOption) => {
    if (!wpa || !reference || option === reference) return 0
    return surely(wpa(option) - wpa(reference), 0.25 / evidence(option) + 0.25 / evidence(reference), model.tau)
  }
  // Where the rates are compared, what the same items' WPA says of the option is where a thin one is pulled.
  const priorOf = (option: JevOption) => {
    const own = addedWinProbability(option)
    const theirs = reference ? addedWinProbability(reference) : null
    return known(own) && known(theirs) ? own - theirs : 0
  }
  return Object.fromEntries(options.map((option) => {
    if (!option.games) return [option.key, null]
    const signal = wpa
      ? wpaEdge(option)
      : !reference ? 0 : credibleEdge(option.situational ? { ...option, games: 0 } : option, reference, model, share, priorOf(option))
    return [option.key, signal]
  }))
}

/**
 * Each option's measured signal on 0–1 (`statsPart` of its edge, `edgesOf`),
 * the slot's most played option at 0.5; a point reads about 0.73. Null for an
 * option nothing measured.
 */
export function statsOf(options: JevOption[], kind: 'item' | 'boots' | 'choice' = 'choice'): Record<string, number | null> {
  return Object.fromEntries(Object.entries(edgesOf(options, kind)).map(([key, edge]) => [key, edge === null ? null : statsPart(edge)]))
}
