import { describe, expect, it } from 'vitest'
import type { StaticItemData } from '#shared/types/static-data'
import { buildCatalog, searchCatalog } from '~/utils/item-catalog'

function item(id: number, name: string, totalGold: number, extra: Partial<StaticItemData> = {}): StaticItemData {
  return { id, name, iconUrl: '', totalGold, maps: [11], ...extra }
}

const items: Record<number, StaticItemData> = Object.fromEntries([
  item(1001, 'Boots', 300, { tags: ['Boots'] }),
  item(1036, 'Long Sword', 350),
  item(1037, 'Pickaxe', 875),
  item(1038, 'B. F. Sword', 1300),
  item(3031, 'Infinity Edge', 3450, { from: [1038, 1037, 1036], plaintext: 'Massive critical damage' }),
  item(2003, 'Health Potion', 50, { tags: ['Consumable'] }),
  item(223031, 'Infinity Edge', 3450, { maps: [30] }),
  item(1500, 'Hidden Quest', 0, { inStore: false }),
  item(220000, 'Arena Prism', 1000, { maps: [30] }),
].map(entry => [entry.id, entry]))

describe('buildCatalog', () => {
  it('keeps the Rift shop only, one item a name', () => {
    expect(buildCatalog(items).map(entry => entry.item.id)).toEqual([1001, 1036, 1037, 1038, 2003, 3031])
  })

  it('lists every item of every mode on request', () => {
    expect(buildCatalog(items, true)).toHaveLength(Object.keys(items).length)
  })

  it('gives the recipe, what it builds into, and the cost of combining', () => {
    const edge = buildCatalog(items).find(entry => entry.item.id === 3031)!
    expect(edge.from).toEqual([1038, 1037, 1036])
    expect(edge.combineCost).toBe(3450 - (1300 + 875 + 350))
    const sword = buildCatalog(items).find(entry => entry.item.id === 1036)!
    expect(sword.into).toEqual([3031])
    expect(sword.combineCost).toBeNull()
  })

  it('has no combine cost when a component is unknown', () => {
    const broken = { 1: item(1, 'Orphan', 900, { from: [999] }) }
    expect(buildCatalog(broken)[0]!.combineCost).toBeNull()
  })
})

describe('searchCatalog', () => {
  const entries = buildCatalog(items)

  it('ignores case and accents and also reads the one-liner', () => {
    expect(searchCatalog(entries, 'CRÍTICAL', null).flatMap(s => s.entries.map(e => e.item.id))).toEqual([3031])
  })

  it('narrows to one group, cheapest first', () => {
    const ids = searchCatalog(entries, '', 'component')[0]!.entries.map(e => e.item.id)
    expect(ids).toEqual([1036, 1037, 1038])
  })
})
