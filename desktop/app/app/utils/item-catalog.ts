import type { StaticItemData } from '#shared/types/static-data'
import { tr } from '#common/utils/i18n'
import type { KitItemGroup } from '~/utils/kit-items'
import { kitItemGroups } from '~/utils/kit-items'

/**
 * The items page's catalogue: every item Data Dragon lists, the Rift shop's by
 * default and every mode's on request, each with its recipe — what it is built
 * from, what it builds into, and the gold the combining itself costs.
 */
export type CatalogGroup = KitItemGroup | 'other'

export const CATALOG_GROUPS: { group: CatalogGroup, label: string }[] = [
  { group: 'legendary', label: 'items.group.legendary' },
  { group: 'boots', label: 'items.group.boots' },
  { group: 'component', label: 'items.group.components' },
  { group: 'starter', label: 'items.group.starter' },
  { group: 'other', label: 'items.group.other' },
]

export interface CatalogEntry {
  item: StaticItemData
  group: CatalogGroup
  /** What the item is built from, one id per copy (Data Dragon repeats a component taken twice). */
  from: number[]
  /** The items that list this one in their recipe. */
  into: number[]
  /** Gold paid for the combining itself, past its components; null for an item with no recipe. */
  combineCost: number | null
}

const RIFT = 11
const RIFT_ID_CEILING = 10_000

/** Case and accents ignored, so "botas" finds "Botas" and "cetro" finds "Cetro". */
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * The catalogue. Without `allModes` only the Summoner's Rift shop: what the
 * shop sells, one item per name (Data Dragon lists some twice, the lower id is
 * the Rift's), consumables, trinkets and wards included under "other". With
 * it, every item of the list, the other modes' too.
 */
export function buildCatalog(items: Record<number, StaticItemData>, allModes = false): CatalogEntry[] {
  const shopGroups = kitItemGroups(items)
  const intoOf = new Map<number, number[]>()
  for (const item of Object.values(items)) {
    for (const component of new Set(item.from ?? [])) {
      intoOf.set(component, [...(intoOf.get(component) ?? []), item.id])
    }
  }

  const named = new Set<string>()
  const entries: CatalogEntry[] = []
  for (const item of Object.values(items).sort((a, b) => a.id - b.id)) {
    if (!allModes) {
      const onRift = item.id < RIFT_ID_CEILING
        && item.inStore !== false
        && item.purchasable !== false
        && (item.maps?.includes(RIFT) ?? true)
        && named.has(item.name) === false
      if (!onRift) continue
      named.add(item.name)
    }
    const from = item.from ?? []
    const known = from.every(id => items[id])
    entries.push({
      item,
      group: shopGroups.get(item.id) ?? 'other',
      from,
      into: intoOf.get(item.id) ?? [],
      combineCost: from.length > 0 && known
        ? Math.max(0, item.totalGold - from.reduce((sum, id) => sum + items[id]!.totalGold, 0))
        : null,
    })
  }
  return entries
}

/** The entries of `group` (all when null) whose name or one-liner holds every word of `query`. */
export function searchCatalog(entries: CatalogEntry[], query: string, group: CatalogGroup | null): { group: CatalogGroup, label: string, entries: CatalogEntry[] }[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  const matches = (entry: CatalogEntry) => {
    const haystack = fold(`${entry.item.name} ${entry.item.plaintext ?? ''}`)
    return words.every(word => haystack.includes(word))
  }
  return CATALOG_GROUPS
    .filter(section => !group || section.group === group)
    .map(section => ({
      group: section.group,
      label: tr(section.label),
      entries: entries
        .filter(entry => entry.group === section.group && matches(entry))
        .sort((a, b) => a.item.totalGold - b.item.totalGold || a.item.name.localeCompare(b.item.name)),
    }))
    .filter(section => section.entries.length > 0)
}
