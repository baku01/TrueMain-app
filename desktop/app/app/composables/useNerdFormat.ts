import type { MetricDefinition, MetricFormat } from '~/utils/nerd-stats/features'
import { getActiveLocale } from '#common/utils/i18n'

/**
 * The nerd page's numbers in the player's language — `52,3%` and `0,87` in
 * Portuguese, `52.3%` and `0.87` in English — and each metric in its own unit
 * (a lead signed, a share as a percentage, a length as minutes:seconds). A
 * minus sign is the typographic `−`, not a hyphen.
 */
const formats = new Map<string, Intl.NumberFormat>()

function formatter(digits: number): Intl.NumberFormat {
  const key = `${getActiveLocale()}:${digits}`
  let found = formats.get(key)
  if (!found) {
    found = new Intl.NumberFormat(getActiveLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits })
    formats.set(key, found)
  }
  return found
}

export function useNerdFormat() {
  const number = (value: number, digits = 0) => (Number.isFinite(value) ? formatter(digits).format(value).replace('-', '−') : '—')
  const percent = (value: number, digits = 0) => (Number.isFinite(value) ? `${number(value * 100, digits)}%` : '—')
  const signed = (value: number, digits = 0) => {
    if (!Number.isFinite(value)) return '—'
    const text = formatter(digits).format(Math.abs(value))
    return Number(text.replace(/\D/g, '')) === 0 ? text : `${value > 0 ? '+' : '−'}${text}`
  }
  /** A p-value as a paper prints it: three decimals under 0.01, "< 0.001" below that. */
  const pValue = (p: number) => (p < 0.001 ? `< ${number(0.001, 3)}` : number(p, p < 0.01 ? 3 : 2))
  const minutes = (value: number) => {
    if (!Number.isFinite(value)) return '—'
    const seconds = Math.round(value * 60)
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  }
  /** A thousands-scaled figure for gold and damage: 12,4k / 12.4k. */
  const compact = (value: number) => (Math.abs(value) >= 1000 ? `${number(value / 1000, 1)}k` : number(value, 0))

  /** One metric's value in its own unit. */
  const metric = (definition: Pick<MetricDefinition, 'format'>, value: number): string => unit(definition.format, value)

  /** A value in a unit (`MetricFormat`): a lead signed, a share as a percentage, a length as minutes:seconds. */
  function unit(format: MetricFormat, value: number): string {
    switch (format) {
      case 'percent': return percent(value, 1)
      case 'binary': return percent(value, 0)
      // Hundreds of gold a minute need no decimals; a fraction of a death does.
      case 'perMin': return number(value, Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2)
      case 'ratio': return number(value, 2)
      case 'decimal': return number(value, 1)
      case 'gold': return compact(value)
      // A lead of thousands reads as 1,6k; one of tens as itself.
      case 'signed': return Math.abs(value) >= 1000 ? `${signed(value / 1000, 1)}k` : signed(value, 0)
      case 'minutes': return minutes(value)
      case 'score': return number(value, 0)
      default: return number(value, Number.isInteger(value) ? 0 : 1)
    }
  }

  /** A round figure with only the decimals it has: `1`, `2,5`, `0,25`. */
  const nice = (value: number) => number(value, Number.isInteger(value) ? 0 : Number.isInteger(Math.round(value * 1e6) / 1e5) ? 1 : 2)

  /** The gap between two win rates, in rate points: `+23`, `−8`. */
  const points = (difference: number) => signed(difference * 100, 0)

  return { number, percent, signed, pValue, minutes, compact, metric, unit, points, nice }
}
