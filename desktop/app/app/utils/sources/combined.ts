import type { ChampionMatchupEntry, ChampionMatchups } from '#shared/types/champions/matchups'
import type { ChampionSummaryResponse, ChampionTrendResponse } from '#shared/types/champions'
import type { BuildOptions, ItemOption, Measure, SlotGroup } from '~/utils/sources/model'
import { wilson } from '~/utils/blitz/stats'
import { isBoots } from '~/utils/blitz/builds'
import { isQuestReward } from '~/utils/support-quest'

/**
 * Several sources read as one, without counting a game twice.
 *
 * lolalytics, Mobalytics, op.gg and Blitz count the same ranked games — Riot's
 * — and nearly all of them: Ahri's mid lane on 16.22, Emerald+, is 262,160
 * games on lolalytics, 263,049 on Mobalytics, 240,148 on op.gg and 244,970 on
 * Blitz, one set of games four times over, not a million. Their counts are
 * never added up. What they disagree on is how they process the same games
 * (Briar against Viego: 52.5 % on lolalytics, 50.4 % on Mobalytics over the
 * same ~3,800 games), so each rate is their mean — the multiple-frame
 * estimator's for units every frame holds (Mecatti 2007: the mean of the
 * frames, not their sum) —, weighed by each one's variance with that
 * processing spread added: near-equal for large samples, a thin one counting
 * little. The games shown are the largest source's: the effective sample of
 * nested samples is the largest one's (two estimates of the same games:
 * Lyons et al. 1988), and a guaranteed lower bound on the distinct games.
 *
 * Tencent, China's servers, is another population — another meta — and is
 * never averaged in (`utils/sources/index.ts` keeps it apart). Counts may be
 * added only across populations proven disjoint, which these are not.
 *
 * Measured, 20 lanes' matchups on 16.22, Emerald+, every pair of sources over
 * the cells both count: the squared gap between their win rates, fitted
 * against the two samples' variances (Δ² = φ·(v₁ + v₂) + 2τ²), is flat — φ
 * 0.07 for lolalytics and Mobalytics over 841 cells, the two counting
 * 1.003 times each other's games: the same games, their chance shared, not
 * two samples (that would be φ = 1) — and τ, what is left once
 * lolalytics' bracket lift is taken off (`bracketLift`), is 0.2 to 0.4 points
 * for every pair.
 */

/** How far two sources' processing of the same games parts, beyond chance: 0.3 points of win rate (measured above). */
export const SOURCE_SPREAD = 0.003

/**
 * How far a source's games may sit from the first source's, cell by cell, and
 * still be the same games: op.gg's matchups count seven tenths of
 * lolalytics' (0.66 to 0.73 of them) and Blitz's 1.03 (0.99 to 1.11), their
 * win rates within 0.4 points. A bracket a source does not keep, read as
 * another, is outside: on lolalytics, Platinum+ is 0.47 of every rank's
 * games, Gold alone 0.32 of Gold+'s, Master+ 13.7 times Grandmaster+'s, and
 * op.gg's lists, which keep no bracket, are five times Master+'s.
 */
const SAME_GAMES = [0.6, 1 / 0.6] as const

/**
 * The answers that count the games the first one does — the first that
 * counts any, the order given, most complete first: an answer is kept when
 * the median, over the cells both count, of its games over the first's is
 * inside `SAME_GAMES`, or when they share no cell to tell. Another bracket,
 * another patch or another queue is another population (Mecatti 2007's
 * frames must cover the same one): averaged in, its rates would pull every
 * figure toward its own.
 */
export function sameGames<T>(answers: T[], cells: (answer: T) => Map<string, number>): T[] {
  const counted = answers.map(answer => ({ answer, cells: cells(answer) }))
  const first = counted.find(entry => [...entry.cells.values()].some(games => games > 0))
  if (!first) return answers
  return counted.filter((entry) => {
    if (entry === first) return true
    const ratios = [...entry.cells].flatMap(([key, games]) => {
      const base = first.cells.get(key)
      return base && games > 0 ? [games / base] : []
    }).sort((a, b) => a - b)
    const median = ratios[Math.floor(ratios.length / 2)]
    return median === undefined || (median >= SAME_GAMES[0] && median <= SAME_GAMES[1])
  }).map(entry => entry.answer)
}

/** A source's weight for a rate measured on `games` games: the inverse of its variance with the sources' spread added. */
export function weightOf(games: number): number {
  return games > 0 ? 1 / (0.25 / games + SOURCE_SPREAD ** 2) : 0
}

/** The weighted mean of `values`, each with the weight of its games; null for no weight at all. */
function mean(values: { value: number, games: number }[]): number | null {
  const total = values.reduce((sum, entry) => sum + weightOf(entry.games), 0)
  return total > 0 ? values.reduce((sum, entry) => sum + weightOf(entry.games) * entry.value, 0) / total : null
}

/** One figure measured by several sources over the same games: rates pooled, the games the largest source's. */
export function poolMeasure<T extends Measure>(measures: T[]): T {
  const largest = measures.reduce((best, measure) => (measure.games > best.games ? measure : best), measures[0]!)
  return {
    ...largest,
    games: largest.games,
    winRate: mean(measures.map(measure => ({ value: measure.winRate, games: measure.games }))) ?? largest.winRate,
    pickRate: mean(measures.map(measure => ({ value: measure.pickRate, games: measure.games }))) ?? largest.pickRate,
  }
}

/**
 * Lists of the same kind of option from several sources, as one: each option
 * pooled over the sources that listed it — an option a source left out is
 * below its threshold there, not 0 —, most picked first.
 */
export function poolLists<T extends Measure>(lists: T[][], key: (option: T) => string): T[] {
  const byKey = new Map<string, T[]>()
  for (const list of lists) {
    for (const option of list) {
      const id = key(option)
      byKey.set(id, [...(byKey.get(id) ?? []), option])
    }
  }
  return [...byKey.values()].map(poolMeasure).sort((a, b) => b.pickRate - a.pickRate || b.games - a.games)
}

const ids = (list: number[]) => list.join(',')

/** A core's completed items: sources differ on whether a core holds the boots (lolalytics' does, Mobalytics' does not). */
const completed = (itemIds: number[]) => itemIds.filter(id => !isBoots(id) && !isQuestReward(id))

/**
 * A source's cores without the boots, the ones that then read alike added
 * up — within one source they are other games (Ahri's Luden's, Sorcerer's
 * Shoes, Shadowflame and her Luden's, Shadowflame, Sorcerer's Shoes) —,
 * most played first.
 */
function coresOf(options: BuildOptions): ItemOption[] {
  const byPath = new Map<string, ItemOption>()
  for (const core of options.cores) {
    const itemIds = completed(core.itemIds)
    if (!itemIds.length) continue
    const known = byPath.get(ids(itemIds))
    if (!known) {
      byPath.set(ids(itemIds), { ...core, itemIds })
      continue
    }
    const games = known.games + core.games
    byPath.set(ids(itemIds), { ...known, games, pickRate: known.pickRate + core.pickRate, winRate: games ? (known.winRate * known.games + core.winRate * core.games) / games : known.winRate })
  }
  return [...byPath.values()].sort((a, b) => b.games - a.games)
}

/** The sources' options on one lane as one (`poolLists`, list by list); null when none answered. */
export function combineOptions(...answers: (BuildOptions | null)[]): BuildOptions | null {
  const answered = answers.filter((options): options is BuildOptions => !!options && (options.games > 0 || options.cores.length > 0 || options.boots.length > 0))
  const present = sameGames(answered, options => new Map([['lane', options.games]]))
  if (!present.length) return answers.find(options => !!options) ?? null
  if (present.length === 1) return present[0]!
  const pool = <T extends Measure>(pick: (options: BuildOptions) => T[] | undefined, key: (option: T) => string) => poolLists(present.map(options => pick(options) ?? []), key)
  const optional = <T extends Measure>(pick: (options: BuildOptions) => T[] | undefined, key: (option: T) => string) =>
    (present.some(options => pick(options)) ? pool(pick, key) : undefined)
  const places = present.some(options => options.places)
    ? Array.from({ length: Math.max(...present.map(options => options.places?.length ?? 0)) }, (_, at) => poolLists(present.map(options => options.places?.[at] ?? []), option => ids(option.itemIds)))
    : undefined
  return {
    patch: present.find(options => options.patch)?.patch ?? null,
    games: Math.max(...present.map(options => options.games)),
    pages: pool(options => options.pages, option => JSON.stringify(option.page)),
    // Only lolalytics counts runes one by one: its shares, as they are.
    shares: present.find(options => options.shares)?.shares ?? null,
    spells: pool(options => options.spells, option => ids([...option.spellIds].sort((a, b) => a - b))),
    starters: pool(options => options.starters, option => ids(option.itemIds)),
    boots: pool(options => options.boots, option => ids(option.itemIds)),
    cores: poolLists(present.map(coresOf), option => ids(option.itemIds)),
    // What follows a core: pooled, slot by slot, over the sources that
    // measured that same core — over every source's lane when none did.
    followUps: (core) => {
      const own = (options: BuildOptions) => (core ? options.cores.find(option => ids(completed(option.itemIds)) === ids(core.itemIds)) ?? null : null)
      const measured = core ? present.filter(options => own(options)) : present
      const groups = (measured.length ? measured : present).flatMap(options => options.followUps(own(options)))
      const slots = [...new Set(groups.map(group => group.slot))].sort((a, b) => a - b)
      return slots.map((slot): SlotGroup => ({ slot, options: poolLists(groups.filter(group => group.slot === slot).map(group => group.options), (option: ItemOption) => ids(option.itemIds)) }))
    },
    skills: pool(options => options.skills, option => ids(option.points)),
    priorities: optional(options => options.priorities, option => option.order.join('')),
    situational: optional(options => options.situational, option => ids(option.itemIds)),
    questRewards: optional(options => options.questRewards, option => ids(option.itemIds)),
    places,
  }
}

/**
 * The games a pooled win rate is as sure as: the largest source's, less what
 * the sources' processing adds — the variance p(1−p)/n + τ²/k of a mean of
 * k sources over the same n games (`SOURCE_SPREAD`), as the games a single
 * count that sure would take (the effective sample, n* = p(1−p) / variance).
 */
export function effectiveGames(winRate: number, games: number, sources: number): number {
  const spread = SOURCE_SPREAD ** 2 / Math.max(sources, 1)
  return games / (1 + games * spread / (winRate * (1 - winRate) || 0.25))
}

/**
 * The sources' matchups of one champion on one lane as one: each opponent's
 * figures pooled over the sources that met it, its games the largest
 * source's, its wins read from those, its Wilson interval from the games it
 * is as sure as (`effectiveGames`).
 */
export function combineMatchups(championId: number, position: string, answers: (ChampionMatchups | null)[]): ChampionMatchups {
  const counted = sameGames(answers.filter((answer): answer is ChampionMatchups => !!answer), answer => new Map(answer.matchups.map(entry => [String(entry.opponentChampionId), entry.games])))
  const byOpponent = new Map<number, ChampionMatchupEntry[]>()
  for (const entry of counted.flatMap(answer => answer.matchups)) {
    if (entry.games > 0) byOpponent.set(entry.opponentChampionId, [...(byOpponent.get(entry.opponentChampionId) ?? []), entry])
  }
  const matchups = [...byOpponent.values()].map((entries) => {
    const pooled = poolMeasure(entries.map(entry => ({ ...entry, pickRate: entry.playRate })))
    const gold = entries.filter(entry => entry.averageGoldDiffAt15 !== null)
    const goldDiff = mean(gold.map(entry => ({ value: entry.averageGoldDiffAt15!, games: entry.goldDiffLaneGames || entry.games })))
    const wins = Math.round(pooled.winRate * pooled.games)
    const sure = effectiveGames(pooled.winRate, pooled.games, entries.length)
    const [low, high] = wilson(pooled.winRate * sure, sure)
    const { pickRate, ...entry } = pooled
    return {
      ...entry,
      wins,
      playRate: pickRate,
      averageGoldDiffAt15: goldDiff,
      goldDiffLaneGames: Math.max(0, ...gold.map(one => one.goldDiffLaneGames || one.games)),
      winRateLowerBound: low,
      winRateUpperBound: high,
    }
  })
  return { championId, position, patch: answers.find(answer => answer?.patch)?.patch ?? null, matchups }
}

/**
 * The sources' rows of the tier list or the champions list as one, by
 * champion and lane: the rates pooled, the games the largest source's; the
 * rest (tier, build) the first row's — the order given, most complete first.
 */
export function combineRows(answers: ChampionSummaryResponse[][]): ChampionSummaryResponse[] {
  const byKey = new Map<string, ChampionSummaryResponse[]>()
  for (const row of sameGames(answers, rows => new Map(rows.map(row => [`${row.championId}:${row.position}`, row.games]))).flat()) {
    const key = `${row.championId}:${row.position}`
    byKey.set(key, [...(byKey.get(key) ?? []), row])
  }
  return [...byKey.values()].map((rows) => {
    const counted = rows.filter(row => row.games > 0)
    const measured = counted.length ? counted : rows
    const first = rows[0]!
    const rate = (pick: (row: ChampionSummaryResponse) => number) => mean(measured.map(row => ({ value: pick(row), games: row.games || 1 }))) ?? pick(first)
    const games = Math.max(...rows.map(row => row.games))
    const winRate = rate(row => row.winRate)
    return {
      ...first,
      games,
      wins: Math.round(winRate * games),
      winRate,
      pickRate: rate(row => row.pickRate),
      banRate: rate(row => row.banRate ?? 0),
      lanePlayRate: rate(row => row.lanePlayRate),
    }
  })
}

/** The sources' trends of one lane as one, patch by patch (`poolMeasure`'s rule). */
export function combineTrends(championId: number, position: string, answers: ChampionTrendResponse[]): ChampionTrendResponse {
  const byPatch = new Map<string, ChampionTrendResponse['points']>()
  for (const point of sameGames(answers, answer => new Map(answer.points.map(point => [point.patch, point.games]))).flatMap(answer => answer.points)) byPatch.set(point.patch, [...(byPatch.get(point.patch) ?? []), point])
  const points = [...byPatch.entries()].map(([patch, points]) => {
    const counted = points.filter(point => point.games > 0)
    const measured = counted.length ? counted : points
    const rate = (pick: (point: ChampionTrendResponse['points'][number]) => number) => mean(measured.map(point => ({ value: pick(point), games: point.games || 1 }))) ?? pick(points[0]!)
    return { patch, winRate: rate(point => point.winRate), pickRate: rate(point => point.pickRate), banRate: rate(point => point.banRate ?? 0), games: Math.max(...points.map(point => point.games)) }
  }).sort((a, b) => a.patch.localeCompare(b.patch, undefined, { numeric: true }))
  return { championId, position, points }
}
