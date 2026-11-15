import type { CellRate, DurationReport, GroupReport, GroupRate, MetricAssociation, Overview, SequenceReport } from './analysis'
import type { RateBin } from './stats'
import { twoProportion, wilson } from './stats'

/**
 * The analysis read out for a player who is not a statistician: each figure's
 * plain takeaway — the win rate on either side of a metric, the best and
 * worst game length, hour, place in a sitting, choice — and how far it can be
 * trusted, in four words instead of p- and q-values. The page writes the
 * sentences (`i18n/nerd-stats.ts`); this only picks the numbers, so the words
 * always rest on the same figures the technical details show.
 */

/** How far a finding can be trusted, from its p-value — or its q-value, where many were tested at once. */
export type Confidence = 'strong' | 'moderate' | 'weak' | 'uncertain'

/**
 * Strong: chance alone would give it less than once in a hundred; moderate:
 * less than once in twenty (the usual 5%); weak: a hint chance could still
 * give one time in five; uncertain: chance explains it as well.
 */
export function confidenceOf(p: number | null | undefined): Confidence {
  if (p === null || p === undefined || !Number.isFinite(p)) return 'uncertain'
  return p < 0.01 ? 'strong' : p < 0.05 ? 'moderate' : p < 0.2 ? 'weak' : 'uncertain'
}

/** Below this many games a figure is read as a trend, and the page says so. */
export const FEW_GAMES = 40
export const isFew = (games: number) => games < FEW_GAMES

/** A side of a comparison: its games, its wins and the win rate in them. */
export interface Side {
  games: number
  wins: number
  rate: number
  /** The range of the metric's values on this side. */
  from: number
  to: number
}

const side = (values: number[], wins: number): Side => ({
  games: values.length,
  wins,
  rate: values.length ? wins / values.length : Number.NaN,
  from: Math.min(...values),
  to: Math.max(...values),
})

/** The win rate with more of a metric against with less of it. */
export interface MetricSplit {
  /** `sign`: ahead against behind (a lead); `binary`: yes against no; `bins`: the top bin against the bottom one. */
  kind: 'sign' | 'binary' | 'bins'
  high: Side
  low: Side
  /** `high.rate − low.rate`, in rate points. */
  difference: number
  /** The metric's own test against winning, corrected for every metric tested (its q-value). */
  confidence: Confidence
}

/** Each side of a split needs this many games, or the split falls back to the metric's bins. */
const MIN_SIDE = 3

/**
 * The plainest comparison a metric allows: a lead (gold, CS, XP against the
 * opponent, the objectives' difference) splits at zero, ahead against
 * behind, ties left out; a yes/no metric splits into yes and no; anything
 * else compares its top quantile bin with its bottom one. Null when no side
 * has games enough.
 */
export function metricSplit(entry: MetricAssociation): MetricSplit | null {
  const confidence = confidenceOf(entry.correlation ? entry.q : null)
  const format = entry.definition.format
  if (format === 'signed' || format === 'binary') {
    const above = (value: number) => (format === 'binary' ? value >= 0.5 : value > 0)
    const below = (value: number) => (format === 'binary' ? value < 0.5 : value < 0)
    const highWins = entry.winValues.filter(above)
    const lowWins = entry.winValues.filter(below)
    const high = [...highWins, ...entry.lossValues.filter(above)]
    const low = [...lowWins, ...entry.lossValues.filter(below)]
    if (high.length >= MIN_SIDE && low.length >= MIN_SIDE) {
      const a = side(high, highWins.length)
      const b = side(low, lowWins.length)
      return { kind: format === 'binary' ? 'binary' : 'sign', high: a, low: b, difference: a.rate - b.rate, confidence }
    }
  }
  const bins = entry.bins.filter(bin => bin.games >= MIN_SIDE)
  if (bins.length < 2) return null
  const top = bins.at(-1)!
  const bottom = bins[0]!
  const asSide = (bin: RateBin): Side => ({ games: bin.games, wins: bin.wins, rate: bin.rate, from: bin.from, to: bin.to })
  return { kind: 'bins', high: asSide(top), low: asSide(bottom), difference: top.rate - bottom.rate, confidence }
}

/** The headline: is the player's win rate above, below or not yet told apart from a coin flip? */
export function overviewVerdict(overview: Overview): { verdict: 'above' | 'below' | 'even', confidence: Confidence } {
  return {
    verdict: overview.low > 0.5 ? 'above' : overview.high < 0.5 ? 'below' : 'even',
    confidence: confidenceOf(overview.pVersusHalf),
  }
}

/** The best and the worst of a set of cells (game lengths, times of day, places in a sitting) and how sure the gap is. */
export interface Contrast<T> {
  best: T & { games: number, wins: number, rate: number }
  worst: T & { games: number, wins: number, rate: number }
  difference: number
  confidence: Confidence
}

/** The cells with games enough to be read alone. */
export const MIN_CELL_GAMES = 5

/** Best against worst by raw win rate, among cells with `MIN_CELL_GAMES`; the gap tested as two proportions. */
export function contrast<T extends { games: number, wins: number }>(cells: readonly T[]): Contrast<T> | null {
  const read = cells.filter(cell => cell.games >= MIN_CELL_GAMES).map(cell => ({ ...cell, rate: cell.wins / cell.games }))
  if (read.length < 2) return null
  const best = read.reduce((top, cell) => (cell.rate > top.rate ? cell : top))
  const worst = read.reduce((bottom, cell) => (cell.rate < bottom.rate ? cell : bottom))
  if (best === worst) return null
  const test = twoProportion(best.wins, best.games, worst.wins, worst.games)
  return { best, worst, difference: best.rate - worst.rate, confidence: confidenceOf(test?.p) }
}

/** The win rate by game length: its best and worst five-minute bins. */
export const durationContrast = (duration: DurationReport) => contrast(duration.bins)

/** The four parts of the day the hours are pooled into: an hour played twice says little alone. */
export const DAY_PARTS = [
  { key: 'night', from: 0, to: 6 },
  { key: 'morning', from: 6, to: 12 },
  { key: 'afternoon', from: 12, to: 18 },
  { key: 'evening', from: 18, to: 24 },
] as const

export type DayPart = typeof DAY_PARTS[number]['key']

export function dayParts(hours: readonly CellRate[]): { key: DayPart, games: number, wins: number }[] {
  return DAY_PARTS.map(part => hours
    .filter(cell => cell.key >= part.from && cell.key < part.to)
    .reduce((total, cell) => ({ key: part.key, games: total.games + cell.games, wins: total.wins + cell.wins }), { key: part.key as DayPart, games: 0, wins: 0 }))
}

/** The first game of a sitting against the latest place with games enough (the 4th or later, else the 3rd…). */
export function sittingContrast(sessions: SequenceReport['sessions']): { first: Side, late: Side & { position: number }, difference: number, confidence: Confidence } | null {
  const first = sessions[0]
  const late = [...sessions].reverse().find(entry => entry.position > 1 && entry.games >= MIN_CELL_GAMES)
  if (!first || first.games < MIN_CELL_GAMES || !late) return null
  const test = twoProportion(first.wins, first.games, late.wins, late.games)
  return {
    first: { games: first.games, wins: first.wins, rate: first.rate, from: 1, to: 1 },
    late: { games: late.games, wins: late.wins, rate: late.rate, from: late.position, to: late.position, position: late.position },
    difference: first.rate - late.rate,
    confidence: confidenceOf(test?.p),
  }
}

/** Whether results come in streaks, and the next game after a win against after a loss. */
export function streakReading(sequence: SequenceReport) {
  const runs = sequence.runs
  const after = sequence.transitions
  return {
    pattern: !runs ? 'none' as const : runs.p >= 0.05 ? 'random' as const : runs.z < 0 ? 'streaky' as const : 'alternating' as const,
    patternConfidence: confidenceOf(runs?.p),
    afterWin: after.afterWin.games ? after.afterWin.wins / after.afterWin.games : Number.NaN,
    afterLoss: after.afterLoss.games ? after.afterLoss.wins / after.afterLoss.games : Number.NaN,
    momentumConfidence: confidenceOf(sequence.momentum?.p),
  }
}

/** A choice read against the player's overall rate: whether its adjusted rate is told apart from it. */
export function groupConfidence(group: GroupRate, prior: GroupReport['prior']): Confidence {
  if (group.shrunk.low > prior.mean || group.shrunk.high < prior.mean) return group.games >= FEW_GAMES ? 'strong' : 'moderate'
  const raw = wilson(group.wins, group.games)
  return raw.low > prior.mean || raw.high < prior.mean ? 'weak' : 'uncertain'
}

/** The best and the worst choice of a kind, by adjusted rate, among those played a few times. */
export function groupContrast(report: GroupReport, minGames = 3): { best: GroupRate, worst: GroupRate } | null {
  const read = report.groups.filter(group => group.games >= minGames)
  if (read.length < 2) return null
  const sorted = [...read].sort((a, b) => b.shrunk.rate - a.shrunk.rate)
  return { best: sorted[0]!, worst: sorted.at(-1)! }
}
