import { describe, expect, it } from 'vitest'
import type { ItemRead } from '~/utils/jev-read'
import type { JevOption, JevSlot } from '~/utils/jev-build'
import type { Needs } from '~/utils/jev-recommend'
import { rankSlot } from '~/utils/jev-recommend'
import { RESIST_DUE, bootsUrgency, dueAt, duesOf, healCutFits } from '~/utils/jev-rules'

const item = (fields: Partial<ItemRead> = {}): ItemRead => ({ antiHeal: 0, tenacity: 0, antiBurst: 0, vsAutos: 0, vsTanks: 0, kit: 0.5, ...fields })
const TAGS: Record<number, string[]> = { 6333: ['Damage', 'Armor', 'Health'], 3071: ['Damage', 'Health', 'ArmorPenetration'], 3047: ['Armor', 'Boots'], 3065: ['SpellBlock', 'Health'] }
const tags = (id: number) => TAGS[id] ?? []
const ad = { physical: 0.9, magic: 0.1 }
const ap = { physical: 0.1, magic: 0.9 }

describe('resistances due (LoLTheory)', () => {
  it('calls for armor with two enemies dealing mostly physical damage, magic resist with two dealing mostly magic', () => {
    expect(duesOf([ad, ad, ap, ap, ap])).toEqual(['physical', 'magic'])
    expect(duesOf([ad, ap, ap, ap, ap])).toEqual(['magic'])
    expect(duesOf([ad])).toEqual([])
  })

  it('makes armor due from the second item, magic resist from the third, until an item of it is held — boots apart', () => {
    expect(RESIST_DUE).toEqual({ physical: { enemies: 2, by: 2 }, magic: { enemies: 2, by: 3 } })
    expect(dueAt(['physical', 'magic'], 1, [], tags)).toEqual([])
    expect(dueAt(['physical', 'magic'], 2, [3071], tags)).toEqual(['physical'])
    expect(dueAt(['physical', 'magic'], 2, [3071, 3047], tags)).toEqual(['physical'])
    expect(dueAt(['physical', 'magic'], 3, [3071, 6333], tags)).toEqual(['magic'])
    expect(dueAt(['physical', 'magic'], 4, [3071, 6333, 3065], tags)).toEqual([])
  })

  it('raises an armor item over a damage item at the second slot when armor is due', () => {
    const option = (key: string, itemIds: number[]): JevOption => ({ key, label: key, itemIds, games: 3000, pickRate: 0.5, winRate: 0.5 })
    const slot: JevSlot = { name: 'item2', kind: 'item', lane: false, options: [option('o0', [3071]), option('o1', [6333])] }
    // An even split: armor answers nothing unless the rule makes it due.
    const team: Needs = { physical: 0.45, magic: 0.55, cc: 0, heal: 0, burst: 0, autos: 0, tanks: 0 }
    const context = { team, lane: team, itemReads: new Map([[3071, item({ vsTanks: 0.9, kit: 0.9 })], [6333, item({ kit: 0.9 })]]), tags, fits: {}, urgency: null }
    expect(rankSlot(slot, context).pick.key).toBe('o0')
    expect(rankSlot(slot, { ...context, due: ['physical'] }).pick.key).toBe('o1')
  })
})

describe('one Grievous Wounds item', () => {
  const reads = new Map([[3165, item({ antiHeal: 0.98 })], [3075, item({ antiHeal: 0.95, vsAutos: 0.9 })], [3157, item()]])

  it('keeps a second one out of a build that holds one', () => {
    expect(healCutFits(3075, [3165], reads)).toBe(false)
    expect(healCutFits(3075, [3157], reads)).toBe(true)
    expect(healCutFits(3157, [3165], reads)).toBe(true)
  })
})

describe('an enchanter\'s boots (LoLTheory)', () => {
  it('waits for the second item on an enchanter support, Jev\'s read of the lane elsewhere', () => {
    expect(bootsUrgency(0.9, { classes: ['Support', 'Mage'] }, 'UTILITY')).toBe(0)
    expect(bootsUrgency(null, { classes: ['Support', 'Mage'] }, 'UTILITY')).toBe(0)
    expect(bootsUrgency(0.9, { classes: ['Tank', 'Support'] }, 'UTILITY')).toBe(0.9)
    expect(bootsUrgency(0.9, { classes: ['Support', 'Mage'] }, 'MIDDLE')).toBe(0.9)
  })
})
