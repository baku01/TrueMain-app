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
 * The win probability an option adds, as far as its games show it: the
 * lane's, pulled toward nothing by its games, then moved toward the one
 * against the lane opponent by the matchup's games. Blitz's own estimate is
 * barely shrunk (Eclipse on Aatrox into Akali: −9.6 points over 87 games read
 * −8.3), and taken whole such a matchup outweighed thousands of lane games.
 * Null where Blitz did not measure the option on the lane.
 */
export function addedWinProbability(option: JevOption): number | null {
  if (!known(option.wpa)) return null
  const lane = option.wpa * pull(option.wpaGames ?? 0)
  return known(option.vsWpa) ? lane + (option.vsWpa - lane) * pull(option.vsGames ?? 0) : lane
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
 * expected selection taken off, then shrunk toward no difference by how much
 * of what is left is noise — sampling (`se²`) and the selection the share
 * does not explain (`σ²`) — against how much options of a slot truly differ
 * (`τ²`, WPA's own spread), and counted at its 95% lower bound (`SURE`). Where Blitz measured the slot's items, their WPA
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
 * surely worth. A deviation from what the bracket plays has to be earned; an
 * edge the games cannot vouch for reads below the reference, never above it.
 */
const SURE = 1.645

/** The lower bound of a normal–normal posterior: the estimate `edge` (its noise `noise2`) shrunk by a prior of spread `tau`. */
function surely(edge: number, noise2: number, tau: number): number {
  const keep = tau ** 2 / (tau ** 2 + noise2)
  return edge * keep - SURE * Math.sqrt(keep * noise2)
}

/**
 * An option's edge over the slot's reference, in win rate, as surely as its
 * games show it (`SELECTION`): the observed difference less the selection its
 * share explains, shrunk by `τ² / (τ² + σ² + se²)`, at the posterior's lower
 * bound (`SURE`).
 */
export function credibleEdge(option: JevOption, reference: JevOption, model: SelectionModel, shareOf: (option: JevOption) => number): number {
  if (option === reference || !option.games || !reference.games) return 0
  const pooled = (option.winRate * option.games + reference.winRate * reference.games) / (option.games + reference.games)
  const variance = pooled * (1 - pooled)
  const se2 = variance / option.games + variance / reference.games
  const ratio = Math.max(shareOf(reference), 1e-4) / Math.max(shareOf(option), 1e-4)
  const selection = model.perLog * Math.log(ratio)
  return surely(option.winRate - reference.winRate - selection, model.sigma ** 2 + se2, model.tau)
}

/**
 * Each option's measured signal on 0–1, the slot's most played option at
 * 0.5: its WPA over the reference's where Blitz measured every option
 * (`slotWpa`), else its credible edge (`credibleEdge`); a point reads about
 * 0.73. A situational option's win rate was measured wherever the item was
 * bought, not at this place of the build, so only its WPA counts. Null for an
 * option nothing measured.
 */
export function statsOf(options: JevOption[], kind: 'item' | 'boots' | 'choice' = 'choice'): Record<string, number | null> {
  if (!options.some(option => option.games > 0)) return Object.fromEntries(options.map(option => [option.key, null]))
  const compared = options.filter(option => option.games > 0 && !option.situational)
  const total = compared.reduce((sum, option) => sum + option.games, 0)
  const reference = compared.reduce<JevOption | null>((best, option) => (!best || option.games > best.games ? option : best), null)
  const shareOf = (option: JevOption) => (option.pickRate > 0 ? option.pickRate : total ? option.games / total : 0)
  const wpa = slotWpa(options)
  const model = SELECTION[kind]
  // WPA's own chance: a rate over its games (`0.25 / games` at most), the difference with the reference's shrunk alike.
  const wpaEdge = (option: JevOption) => {
    if (!wpa || !reference || option === reference) return 0
    const se2 = 0.25 / Math.max(option.wpaGames ?? option.games, 1) + 0.25 / Math.max(reference.wpaGames ?? reference.games, 1)
    return surely(wpa(option) - wpa(reference), se2, model.tau)
  }
  return Object.fromEntries(options.map((option) => {
    if (!option.games) return [option.key, null]
    const signal = wpa
      ? wpaEdge(option)
      : option.situational || !reference ? 0 : credibleEdge(option, reference, model, shareOf)
    return [option.key, 1 / (1 + Math.exp(-signal / SPREAD))]
  }))
}
