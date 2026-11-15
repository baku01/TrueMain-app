import type { MetricAssociation } from '~/utils/nerd-stats/analysis'
import type { MetricSplit } from '~/utils/nerd-stats/insights'
import type { FormulaWeight } from '~/utils/nerd-stats/formula-insights'
import { metricSplit } from '~/utils/nerd-stats/insights'

/**
 * The nerd page's sentences, written from the real figures in the player's
 * language: a metric's split ("when you are ahead in gold at 15 minutes you
 * win 61%; behind, 38%"), a step of the formula ("+1 CS a minute: 50% →
 * 58%"), and the technical figures a confidence word rests on, for its
 * tooltip. Figures are marked `**…**` for `NerdRich`.
 */
export function useNerdSay() {
  const { t } = useT()
  const f = useNerdFormat()

  const range = (entry: MetricAssociation, from: number, to: number) => {
    const a = f.metric(entry.definition, from)
    const b = f.metric(entry.definition, to)
    return a === b ? a : `${a} – ${b}`
  }

  /** A metric's split as a sentence; null when the metric has no side with games enough. */
  function split(entry: MetricAssociation, read: MetricSplit | null = metricSplit(entry)): string | null {
    if (!read) return null
    const key = entry.definition.key
    const figures = { high: f.percent(read.high.rate), low: f.percent(read.low.rate), diff: f.points(read.difference), phrase: t(`nerd.phrase.${key}`) }
    if (read.kind === 'binary') return t(`nerd.say.binary.${key}`, figures)
    if (read.kind === 'sign') return t('nerd.say.sign', figures)
    return t('nerd.say.bins', { ...figures, highRange: range(entry, read.high.from, read.high.to), lowRange: range(entry, read.low.from, read.low.to) })
  }

  /** The figures behind a metric's confidence word: its q-value, and the size of the gap in standard deviations. */
  function metricDetail(entry: MetricAssociation): string {
    return [
      entry.correlation ? `q = ${f.pValue(entry.q)}` : null,
      entry.effect ? `d = ${f.signed(entry.effect.d, 2)}` : null,
      `n = ${entry.games}`,
    ].filter(Boolean).join(' · ')
  }

  /** One weight of the formula as its step: "+1 CS/min (6,2 → 7,2): 50% → 58%". */
  function step(weight: FormulaWeight): string {
    const chance = { before: f.percent(weight.before), after: f.percent(weight.after), diff: f.points(weight.change) }
    if (weight.binary) return t(`nerd.say.step.${weight.key}`, chance)
    return t('nerd.say.step', {
      ...chance,
      step: `+${weight.unit.format === 'percent' ? f.percent(weight.step, Number.isInteger(Math.round(weight.step * 1e6) / 1e4) ? 0 : 1) : f.nice(weight.step)}`,
      unit: t(`nerd.unit.${weight.key}`),
      from: f.unit(weight.unit.format, weight.from),
      to: f.unit(weight.unit.format, weight.to),
    })
  }

  return { split, metricDetail, step }
}
