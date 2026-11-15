import type { ModelFeature, ModelReport } from './analysis'
import type { Confidence } from './insights'
import type { MetricFormat, MetricKey } from './features'
import { twoSidedP, Z95 } from './distributions'
import { DEFINITION_BY_KEY } from './features'
import { confidenceOf } from './insights'
import { sigmoid } from './logistic'

/**
 * The formula of victory read in a player's own units. The model weighs
 * standardised metrics (z-scores), which nobody plays in: here each weight
 * becomes "this much more of it, in the units the game shows — CS a minute,
 * deaths a game, vision a game — takes your chance of winning from this to
 * that", starting from the player's average game, where every metric sits at
 * its mean (a yes/no one at the commoner answer).
 */

/**
 * A metric in the unit the player reads it in: the per-minute rates the
 * scoreboard never shows (deaths, vision) as a whole game of the player's
 * average length; the rest as they are.
 */
export interface NaturalUnit {
  /** natural value = metric value × scale. */
  scale: number
  format: MetricFormat
}

const PER_GAME: Partial<Record<MetricKey, MetricFormat>> = {
  deathsPerMin: 'decimal',
  visionPerMin: 'score',
  damagePerMin: 'gold',
}

export function naturalUnit(key: MetricKey, minutes: number): NaturalUnit {
  const perGame = PER_GAME[key]
  if (perGame && Number.isFinite(minutes) && minutes > 0) return { scale: minutes, format: perGame }
  return { scale: 1, format: DEFINITION_BY_KEY.get(key)?.format ?? 'decimal' }
}

/** A round step near `value`: 1, 2, 2.5 or 5 times a power of ten — what a player would say ("one CS a minute", "500 gold"). */
export function niceStep(value: number): number {
  if (!(value > 0) || !Number.isFinite(value)) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const scaled = value / power
  const step = scaled < 1.5 ? 1 : scaled < 2.25 ? 2 : scaled < 3.5 ? 2.5 : scaled < 7.5 ? 5 : 10
  return step * power
}

/** One metric of the formula, read in the player's units. */
export interface FormulaWeight {
  key: MetricKey
  binary: boolean
  unit: NaturalUnit
  /** The player's average and the step added to it, in natural units; a yes/no metric goes from no (0) to yes (1). */
  from: number
  to: number
  step: number
  /** The chance of winning before and after the step, every other metric as in the player's average game (`typicalValue`). */
  before: number
  after: number
  /** `after − before`, in rate points: the bar the page draws. */
  change: number
  /** The weight's own Wald test against zero. */
  confidence: Confidence
}

const isBinary = (feature: ModelFeature) => DEFINITION_BY_KEY.get(feature.key)?.format === 'binary'

/** Where a metric sits in the player's average game: its mean — a yes/no metric at the commoner answer, as a game can only have one. */
export const typicalValue = (feature: ModelFeature) => (isBinary(feature) ? Math.round(feature.mean) : feature.mean)

/** The log-odds of the player's average game (`typicalValue` for every metric): σ of it is the chance every step starts from. */
export function typicalLogit(model: ModelReport): number {
  return model.features.reduce((total, feature) => total + feature.beta * (typicalValue(feature) - feature.mean) / feature.sd, model.intercept)
}

/** The chance of winning with one metric moved to `value` (in its own units), the others as in the player's average game. */
export function chanceWith(model: ModelReport, feature: ModelFeature, value: number): number {
  return sigmoid(typicalLogit(model) + feature.beta * (value - typicalValue(feature)) / feature.sd)
}

/**
 * Each metric of the formula as "a typical step more of it": about one
 * standard deviation of the player's own games, rounded to a figure a player
 * would name, from their average. Strongest change first.
 */
export function formulaWeights(model: ModelReport, minutes: number): FormulaWeight[] {
  return model.features.map<FormulaWeight>((feature) => {
    const binary = isBinary(feature)
    const unit = naturalUnit(feature.key, minutes)
    const step = binary ? 1 : niceStep(feature.sd * unit.scale)
    const from = binary ? 0 : feature.mean * unit.scale
    const to = binary ? 1 : from + step
    const before = chanceWith(model, feature, binary ? 0 : feature.mean)
    const after = chanceWith(model, feature, binary ? 1 : to / unit.scale)
    const z = feature.se > 0 ? feature.beta / feature.se : 0
    return { key: feature.key, binary, unit, from, to, step, before, after, change: after - before, confidence: confidenceOf(feature.se > 0 ? twoSidedP(z) : null) }
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
}

export type ModelGrade = 'coin' | 'weak' | 'fair' | 'good' | 'strong'

/**
 * How well the formula predicts games it never saw, in a word — from its
 * cross-validated AUC (0.5 a coin flip, 1 every game called) — and how sure
 * that it beats a coin flip at all, from the AUC's interval.
 */
export function modelGrade(model: ModelReport): { grade: ModelGrade, confidence: Confidence, guessWin: boolean } {
  const auc = model.validation.auc
  const grade: ModelGrade = auc < 0.55 ? 'coin' : auc < 0.65 ? 'weak' : auc < 0.75 ? 'fair' : auc < 0.85 ? 'good' : 'strong'
  const se = (model.aucHigh - model.aucLow) / (2 * Z95)
  const p = se > 0 ? twoSidedP((auc - 0.5) / se) : null
  return { grade, confidence: auc > 0.5 ? confidenceOf(p) : 'uncertain', guessWin: model.wins * 2 >= model.games }
}
