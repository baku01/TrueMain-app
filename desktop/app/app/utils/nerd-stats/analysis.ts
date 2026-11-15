import type { CorrelationReading, CurvePoint, EffectSize, Interval, ProportionDifference, RateBin } from './stats'
import type { GameRow, MetricDefinition, MetricKey } from './features'
import type { RunsTest, Streaks, Tally, Transitions } from './sequence'
import type { BetaPrior, ShrunkRate } from './shrinkage'
import type { Validation } from './logistic'
import { Z95 } from './distributions'
import { METRIC_DEFINITIONS } from './features'
import { aucInterval, columnScales, crossValidate, fitLogistic, standardise } from './logistic'
import { runsTest, streaks, transitions } from './sequence'
import { betaBinomialPrior, shrink } from './shrinkage'
import { ascending, benjaminiHochberg, cohensD, kernelRate, mean, pointBiserial, quantile, quantileBins, sd, spearman, twoProportion, versusCoinFlip, wilson } from './stats'

/**
 * The nerd page's whole reading of the player's games: how often they win
 * and how sure that figure is, which metrics come with winning and by how
 * much, a fitted formula of victory, the win rate by game length, hour,
 * weekday, champion, lane, rune and item, the streaks, and how the metrics move
 * together.
 *
 * One pure function of the rows (`analyse`), cheap enough to recompute on
 * every filter change: a couple of hundred games by forty metrics, a ten-fold
 * fit of an eight-term logistic regression, a 16×16 rank-correlation matrix —
 * a few milliseconds.
 */

/** Below this many games the page shows the raw tallies and says why it shows no more. */
export const MIN_GAMES = 10

/** The model needs this many games and this many of the rarer result. */
export const MIN_MODEL_GAMES = 20
export const MIN_MODEL_EVENTS = 8

/** A metric is only modelled when this share of the games carry it. */
export const MODEL_COVERAGE = 0.7

/** Ridge penalty on the standardised coefficients. */
export const MODEL_LAMBDA = 1

/**
 * The metrics the formula may use, in the order they are taken. Each says
 * something different about a game (deaths per minute, not also KDA and
 * deaths) and none is a result of the win itself: towers, barons, level and
 * length are left out, since a model "predicting" a win from the towers it
 * took would only restate the result.
 */
export const MODEL_CANDIDATES: readonly MetricKey[] = [
  'deathsPerMin', 'killParticipation', 'goldDiff15', 'csPerMin', 'damageShare', 'visionPerMin', 'firstBlood', 'xpDiff15', 'blueSide',
]

export interface Overview extends Interval {
  games: number
  wins: number
  losses: number
  rate: number
  /** The binomial test against a fair coin: how surprising this record would be at a true 50%. */
  pVersusHalf: number
  /** Mean minutes of the wins, of the losses, of all. */
  durationWin: number
  durationLoss: number
  duration: number
  kda: number
}

export interface MetricAssociation {
  definition: MetricDefinition
  /** Games that carry the metric. */
  games: number
  winValues: number[]
  lossValues: number[]
  effect: EffectSize | null
  correlation: CorrelationReading | null
  /** Benjamini–Hochberg-adjusted p of the correlation, over every metric tested. */
  q: number
  /** Win rate in the metric's terciles or quartiles. */
  bins: RateBin[]
  /** Mean and spread over all its games, and its 5th and 95th percentiles. */
  mean: number
  sd: number
  p5: number
  p95: number
}

export interface ModelFeature {
  key: MetricKey
  /** μ and s the metric is standardised with: z = (x − μ)/s. */
  mean: number
  sd: number
  beta: number
  se: number
  /** e^β: how the odds of winning multiply per standard deviation more, with its Wald 95% interval. */
  oddsRatio: number
  low: number
  high: number
  /** βᵢ·(z̄_wins − z̄_losses): this metric's share of the log-odds gap between the average win and the average loss. */
  gap: number
  /** Share of the games that carried the metric (the rest are imputed at μ). */
  coverage: number
  /** 5th and 95th percentiles in the metric's own units, for the calculator's sliders. */
  p5: number
  p95: number
}

export interface ModelReport {
  games: number
  wins: number
  intercept: number
  interceptSe: number
  features: ModelFeature[]
  lambda: number
  converged: boolean
  validation: Validation
  aucLow: number
  aucHigh: number
  /** Events per variable: the rarer result's count over the number of metrics. */
  eventsPerVariable: number
  /** Metrics that would have been used had the sample been larger. */
  held: MetricKey[]
}

export interface DurationReport {
  win: number
  loss: number
  effect: EffectSize | null
  /** Win rate in five-minute bins (under 20 and 40+ pooled), with Wilson intervals. */
  bins: RateBin[]
  /** The kernel-smoothed win rate over the game's length. */
  curve: CurvePoint[]
  bandwidth: number
}

export interface CellRate {
  key: number
  games: number
  wins: number
  rate: number
  shrunk: ShrunkRate | null
}

export interface GroupRate {
  key: string
  games: number
  wins: number
  raw: Interval & { rate: number }
  shrunk: ShrunkRate
  kda: number
  performance: number | null
  lp: number | null
}

export interface GroupReport {
  prior: BetaPrior
  groups: GroupRate[]
}

export interface SequenceReport {
  /** Oldest first. */
  results: { gameId: number, win: boolean, playedAt: number }[]
  runs: RunsTest | null
  transitions: Transitions
  /** After a win against after a loss. */
  momentum: ProportionDifference | null
  streaks: Streaks
  /** Win rate by the game's place in its sitting: 1st, 2nd, 3rd, 4th or later. */
  sessions: (Tally & Interval & { position: number, rate: number })[]
}

export interface CorrelationMatrix {
  keys: (MetricKey | 'win')[]
  /** Spearman's ρ over the games carrying both; null below ten such games. */
  values: (number | null)[][]
}

export interface LpReport {
  measured: number
  net: number
  perWin: number | null
  perLoss: number | null
}

export interface NerdReport {
  overview: Overview
  metrics: MetricAssociation[]
  model: ModelReport | null
  duration: DurationReport
  hours: CellRate[]
  weekdays: CellRate[]
  champions: GroupReport
  positions: GroupReport
  queues: GroupReport
  keystones: GroupReport
  spells: GroupReport
  items: GroupReport
  sides: GroupReport
  sequence: SequenceReport
  correlation: CorrelationMatrix
  lp: LpReport
}

const valueOf = (row: GameRow, key: MetricKey) => row.values[key]

function overview(rows: readonly GameRow[]): Overview {
  const wins = rows.filter(row => row.win).length
  const minutes = (subset: GameRow[]) => mean(subset.map(row => row.game.durationSeconds / 60))
  const totals = rows.reduce((sum, row) => ({ k: sum.k + row.game.kills, d: sum.d + row.game.deaths, a: sum.a + row.game.assists }), { k: 0, d: 0, a: 0 })
  const interval = wilson(wins, rows.length)
  return {
    games: rows.length,
    wins,
    losses: rows.length - wins,
    rate: interval.rate,
    low: interval.low,
    high: interval.high,
    pVersusHalf: versusCoinFlip(wins, rows.length),
    durationWin: minutes(rows.filter(row => row.win)),
    durationLoss: minutes(rows.filter(row => !row.win)),
    duration: minutes([...rows]),
    kda: (totals.k + totals.a) / Math.max(totals.d, 1),
  }
}

/** Every metric against winning, strongest effect first; metrics no game carries are left out. */
export function associations(rows: readonly GameRow[]): MetricAssociation[] {
  const read = METRIC_DEFINITIONS.flatMap((definition) => {
    const measured = rows.filter(row => valueOf(row, definition.key) !== undefined)
    if (measured.length < MIN_GAMES) return []
    const values = measured.map(row => valueOf(row, definition.key)!)
    const outcomes = measured.map(row => row.win)
    const winValues = measured.filter(row => row.win).map(row => valueOf(row, definition.key)!)
    const lossValues = measured.filter(row => !row.win).map(row => valueOf(row, definition.key)!)
    const sorted = ascending(values)
    return [{
      definition,
      games: measured.length,
      winValues,
      lossValues,
      effect: cohensD(winValues, lossValues),
      correlation: pointBiserial(values, outcomes),
      q: 1,
      bins: quantileBins(values, outcomes, measured.length >= 40 ? 4 : 3),
      mean: mean(values),
      sd: sd(values),
      p5: quantile(sorted, 0.05),
      p95: quantile(sorted, 0.95),
    }]
  })
  const tested = read.filter(entry => entry.correlation)
  const q = benjaminiHochberg(tested.map(entry => entry.correlation!.p))
  tested.forEach((entry, index) => {
    entry.q = q[index]!
  })
  return read.sort((a, b) => Math.abs(b.effect?.d ?? 0) - Math.abs(a.effect?.d ?? 0))
}

/** The formula of victory; null when the sample cannot carry even one metric. */
export function victoryModel(rows: readonly GameRow[]): ModelReport | null {
  const wins = rows.filter(row => row.win).length
  const rarer = Math.min(wins, rows.length - wins)
  if (rows.length < MIN_MODEL_GAMES || rarer < MIN_MODEL_EVENTS) return null
  const usable = MODEL_CANDIDATES.filter((key) => {
    const present = rows.map(row => valueOf(row, key)).filter((value): value is number => value !== undefined)
    return present.length >= MODEL_COVERAGE * rows.length && sd(present) > 0
  })
  // About five of the rarer result per coefficient — ridge lets it go below the
  // classic ten — and never more than eight metrics.
  const room = Math.max(1, Math.min(8, Math.floor(rarer / 5)))
  const keys = usable.slice(0, room)
  const held = usable.slice(room)
  if (!keys.length) return null

  // A game without a metric is imputed at the metric's mean: z = 0, no pull either way.
  const means = keys.map(key => mean(rows.map(row => valueOf(row, key)).filter((value): value is number => value !== undefined)))
  const matrix = rows.map(row => keys.map((key, j) => valueOf(row, key) ?? means[j]!))
  const y = rows.map(row => (row.win ? 1 : 0))
  const scales = columnScales(matrix)
  const z = standardise(matrix, scales)
  const fit = fitLogistic(z, y, MODEL_LAMBDA)
  const validation = crossValidate(matrix, y, rows.length < 40 ? rows.length : 10, MODEL_LAMBDA)
  const interval = aucInterval(validation.auc, wins, rows.length - wins)

  const winRows = z.filter((_, i) => y[i] === 1)
  const lossRows = z.filter((_, i) => y[i] === 0)
  const features = keys.map<ModelFeature>((key, j) => {
    const beta = fit.beta[j + 1]!
    const se = fit.se[j + 1]!
    const present = ascending(rows.map(row => valueOf(row, key)).filter((value): value is number => value !== undefined))
    return {
      key,
      mean: scales.mean[j]!,
      sd: scales.sd[j]!,
      beta,
      se,
      oddsRatio: Math.exp(beta),
      low: Math.exp(beta - Z95 * se),
      high: Math.exp(beta + Z95 * se),
      gap: beta * (mean(winRows.map(row => row[j]!)) - mean(lossRows.map(row => row[j]!))),
      coverage: present.length / rows.length,
      p5: quantile(present, 0.05),
      p95: quantile(present, 0.95),
    }
  })
  return {
    games: rows.length,
    wins,
    intercept: fit.beta[0]!,
    interceptSe: fit.se[0]!,
    features,
    lambda: MODEL_LAMBDA,
    converged: fit.converged,
    validation,
    aucLow: interval.low,
    aucHigh: interval.high,
    eventsPerVariable: rarer / keys.length,
    held,
  }
}

/** Bin edges of the length chart, in minutes: under 20 and 40-plus pooled, five minutes between. */
const DURATION_EDGES = [0, 20, 25, 30, 35, 40, Number.POSITIVE_INFINITY]

export function durationReport(rows: readonly GameRow[]): DurationReport {
  const minutes = rows.map(row => row.game.durationSeconds / 60)
  const outcomes = rows.map(row => row.win)
  const winMinutes = minutes.filter((_, i) => outcomes[i])
  const lossMinutes = minutes.filter((_, i) => !outcomes[i])
  const bins = DURATION_EDGES.slice(0, -1).flatMap<RateBin>((from, i) => {
    const to = DURATION_EDGES[i + 1]!
    const inside = rows.filter((_, j) => minutes[j]! >= from && minutes[j]! < to)
    if (!inside.length) return []
    const won = inside.filter(row => row.win).length
    return [{ from, to, games: inside.length, wins: won, ...wilson(won, inside.length) }]
  })
  // Silverman's rule of thumb, kept between two and five minutes.
  const bandwidth = Math.min(5, Math.max(2, 1.06 * sd(minutes) * minutes.length ** -0.2))
  const sorted = ascending(minutes)
  const start = Math.floor(quantile(sorted, 0.02))
  const end = Math.ceil(quantile(sorted, 0.98))
  const grid = Number.isFinite(start) ? Array.from({ length: Math.max(0, (end - start) * 2 + 1) }, (_, i) => start + i / 2) : []
  return {
    win: mean(winMinutes),
    loss: mean(lossMinutes),
    effect: cohensD(winMinutes, lossMinutes),
    bins,
    curve: kernelRate(minutes, outcomes, grid, bandwidth),
    bandwidth,
  }
}

/** Win rate in each of `size` cells (hours, weekdays), each shrunk toward the player's overall rate. */
function cellRates(rows: readonly GameRow[], size: number, cellOf: (row: GameRow) => number): CellRate[] {
  const cells = Array.from({ length: size }, (_, key) => ({ key, games: 0, wins: 0 }))
  for (const row of rows) {
    const cell = cells[cellOf(row)]!
    cell.games++
    if (row.win) cell.wins++
  }
  const prior = betaBinomialPrior(cells)
  return cells.map(cell => ({ ...cell, rate: cell.games ? cell.wins / cell.games : Number.NaN, shrunk: cell.games ? shrink(cell, prior) : null }))
}

/** Win rates by any grouping of the games (one key or several per game), shrunk by the Beta-Binomial prior. */
export function groupRates(rows: readonly GameRow[], keysOf: (row: GameRow) => (string | number)[]): GroupReport {
  const tallies = new Map<string, { games: number, wins: number, k: number, d: number, a: number, scores: number[], lp: number[] }>()
  for (const row of rows) {
    for (const raw of new Set(keysOf(row))) {
      const key = String(raw)
      const tally = tallies.get(key) ?? { games: 0, wins: 0, k: 0, d: 0, a: 0, scores: [], lp: [] }
      tally.games++
      if (row.win) tally.wins++
      tally.k += row.game.kills
      tally.d += row.game.deaths
      tally.a += row.game.assists
      if (row.values.performance !== undefined) tally.scores.push(row.values.performance)
      if (row.lpDelta !== null) tally.lp.push(row.lpDelta)
      tallies.set(key, tally)
    }
  }
  const prior = betaBinomialPrior([...tallies.values()])
  const groups = [...tallies.entries()].map<GroupRate>(([key, tally]) => ({
    key,
    games: tally.games,
    wins: tally.wins,
    raw: wilson(tally.wins, tally.games),
    shrunk: shrink(tally, prior),
    kda: (tally.k + tally.a) / Math.max(tally.d, 1),
    performance: tally.scores.length ? mean(tally.scores) : null,
    lp: tally.lp.length ? tally.lp.reduce((total, value) => total + value, 0) : null,
  }))
  groups.sort((a, b) => b.games - a.games || b.shrunk.rate - a.shrunk.rate)
  return { prior, groups }
}

export function sequenceReport(rows: readonly GameRow[]): SequenceReport {
  const results = rows.map(row => row.win)
  const moves = transitions(results)
  const positions = [1, 2, 3, 4].map((position) => {
    const inside = rows.filter(row => (position === 4 ? row.session >= 4 : row.session === position))
    const won = inside.filter(row => row.win).length
    return { position, games: inside.length, wins: won, ...wilson(won, inside.length) }
  })
  return {
    results: rows.map(row => ({ gameId: row.game.gameId, win: row.win, playedAt: row.game.playedAt })),
    runs: runsTest(results),
    transitions: moves,
    momentum: twoProportion(moves.afterWin.wins, moves.afterWin.games, moves.afterLoss.wins, moves.afterLoss.games),
    streaks: streaks(results),
    sessions: positions,
  }
}

/** The metrics the correlation heatmap crosses, after winning itself. */
export const MATRIX_KEYS: readonly MetricKey[] = [
  'duration', 'kills', 'deaths', 'assists', 'killParticipation', 'csPerMin', 'goldPerMin', 'damagePerMin',
  'damageShare', 'visionPerMin', 'goldDiff15', 'xpDiff15', 'csDiff15', 'firstBlood', 'performance',
]

export function correlationMatrix(rows: readonly GameRow[]): CorrelationMatrix {
  const keys: (MetricKey | 'win')[] = ['win', ...MATRIX_KEYS.filter(key => rows.filter(row => valueOf(row, key) !== undefined).length >= MIN_GAMES)]
  const read = (row: GameRow, key: MetricKey | 'win') => (key === 'win' ? (row.win ? 1 : 0) : valueOf(row, key))
  const values = keys.map(a => keys.map((b) => {
    if (a === b) return 1
    const both = rows.filter(row => read(row, a) !== undefined && read(row, b) !== undefined)
    if (both.length < MIN_GAMES) return null
    return spearman(both.map(row => read(row, a)!), both.map(row => read(row, b)!))
  }))
  return { keys, values }
}

function lpReport(rows: readonly GameRow[]): LpReport {
  const measured = rows.filter(row => row.lpDelta !== null)
  const wins = measured.filter(row => row.win).map(row => row.lpDelta!)
  const losses = measured.filter(row => !row.win).map(row => row.lpDelta!)
  return {
    measured: measured.length,
    net: measured.reduce((total, row) => total + row.lpDelta!, 0),
    perWin: wins.length ? mean(wins) : null,
    perLoss: losses.length ? mean(losses) : null,
  }
}

/** Legendary items only: components and consumables are bought on the way, not chosen. */
export const LEGENDARY_GOLD = 2200

export function analyse(rows: readonly GameRow[], itemGold: (itemId: number) => number | undefined = () => undefined): NerdReport {
  return {
    overview: overview(rows),
    metrics: associations(rows),
    model: victoryModel(rows),
    duration: durationReport(rows),
    hours: cellRates(rows, 24, row => row.hour),
    weekdays: cellRates(rows, 7, row => row.weekday),
    champions: groupRates(rows, row => [row.game.championId]),
    positions: groupRates(rows, row => (row.game.position ? [row.game.position] : [])),
    queues: groupRates(rows, row => [row.queue]),
    keystones: groupRates(rows, row => (row.game.keystone ? [row.game.keystone] : [])),
    spells: groupRates(rows, row => [[...row.game.spells].sort((a, b) => a - b).join('+')]),
    items: groupRates(rows, row => row.game.items.filter(item => item > 0 && (itemGold(item) ?? 0) >= LEGENDARY_GOLD)),
    sides: groupRates(rows, row => [row.game.teamId === 100 ? 'blue' : 'red']),
    sequence: sequenceReport(rows),
    correlation: correlationMatrix(rows),
    lp: lpReport(rows),
  }
}
