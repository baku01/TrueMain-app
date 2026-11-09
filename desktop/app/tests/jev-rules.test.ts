import { describe, expect, it } from 'vitest'
import type { ItemRead } from '~/utils/jev-read'
import type { JevOption, JevSlot } from '~/utils/jev-build'
import type { Needs } from '~/utils/jev-recommend'
import { rankSlot } from '~/utils/jev-recommend'
import { RESIST_DUE, bootsUrgency, dueAt, duesOf, healCutFits, supportResists, withDraftBoots } from '~/utils/jev-rules'

const item = (fields: Partial<ItemRead> = {}): ItemRead => ({ antiHeal: 0, tenacity: 0, antiBurst: 0, vsAutos: 0, vsTanks: 0, kit: 0.5, ...fields })
const TAGS: Record<number, string[]> = { 6333: ['Damage', 'Armor', 'Health'], 3071: ['Damage', 'Health', 'ArmorPenetration'], 3047: ['Armor', 'Boots'], 3065: ['SpellBlock', 'Health'], 3036: ['Damage', 'ArmorPenetration'], 3156: ['SpellBlock', 'Damage', 'LifeSteal'] }
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
    expect(rankSlot(slot, { ...context, due: ['physical'] })).toMatchObject({ pick: { key: 'o1' }, reason: { kind: 'draft', need: 'physical' } })
  })
})

describe('a due resistance as a reason (LoLTheory)', () => {
  // Zed's third item into five magic damage dealers: Lord Dominik's Regards, the most played, against Maw of Malmortius from his pool.
  const option = (key: string, itemIds: number[], fields: Partial<JevOption> = {}): JevOption => ({ key, label: key, itemIds, games: 3000, pickRate: 0.5, winRate: 0.5, ...fields })
  const slot = (maw: Partial<JevOption> = {}, ldr: Partial<JevOption> = {}): JevSlot => ({ name: 'item3', kind: 'item', lane: false, place: 3, options: [
    option('o0', [3036], { games: 14142, pickRate: 0.65, winRate: 0.548, ...ldr }),
    option('o1', [3156], { games: 3371, pickRate: 0.016, winRate: 0.517, situational: true, ...maw }),
  ] })
  // Magic damage without burst, and Jev reading Maw as half suited to Zed: its fit to the draft halves, under the draft margin.
  const team: Needs = { physical: 0.07, magic: 0.85, cc: 0, heal: 0, burst: 0, autos: 0, tanks: 0 }
  const context = { team, lane: team, itemReads: new Map([[3036, item({ kit: 0.9 })], [3156, item({ kit: 0.5 })]]), tags, fits: {}, urgency: null }

  it('takes the resistance a rule makes due on the rule alone: no draft margin to clear', () => {
    expect(rankSlot(slot(), context).pick.key).toBe('o0')
    expect(rankSlot(slot(), { ...context, due: ['magic'] })).toMatchObject({ pick: { key: 'o1' }, reason: { kind: 'draft', need: 'magic' } })
  })

  it('reads a due resistance\'s shortfall against twice the bar: 1.4 points short is taken, 2.7 points not', () => {
    const measured = (maw: number) => rankSlot(slot({ wpa: maw, wpaGames: 30000 }, { wpa: 0.015, wpaGames: 30000 }), { ...context, due: ['magic'] })
    expect(measured(0)).toMatchObject({ pick: { key: 'o1' }, reason: { kind: 'draft', need: 'magic' } })
    expect(measured(-0.015).reason).toBeUndefined()
  })
})

describe('an enchanter\'s resistances (LoLTheory)', () => {
  // Riot's tags, Data Dragon 16.22.1.
  const RIOT: Record<number, string[]> = { 3190: ['Health', 'SpellBlock', 'Armor', 'Aura', 'Active', 'MagicResist', 'AbilityHaste'], 3109: ['Health', 'HealthRegen', 'Armor', 'Aura', 'Active', 'CooldownReduction', 'AbilityHaste'], 2524: ['Health', 'SpellBlock', 'Armor', 'AttackSpeed', 'NonbootsMovement', 'AbilityHaste'], 3157: ['Armor', 'SpellDamage', 'Active'], 3102: ['SpellBlock', 'SpellDamage'], 3111: ['Boots', 'SpellBlock', 'Tenacity'], 6620: ['Health', 'SpellDamage', 'ManaRegen', 'CooldownReduction', 'AbilityHaste'], 2526: ['Health'], 3116: ['Health', 'SpellDamage'] }
  const riot = (id: number) => RIOT[id] ?? []
  const support = supportResists(riot)

  it('makes no resistance due before the class takes a guard item: a marksman\'s fourth', () => {
    expect(dueAt(['physical'], 2, [6620], riot, 4)).toEqual([])
    expect(dueAt(['physical'], 3, [6620, 3116], riot, 4)).toEqual([])
    expect(dueAt(['physical'], 4, [6620, 3116, 2526], riot, 4)).toEqual(['physical'])
    expect(dueAt(['physical'], 2, [6620], riot)).toEqual(['physical'])
  })

  it('reads a resistance only on a support\'s item, one with no damage of its own: Locket, not Zhonya\'s Hourglass', () => {
    for (const id of [3190, 3109, 2524, 3111]) expect(support(id)).toEqual(riot(id))
    expect(support(3157)).toEqual(['SpellDamage', 'Active'])
    expect(support(3102)).toEqual(['SpellDamage'])
  })

  it('keeps a resistance due until a support\'s item holds it', () => {
    expect(dueAt(['physical', 'magic'], 3, [6620, 3157], riot)).toEqual(['magic'])
    expect(dueAt(['physical', 'magic'], 3, [6620, 3157], support)).toEqual(['physical', 'magic'])
    expect(dueAt(['physical', 'magic'], 3, [6620, 3190], support)).toEqual([])
  })

  // Seraphine support (Heal & Shield, Blitz, 16.22, Emerald+) into Aatrox, Neeko, Akali, Caitlyn and Lulu: armor due at her second item.
  it('takes Locket of the Iron Solari for an enchanter\'s due armor over her measured second item; Zhonya\'s answers it no more', () => {
    const team: Needs = { physical: 0.484, magic: 0.467, cc: 0.51, heal: 0.5, burst: 0.43, autos: 0.04, tanks: 0 }
    const reads = new Map([[2526, item({ kit: 0.9 })], [3116, item({ kit: 0.9 })], [3190, item({ antiBurst: 0.6, kit: 0.5 })], [3157, item({ antiBurst: 0.9, kit: 0.9 })]])
    const option = (key: string, id: number, fields: Partial<JevOption>): JevOption => ({ key, label: key, itemIds: [id], games: 0, pickRate: 0, winRate: 0.5, ...fields })
    const slot: JevSlot = { name: 'item2', kind: 'item', lane: false, place: 2, options: [
      option('o0', 2526, { games: 11478, pickRate: 0.811, winRate: 0.578, wpa: 0.0052, wpaGames: 19383, slotWpa: 0.008, slotGames: 14151, vsWpa: -0.021, vsGames: 1631 }),
      option('o1', 3116, { games: 2670, pickRate: 0.189, winRate: 0.582, wpa: -0.004, wpaGames: 29718, slotWpa: -0.004, slotGames: 9686, vsWpa: -0.024, vsGames: 2333 }),
      option('o2', 3190, { games: 765, pickRate: 0.0099, winRate: 0.571, situational: true, wpa: 0.0434, wpaGames: 765, slotWpa: 0.025, slotGames: 302, vsWpa: 0.003, vsGames: 53 }),
      option('o3', 3157, { games: 868, pickRate: 0.0077, winRate: 0.505, situational: true, wpa: -0.0284, wpaGames: 868, slotWpa: -0.042, slotGames: 241, vsWpa: -0.032, vsGames: 55 }),
    ] }
    const context = { team, lane: team, itemReads: reads, fits: {}, urgency: 0, due: ['physical' as const] }
    expect(rankSlot(slot, { ...context, tags: support })).toMatchObject({ pick: { key: 'o2' }, reason: { kind: 'draft', need: 'physical' } })
    expect(rankSlot(slot, { ...context, tags: support }).scored.o3!.reason).toBeUndefined()
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
    expect(bootsUrgency(0.9, 'Enchanter')).toBe(0)
    expect(bootsUrgency(null, 'Enchanter')).toBe(0)
    expect(bootsUrgency(0.9, 'Catcher')).toBe(0.9)
    expect(bootsUrgency(0.9, 'Burst')).toBe(0.9)
  })
})

describe('withDraftBoots', () => {
  const slot: JevSlot = { name: 'boots', kind: 'boots', lane: true, options: [
    { key: 'o0', label: '3006', itemIds: [3006], games: 47843, pickRate: 0.83, winRate: 0.5043 },
    { key: 'o1', label: '3009', itemIds: [3009], games: 3868, pickRate: 0.067, winRate: 0.5057 },
    { key: 'o2', label: '3008', itemIds: [3008], games: 2489, pickRate: 0.043, winRate: 0.538 },
  ] }
  const boots = [3006, 3009, 3008, 3047, 3111, 3158].map((id, index) => ({ itemIds: [id], games: [47843, 3868, 2489, 626, 399, 15][index]!, pickRate: 0.01, winRate: 0.5 }))

  it('offers Plated Steelcaps past the three most played when they answer the lane (Caitlyn into AD assassins)', () => {
    const offered = withDraftBoots(slot, boots, String, id => id === 3047 || id === 3158)
    expect(offered.options.map(option => option.itemIds[0])).toEqual([3006, 3009, 3008, 3047])
    expect(offered.options.at(-1)!.key).toBe('o3')
  })

  it('offers nothing more when no other pair answers the lane, or for another slot', () => {
    expect(withDraftBoots(slot, boots, String, () => false)).toBe(slot)
    const runes: JevSlot = { ...slot, name: 'runes', kind: 'runes' }
    expect(withDraftBoots(runes, boots, String, () => true)).toBe(runes)
  })
})
