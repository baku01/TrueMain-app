import { describe, expect, it } from 'vitest'
import type { ItemRead } from '~/utils/jev-read'
import type { JevOption, JevSlot } from '~/utils/jev-build'
import type { EnemyLine, Needs, RankContext } from '~/utils/jev-recommend'
import { addedWinProbability, answersDraft, fitOf, itemSetOf, laneNeeds, needsOf, rankPicks, rankSlot, slotWpa, statsOf } from '~/utils/jev-recommend'

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
    // A team as solo queue draws them: every fact near the champions' average, no need.
    const usual = [1, 2, 3, 4, 5].map(id => line(id, { cc: 0.44, heal: 0.17, burst: 0.49, tank: 0.33, autos: 0.43 }))
    for (const need of ['cc', 'heal', 'burst', 'tanks', 'autos'] as const) expect(needsOf(usual)[need]).toBeCloseTo(0)
    const lockdown = [line(1, { cc: 1 }), line(2, { cc: 0.6 }), line(3, { cc: 0.44 }), line(4, { cc: 0.44 }), line(5, { cc: 0.44 })]
    expect(needsOf(lockdown).cc).toBeCloseTo(0.9)
    const assassins = [line(1, { burst: 1 }), line(2, { burst: 1 }), line(3, { burst: 0.5 }), line(4, { burst: 0.5 }), line(5, { burst: 0.5 })]
    expect(needsOf(assassins).burst).toBe(1)
    expect(needsOf([line(1, { cc: 0.5 })]).cc).toBeCloseTo(0.12)
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

  it('does not take Maw of Malmortius\'s shield for an answer to a physical team\'s burst: it shields magic damage only', () => {
    const maw = new Map([[3156, item({ antiBurst: 0.9 })]])
    const mawTags = (id: number) => (id === 3156 ? ['Damage', 'SpellBlock'] : tags(id))
    expect(fitOf([3156], needs({ physical: 0.83, magic: 0.05, burst: 1 }), maw, mawTags)).toMatchObject({ misfit: false, answers: [] })
    expect(fitOf([3156], needs({ physical: 0.07, magic: 0.87, burst: 1 }), maw, mawTags).answers.map(answer => answer.need)).toEqual(['magic', 'burst'])
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

  it('pulls WPA toward nothing by its games, and toward the matchup\'s only as far as the matchup\'s games go', () => {
    expect(addedWinProbability(option('o0', [1], { wpa: 0.02, wpaGames: 1000 }))).toBeCloseTo(0.01)
    expect(addedWinProbability(option('o0', [1], { wpa: 0.02, wpaGames: 1000, vsWpa: 0.12, vsGames: 1000 }))).toBeCloseTo(0.065)
    expect(addedWinProbability(option('o0', [1], { wpa: 0.02, wpaGames: 1000, vsWpa: 0.12, vsGames: 0 }))).toBeCloseTo(0.01)
    expect(addedWinProbability(option('o0', [1]))).toBeNull()
    const slot = [option('o0', [1], { wpa: 0.02, wpaGames: 1000 }), option('o1', [2], { wpa: 0, wpaGames: 1000 })]
    expect(slotWpa(slot)!(slot[0]!)).toBeCloseTo(0.005)
  })

  it('does not let a thin matchup outweigh the lane (Aatrox into Akali: Eclipse over Spear of Shojin)', () => {
    const eclipse = option('o0', [6692], { games: 2219, winRate: 0.5588, wpa: -0.0045, wpaGames: 6179, vsWpa: -0.0834, vsGames: 87 })
    const shojin = option('o1', [3161], { games: 92, winRate: 0.5435, wpa: -0.0006, wpaGames: 5191, vsWpa: 0.0482, vsGames: 64 })
    const stats = statsOf([eclipse, shojin])
    expect(stats.o1! - stats.o0!).toBeLessThan(0.08)
    expect(stats.o1).toBeLessThan(0.6)
  })

  it('does not compare a situational option\'s win rate, measured wherever the item was bought, with the slot\'s', () => {
    const stats = statsOf([option('o0', [1], { winRate: 0.56 }), option('o1', [2], { winRate: 0.56 }), option('o2', [3], { winRate: 0.497, games: 6179, situational: true })])
    expect(stats.o2).toBeCloseTo(0.5)
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

describe('rankPicks', () => {
  it('puts the source\'s ranking among the candidates beside what Jev read, a lane Jev did not judge giving its weight away', () => {
    const ranked = rankPicks([{ championId: 1, score: 3 }, { championId: 2, score: 1 }], new Map([
      [1, { lane: null, team: 0, enemy: 0, confidence: 0.8 }],
      [2, { lane: null, team: 1, enemy: 1, confidence: 0.8 }],
    ]))
    expect(ranked.map(pick => pick.championId)).toEqual([2, 1])
    expect(ranked[0]!.parts.lane).toBeUndefined()
    expect(ranked[1]!.parts.stats).toBeGreaterThan(0.5)
    expect(ranked[0]!.total).toBeCloseTo((0.4 * ranked[0]!.parts.stats + 0.2 + 0.15) / 0.75)
  })

  it('ranks on the source alone when Jev read nothing', () => {
    expect(rankPicks([{ championId: 1, score: 1 }, { championId: 2, score: 2 }], new Map()).map(pick => pick.championId)).toEqual([2, 1])
  })
})

describe('itemSetOf', () => {
  it('lays a build out as Blitz\'s set: the whole build in buying order, the boots where bought, every other option after it by score', () => {
    const slot = (name: string, options: JevOption[]): JevSlot => ({ name, kind: 'item', lane: false, options })
    const scored = (totals: Record<string, number>) => Object.fromEntries(Object.entries(totals).map(([key, total]) => [key, { total, parts: {}, answers: [], misfit: false }]))
    const first = slot('item1', [option('o0', [6692]), option('o1', [3161])])
    const later = slot('item4', [option('o0', [3071]), option('o1', [3156]), option('o2', [6333])])
    const ranked = [
      { slot: first, pick: first.options[0]!, standard: first.options[0]!, scored: scored({ o0: 0.6, o1: 0.5 }) },
      { slot: later, pick: later.options[0]!, standard: later.options[0]!, scored: scored({ o0: 0.62, o1: 0.4, o2: 0.58 }) },
    ]
    const build = { runePage: null, summonerSpells: null, starterItems: { itemIds: [1055, 2003], games: 1, pickRate: 1, winRate: 0.5 }, skillOrder: null, boots: { itemIds: [3047], games: 1, pickRate: 1, winRate: 0.5 }, order: [6692, 3047, 6610, 3071] }
    expect(itemSetOf(ranked, build)).toEqual({ starter: [1055, 2003], boots: [3047], core: [6692, 6610, 3071], situational: [6333, 3161, 3156], bootsAt: 1 })
  })
})
