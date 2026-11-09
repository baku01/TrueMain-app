import { describe, expect, it } from 'vitest'
import type { ItemRead } from '~/utils/jev-read'
import type { EnemyLine, Needs } from '~/utils/jev-needs'
import type { ItemOption } from '~/utils/sources/model'
import { PER_NEED, draftBlocks, draftOptionals } from '~/utils/jev-optionals'

const item = (fields: Partial<ItemRead> = {}): ItemRead => ({ antiHeal: 0, tenacity: 0, antiBurst: 0, vsAutos: 0, vsTanks: 0, kit: 0.5, ...fields })
const read = (fields: Partial<EnemyLine['read']> = {}) => ({ cc: 0, ccReducible: 1, heal: 0, healInFight: 1, burst: 0, autos: 0, tank: 0, confidence: 1, ...fields })
const m = (games: number, id: number, winRate = 0.5): ItemOption => ({ games, winRate, pickRate: 0.1, itemIds: [id] })
const TAGS: Record<number, string[]> = {
  3111: ['SpellBlock', 'Boots', 'Tenacity'], 3158: ['Boots', 'CooldownReduction'], 3156: ['SpellBlock', 'Damage', 'LifeSteal'], 3139: ['SpellBlock', 'Damage'],
  3814: ['Damage', 'Health', 'ArmorPenetration'], 6692: ['Damage'], 3102: ['SpellBlock', 'SpellDamage'], 3033: ['Damage', 'ArmorPenetration'], 3065: ['SpellBlock', 'Health'],
}
const tags = (id: number) => TAGS[id] ?? []

// Zed into Ekko, Anivia, Locke, Aurelion Sol and Amumu: 85% magic damage, burst and crowd control well past a usual team's.
const team: Needs = { physical: 0.07, magic: 0.85, cc: 0.52, heal: 0.3, burst: 0.73, autos: 0, tanks: 0 }
const enemies: EnemyLine[] = [
  { id: 245, physical: 0.2, magic: 0.8, weight: 1.2, read: read({ burst: 0.9, heal: 0.4 }) },
  { id: 34, physical: 0.05, magic: 0.95, weight: 1, read: read({ cc: 0.7 }) },
  { id: 136, physical: 0.1, magic: 0.9, weight: 1, read: read({ cc: 0.9 }) },
  { id: 32, physical: 0.1, magic: 0.9, weight: 0.7, read: read({ cc: 0.9, tank: 0.9 }) },
]
// Edge of Night's spell shield read as an answer to burst, as Maw of Malmortius's Lifeline.
const reads = new Map([[3111, item({ tenacity: 0.97 })], [3139, item({ tenacity: 0.9 })], [6692, item({ antiBurst: 0.4 })], [3156, item({ antiBurst: 0.6 })], [3814, item({ antiBurst: 0.6 })], [3033, item({ antiHeal: 1 })]])
const candidates = [m(18455, 3111, 0.502), m(84063, 3158, 0.526), m(11181, 3156, 0.517), m(678, 3139, 0.507), m(46879, 3814, 0.566), m(48372, 6692, 0.479), m(900, 3102), m(1707, 3033), m(12, 3065)]
const suits = (id: number) => id !== 3102
const zed = (held: number[] = []) => draftOptionals({ candidates, team, due: ['magic'], enemies, reads, tags, suits, held })

describe('optional by the draft', () => {
  it('lists each need of the draft that stands out, a due resistance first, with the champion\'s items that answer it, most first, the more played on a near tie', () => {
    const optionals = zed()
    expect(optionals.map(optional => optional.need)).toEqual(['magic', 'burst', 'cc', 'heal'])
    const [magic, burst, cc, heal] = optionals
    // Magic resist answers all of it, so by games: Mercury's Treads, Maw of Malmortius, Mercurial Scimitar. Banshee's Veil is an ability power item: not on Zed.
    expect(magic!.items.map(entry => entry.id)).toEqual([3111, 3156, 3139])
    expect(magic).toMatchObject({ call: 1, dueBy: 3, enemies: [245, 34, 136, 32] })
    // Edge of Night and Maw answer it alike, Edge of Night the more played; Eclipse less.
    expect(burst!.items.map(entry => entry.id)).toEqual([3814, 3156, 6692])
    expect(cc!.items.map(entry => entry.id)).toEqual([3111, 3139])
    expect(cc!.enemies).toEqual([136, 32, 34])
    expect(heal!.items.map(entry => entry.id)).toEqual([3033])
    expect(optionals.every(optional => optional.items.length <= PER_NEED)).toBe(true)
  })

  it('leaves out what is seen in too few games, and marks what the build holds', () => {
    expect(zed().flatMap(optional => optional.items.map(entry => entry.id))).not.toContain(3065)
    expect(zed([3156]).find(optional => optional.need === 'magic')!.items.find(entry => entry.id === 3156)!.inBuild).toBe(true)
  })

  it('offers no resistance against damage the team does not deal: magic resist alone into a physical team is a misfit', () => {
    const physical: Needs = { ...team, physical: 0.9, magic: 0.1 }
    const items = draftOptionals({ candidates: [m(900, 3065)], team: physical, due: [], enemies, reads, tags, suits, held: [] })
    expect(items).toEqual([])
  })

  it('writes a block per need, the enemies behind it named', () => {
    const blocks = draftBlocks(zed().slice(0, 1), id => ({ 245: 'Ekko', 34: 'Anivia', 136: 'Aurelion Sol', 32: 'Amumu' })[id] ?? String(id))
    expect(blocks).toEqual([{ need: 'magic', names: ['Ekko', 'Anivia', 'Aurelion Sol', 'Amumu'], items: [3111, 3156, 3139] }])
  })
})
