import { describe, expect, it } from 'vitest'
import type { ItemRead } from '~/utils/jev-read'
import type { JevOption, JevSlot } from '~/utils/jev-build'
import type { EnemyLine, Needs, RankContext } from '~/utils/jev-recommend'
import { answersDraft, fitOf, laneNeeds, needsOf, rankSlot, slotWpa, statsOf } from '~/utils/jev-recommend'

const read = (fields: Partial<EnemyLine['read']> = {}) => ({ cc: 0, heal: 0, burst: 0, autos: 0, tank: 0, confidence: 1, ...fields })
const item = (fields: Partial<ItemRead> = {}): ItemRead => ({ antiHeal: 0, tenacity: 0, antiBurst: 0, vsAutos: 0, vsTanks: 0, kit: 0.5, ...fields })
const TAGS: Record<number, string[]> = { 3047: ['Armor', 'Boots'], 3111: ['SpellBlock', 'Boots'], 3065: ['SpellBlock', 'Health'], 6333: ['Damage', 'Armor'], 3071: ['Damage', 'Health'] }
const tags = (id: number) => TAGS[id] ?? []
const needs = (fields: Partial<Needs>): Needs => ({ physical: 0.5, magic: 0.5, cc: 0, heal: 0, burst: 0, autos: 0, tanks: 0, ...fields })
const option = (key: string, itemIds: number[], fields: Partial<JevOption> = {}): JevOption => ({ key, label: key, itemIds, games: 900, pickRate: 0.3, winRate: 0.5, ...fields })

describe('needsOf', () => {
  it('weighs the damage split by what each enemy deals', () => {
    const team = needsOf([
      { id: 122, read: read(), physical: 1, magic: 0, weight: 3 },
      { id: 99, read: read(), physical: 0, magic: 1, weight: 1 },
    ])
    expect(team.physical).toBeCloseTo(0.75)
    expect(team.magic).toBeCloseTo(0.25)
  })

  it('reads the kits\' facts as what stands out of a usual team', () => {
    const line = (id: number, fields: Partial<EnemyLine['read']>): EnemyLine => ({ id, read: read(fields), physical: 0.5, magic: 0.5, weight: 1 })
    const usual = [1, 2, 3, 4, 5].map(id => line(id, { cc: 0.4, tank: 0.2, autos: 0.25 }))
    expect(needsOf(usual)).toMatchObject({ cc: 0, tanks: 0, autos: 0 })
    const lockdown = [line(1, { cc: 1 }), line(2, { cc: 1 }), line(3, { cc: 0.4 }), line(4, { cc: 0.4 }), line(5, { cc: 0.4 })]
    expect(needsOf(lockdown).cc).toBeCloseTo(0.8)
    expect(needsOf([line(1, { cc: 0.5 })]).cc).toBeCloseTo(0.2)
    expect(needsOf([line(1, { cc: 1 })]).cc).toBe(1)
  })

  it('leans on the lane opponent while laning', () => {
    expect(laneNeeds(needs({ magic: 1, physical: 0 }), needs({ magic: 0, physical: 1 })).physical).toBeCloseTo(0.6)
    expect(laneNeeds(needs({}), null)).toEqual(needs({}))
  })
})

describe('fitOf', () => {
  const reads = new Map([[3111, item({ tenacity: 0.97 })], [3047, item({ vsAutos: 0.9 })]])

  it('marks Mercury\'s Treads a misfit into a physical lane with little crowd control', () => {
    const darius = needs({ physical: 0.9, magic: 0.1, cc: 0.2 })
    expect(fitOf([3111], darius, reads, tags).misfit).toBe(true)
    expect(fitOf([3047], darius, reads, tags)).toMatchObject({ misfit: false, answers: [{ need: 'physical' }] })
  })

  it('keeps Mercury\'s Treads against heavy crowd control even when the damage is physical', () => {
    expect(fitOf([3111], needs({ physical: 0.8, magic: 0.2, cc: 0.7 }), reads, tags).misfit).toBe(false)
  })

  it('calls Mercury\'s Treads a misfit into a lone physical laner, whatever its crowd control', () => {
    expect(fitOf([3111], laneNeeds(needs({ physical: 0.9, magic: 0.05, cc: 0.5 }), needs({ physical: 0.9, magic: 0.05, cc: 0.5 })), reads, tags).misfit).toBe(true)
  })

  it('never calls a damage item with resistances a misfit', () => {
    expect(fitOf([6333], needs({ physical: 0.1, magic: 0.9 }), reads, tags).misfit).toBe(false)
  })

  it('offers where it was not measured only what answers the draft', () => {
    const magic = needs({ physical: 0.2, magic: 0.8 })
    expect(answersDraft(3065, magic, reads, tags)).toBe(true)
    expect(answersDraft(3071, magic, reads, tags)).toBe(false)
  })
})

describe('statistics', () => {
  it('reads an option even with its slot as 0.5, the sample pulling a rare one in', () => {
    const stats = statsOf([option('o0', [1], { winRate: 0.5 }), option('o1', [2], { winRate: 0.5 }), option('o2', [3], { winRate: 0.56, games: 40 }), option('o3', [4], { winRate: 0.53, games: 3000 }), option('o4', [5], { games: 0 })])
    expect(stats.o0).toBeLessThan(0.5)
    expect(stats.o3).toBeGreaterThan(0.5)
    expect(stats.o2).toBeLessThan(stats.o3!)
    expect(stats.o4).toBeNull()
  })

  it('weighs the matchup\'s WPA only when every option has its games, centred on the slot', () => {
    const both = slotWpa([option('o0', [1], { wpa: 0.01, vsWpa: 0.06, vsGames: 90 }), option('o1', [2], { wpa: 0.01, vsWpa: 0.0, vsGames: 90 })])!
    expect(both(option('o0', [1], { wpa: 0.01, vsWpa: 0.06, vsGames: 90 }))).toBeCloseTo(0.018)
    const thin = slotWpa([option('o0', [1], { wpa: 0.03, vsWpa: 0.06, vsGames: 90 }), option('o1', [2], { wpa: 0.01, vsWpa: 0.0, vsGames: 10 })])!
    expect(thin(option('o0', [1], { wpa: 0.03 }))).toBeCloseTo(0.01)
  })

  it('leaves WPA out of a slot where an option was not measured on it', () => {
    expect(slotWpa([option('o0', [3047], { wpa: -0.059 }), option('o1', [3111])])).toBeNull()
  })
})

describe('rankSlot', () => {
  const context = (lane: Needs, itemReads = new Map<number, ItemRead>()): RankContext => ({ team: lane, lane, itemReads, tags, fits: {}, urgency: null })

  it('takes Plated Steelcaps over Mercury\'s Treads against Darius, the statistics even', () => {
    const boots: JevSlot = { name: 'boots', kind: 'boots', lane: true, options: [option('o0', [3111]), option('o1', [3047])] }
    const ranked = rankSlot(boots, context(needs({ physical: 0.9, magic: 0.1, cc: 0.2 }), new Map([[3111, item({ tenacity: 0.97, kit: 0.8 })], [3047, item({ vsAutos: 0.9, kit: 0.6 })]])))
    expect(ranked.pick.key).toBe('o1')
    expect(ranked.standard.key).toBe('o0')
    expect(ranked.scored.o0!.misfit).toBe(true)
  })

  it('does not let boots Blitz did not measure beat the measured ones on WPA (Aatrox into Ambessa)', () => {
    const boots: JevSlot = { name: 'boots', kind: 'boots', lane: true, options: [
      option('o0', [3047], { winRate: 0.5, wpa: -0.059 }),
      option('o1', [3111], { winRate: 0.505, games: 600 }),
    ] }
    const ambessa = needs({ physical: 0.9, magic: 0.05, cc: 0.5, autos: 0.5 })
    const ranked = rankSlot(boots, context(ambessa, new Map([[3111, item({ tenacity: 0.97, kit: 0.7 })], [3047, item({ vsAutos: 0.9, kit: 0.7 })]])))
    expect(ranked.pick.itemIds).toEqual([3047])
  })

  it('takes Berserker\'s Greaves on a marksman into a physical lane: armor answers it only as far as the champion uses it', () => {
    const boots: JevSlot = { name: 'boots', kind: 'boots', lane: true, options: [option('o0', [3006], { games: 30000 }), option('o1', [3047], { games: 200, winRate: 0.51 })] }
    const caitlyn = needs({ physical: 0.85, magic: 0.1, autos: 0.6 })
    const ranked = rankSlot(boots, context(caitlyn, new Map([[3006, item({ kit: 1 })], [3047, item({ vsAutos: 0.9, kit: 0.5 })]])))
    expect(ranked.pick.itemIds).toEqual([3006])
  })

  it('weighs an item\'s parts as WEIGHTS says, an unread kit giving its weight to the rest', () => {
    const slot: JevSlot = { name: 'item4', kind: 'item', lane: false, options: [option('o0', [3065]), option('o1', [3071])] }
    const ranked = rankSlot(slot, context(needs({ physical: 0.2, magic: 0.8 }), new Map([[3065, item({ kit: 1 })]])))
    const { parts, total } = ranked.scored.o0!
    expect(total).toBeCloseTo(0.4 * parts.stats! + 0.35 * parts.draft! + 0.25 * parts.kit!)
    const other = ranked.scored.o1!
    expect(other.parts.kit).toBeUndefined()
    expect(other.total).toBeCloseTo((0.4 * other.parts.stats! + 0.35 * other.parts.draft!) / 0.75)
  })

  it('times the boots by the lane\'s urgency', () => {
    const timing: JevSlot = { name: 'bootsAfter', kind: 'timing', lane: true, options: [0, 1, 2].map(after => option(`o${after}`, [], { after, games: 0 })) }
    expect(rankSlot(timing, { ...context(needs({})), urgency: 0.9 }).pick.key).toBe('o0')
    expect(rankSlot(timing, { ...context(needs({})), urgency: 0.1 }).pick.key).toBe('o2')
  })
})
