import { getPositionIconUrl } from '#shared/utils/ddragon'
import { tr } from '#common/utils/i18n'

/** The five positions, in lane order (top → support): every list of them reads in this order. */
export const POSITIONS = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const

export type ChampionPosition = (typeof POSITIONS)[number]

/**
 * The explicit "every position" filter value (`?position=ALL`), distinct from no
 * filter at all, which a champion read resolves to the dominant position. Only the
 * player-scoped champion page offers it (#2158); the API answers it on those routes.
 */
export const ALL_POSITIONS = 'ALL'

/** A position filter: one position, or every position at once. */
export type PositionFilter = ChampionPosition | typeof ALL_POSITIONS

export interface PositionOption {
  value: ChampionPosition
  /** The position's name: `Middle`, `Bottom`. */
  label: string
  /** The short form for tight rows (the desktop app's draft, game and recap screens): `Mid`, `Bot`. */
  shortLabel: string
  iconUrl: string
}

export const POSITION_OPTIONS: PositionOption[] = [
  { get label() { return tr('common.role.top') }, get shortLabel() { return tr('common.role.topShort') }, value: 'TOP', iconUrl: getPositionIconUrl('TOP') },
  { get label() { return tr('common.role.jungle') }, get shortLabel() { return tr('common.role.jungleShort') }, value: 'JUNGLE', iconUrl: getPositionIconUrl('JUNGLE') },
  { get label() { return tr('common.role.middle') }, get shortLabel() { return tr('common.role.middleShort') }, value: 'MIDDLE', iconUrl: getPositionIconUrl('MIDDLE') },
  { get label() { return tr('common.role.bottom') }, get shortLabel() { return tr('common.role.bottomShort') }, value: 'BOTTOM', iconUrl: getPositionIconUrl('BOTTOM') },
  { get label() { return tr('common.role.support') }, get shortLabel() { return tr('common.role.supportShort') }, value: 'UTILITY', iconUrl: getPositionIconUrl('UTILITY') },
]

/**
 * POSITION_OPTIONS keyed by value, for O(1) lookups from row data (which
 * carries the position as a plain string).
 */
export const POSITION_BY_VALUE: ReadonlyMap<string, PositionOption>
  = new Map(POSITION_OPTIONS.map(option => [option.value as string, option]))

export function isChampionPosition(value: unknown): value is ChampionPosition {
  return typeof value === 'string' && POSITION_BY_VALUE.has(value)
}

/**
 * A position's name, `short` for the tight rows' form; null for a string that is
 * no position (an empty slot, a remake's blank), so the caller decides what stands in.
 */
export function positionLabel(position: ChampionPosition, options?: { short?: boolean }): string
export function positionLabel(position: string | null | undefined, options?: { short?: boolean }): string | null
export function positionLabel(position: string | null | undefined, options: { short?: boolean } = {}): string | null {
  const option = position ? POSITION_BY_VALUE.get(position) : undefined
  if (!option) return null
  return options.short ? option.shortLabel : option.label
}

/** A position's place in lane order; a missing or unknown one sorts last. */
export function positionIndex(position: string | null | undefined): number {
  const index = position ? (POSITIONS as readonly string[]).indexOf(position) : -1
  return index === -1 ? POSITIONS.length : index
}

/**
 * Sort comparator for one team's players in lane order (TOP → SUPPORT), so two
 * teams sorted with it pair laner against laner. A missing or unknown position
 * goes last and otherwise keeps its original order.
 */
export function compareByPosition(a: { position: string | null }, b: { position: string | null }): number {
  return positionIndex(a.position) - positionIndex(b.position)
}
