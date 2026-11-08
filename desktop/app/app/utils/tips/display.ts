import { getActiveLocale, tr } from '#common/utils/i18n'
import type { DrakeElement } from '~/types/game'
import { objectiveIcon } from '~/utils/objective-timers'
import type { Tip, TipCategory } from './catalogue'

/** A tip's text in the active language, its numbers written the language's way. */
export function tipText(tip: Pick<Tip, 'key' | 'params'>): string {
  const numbers = new Intl.NumberFormat(getActiveLocale(), { maximumFractionDigits: 1 })
  const params = Object.fromEntries(Object.entries(tip.params).map(([name, value]) => [name, typeof value === 'number' ? numbers.format(value) : value]))
  return tr(`tip.${tip.key}`, params)
}

/** How long ago a tip left, in the active language: "now" under 5 s, then to the nearest 10 s up to a minute, then whole minutes. */
export function tipAgo(seconds: number): string {
  const ago = new Intl.RelativeTimeFormat(getActiveLocale(), { numeric: 'auto', style: 'short' })
  if (seconds < 60) return ago.format(-(seconds < 5 ? 0 : Math.round(seconds / 10) * 10), 'second')
  return ago.format(-Math.floor(seconds / 60), 'minute')
}

/** An objective's tip shows the game's own minimap icon of it, the drake's element included; the others their category's icon. */
export function tipImage(tip: Pick<Tip, 'key' | 'category' | 'params'>): string | null {
  if (tip.category !== 'objective') return null
  const name = tip.key.split('.')[1]
  const camp = name === 'grubs' || name === 'herald' || name === 'baron' ? name : 'dragon'
  const drake = typeof tip.params.drake === 'string' && tip.params.drake ? tip.params.drake as DrakeElement : null
  return objectiveIcon(camp, { elder: name === 'elder', drake })
}

/** The colour a category's icon takes: a threat in the enemy's red, a win in green, the mind in amber, gold in gold. */
export const CATEGORY_TONES: Record<TipCategory, 'primary' | 'enemy' | 'success' | 'warning' | 'gold' | 'muted'> = {
  objective: 'primary',
  jungle: 'enemy',
  lane: 'primary',
  kill: 'success',
  mental: 'warning',
  level: 'primary',
  recall: 'primary',
  farm: 'gold',
  ward: 'primary',
  gold: 'gold',
  map: 'muted',
}
