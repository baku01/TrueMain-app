import { describe, expect, it } from 'vitest'
import type { ItemRead } from '~/utils/jev-read'
import type { JevOption, JevSlot } from '~/utils/jev-build'
import type { EnemyLine, Needs, RankContext } from '~/utils/jev-recommend'
import { answersDraft, fitOf, itemSetOf, laneNeeds, modeled, needsOf, rankPicks, rankSlot, reasonMessage } from '~/utils/jev-recommend'
import { SELECTION, addedWinProbability, credibleEdge, slotWpa, statsOf } from '~/utils/jev-stats'

const read = (fields: Partial<EnemyLine['read']> = {}) => ({ cc: 0, ccReducible: 1, heal: 0, healInFight: 1, burst: 0, autos: 0, tank: 0, confidence: 1, ...fields })
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

  it('counts crowd control only as far as Tenacity shortens it, and healing only as far as it is done in fights (LoLTheory)', () => {
    const line = (id: number, fields: Partial<EnemyLine['read']>): EnemyLine => ({ id, read: read(fields), physical: 0.5, magic: 0.5, weight: 1 })
    // Five kits of knock-ups and suppression: a lot of crowd control, none of it for Mercury's Treads.
    const airborne = [1, 2, 3, 4, 5].map(id => line(id, { cc: 1, ccReducible: 0 }))
    expect(needsOf(airborne).cc).toBe(0)
    const half = [line(1, { cc: 1, ccReducible: 0 }), line(2, { cc: 1, ccReducible: 1 }), line(3, { cc: 1, ccReducible: 1 }), line(4, { cc: 1, ccReducible: 0 }), line(5, { cc: 0, ccReducible: 0 })]
    expect(needsOf(half).cc).toBeCloseTo(0.5)
    // Garen and Tahm Kench regenerate out of combat, where Grievous Wounds has run out.
    const regen = [line(1, { heal: 1, healInFight: 0 }), line(2, { heal: 1, healInFight: 0 }), line(3, { heal: 0.5, healInFight: 0 })]
    expect(needsOf(regen).heal).toBe(0)
    expect(needsOf([line(1, { heal: 1 }), line(2, { heal: 1 }), line(3, { heal: 0.5 })]).heal).toBe(1)
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

  it('reads a resistance a draft rule makes due as fully needed', () => {
    const even = needs({ physical: 0.55, magic: 0.45 })
    const calm = fitOf([3047], even, reads, tags)
    const due = fitOf([3047], even, reads, tags, { due: ['physical'] })
    expect(due.answers[0]).toEqual({ need: 'physical', value: 1 })
    expect(due.fit).toBeGreaterThan(calm.fit)
    // Due, armor is no misfit even where little of the damage is physical.
    expect(fitOf([3047], needs({ physical: 0.2, magic: 0.8 }), reads, tags, { due: ['physical'] }).misfit).toBe(false)
  })

  it('weighs items as told', () => {
    const lockdown = needs({ physical: 0.5, cc: 1 })
    const first = fitOf([3111, 6333], lockdown, reads, tags, { weights: [25, 2.5] })
    const last = fitOf([6333, 3111], lockdown, reads, tags, { weights: [25, 2.5] })
    expect(first.answers.find(answer => answer.need === 'cc')!.value).toBeCloseTo(0.97 * 25 / 27.5)
    expect(last.answers.find(answer => answer.need === 'cc')).toBeUndefined()
  })

  it('offers where it was not measured only what answers the draft', () => {
    const magic = needs({ physical: 0.2, magic: 0.8 })
    expect(answersDraft(3065, magic, reads, tags)).toBe(true)
    expect(answersDraft(3071, magic, reads, tags)).toBe(false)
  })
})

describe('statistics', () => {
  it('reads the slot\'s most played option as 0.5, and every other by its credible edge over it', () => {
    const stats = statsOf([option('o0', [1], { winRate: 0.5 }), option('o1', [2], { winRate: 0.5 }), option('o2', [3], { winRate: 0.56, games: 40 }), option('o3', [4], { winRate: 0.53, games: 3000 }), option('o4', [5], { games: 0 })])
    expect(stats.o3).toBeCloseTo(0.5)
    expect(stats.o0).toBeLessThan(0.5)
    // Forty games cannot vouch for an edge, however well they went: even with the reference, not above it.
    expect(stats.o2).toBeCloseTo(0.5)
    expect(stats.o4).toBeNull()
  })

  it('takes the selection a rare pair of boots wins by off its rate (Caitlyn: Grevas Vorazes 4% at 53.8%, Berserker\'s Greaves 83% at 50.4%)', () => {
    const berserker = option('o0', [3006], { games: 47843, winRate: 0.5043, pickRate: 0.8314 })
    const voracious = option('o1', [3008], { games: 2489, winRate: 0.538, pickRate: 0.0433 })
    const steelcaps = option('o2', [3047], { games: 615, winRate: 0.5561, pickRate: 0.0107 })
    // +3.4 points, of which the share explains +2.8: what is left is not sure.
    expect(credibleEdge(voracious, berserker, SELECTION.boots, entry => entry.pickRate)).toBe(0)
    const stats = statsOf([berserker, voracious, steelcaps], 'boots')
    expect(stats.o0).toBeCloseTo(0.5)
    expect(stats.o1).toBeCloseTo(0.5)
    expect(stats.o2).toBeCloseTo(0.5)
  })

  it('takes no selection off a choice made before the game: only chance stands between it and the reference', () => {
    const teleport = option('o0', [], { games: 15800, winRate: 0.479, pickRate: 0.54 })
    // Jayce top: Ignite over 13,419 games, +2.6 points — sure.
    expect(credibleEdge(option('o1', [], { games: 13419, winRate: 0.505, pickRate: 0.458 }), teleport, SELECTION.choice, entry => entry.pickRate)).toBeGreaterThan(0.005)
    // The same +2.6 points over 600 games is not.
    expect(credibleEdge(option('o2', [], { games: 600, winRate: 0.505, pickRate: 0.02 }), teleport, SELECTION.choice, entry => entry.pickRate)).toBe(0)
    // A shortfall counts at its estimate.
    expect(credibleEdge(option('o3', [], { games: 13419, winRate: 0.459, pickRate: 0.458 }), teleport, SELECTION.choice, entry => entry.pickRate)).toBeLessThan(-0.005)
  })

  it('pulls WPA toward nothing by its games, and toward the matchup\'s only as far as the matchup\'s games go', () => {
    expect(addedWinProbability(option('o0', [1], { wpa: 0.02, wpaGames: 1000 }))).toBeCloseTo(0.01)
    expect(addedWinProbability(option('o0', [1], { wpa: 0.02, wpaGames: 1000, vsWpa: 0.12, vsGames: 1000 }))).toBeCloseTo(0.065)
    expect(addedWinProbability(option('o0', [1], { wpa: 0.02, wpaGames: 1000, vsWpa: 0.12, vsGames: 0 }))).toBeCloseTo(0.01)
    expect(addedWinProbability(option('o0', [1]))).toBeNull()
    const slot = [option('o0', [1], { wpa: 0.02, wpaGames: 1000 }), option('o1', [2], { wpa: 0, wpaGames: 1000 })]
    expect(slotWpa(slot)!(slot[0]!)).toBeCloseTo(0.005)
  })

  it('weighs a thin matchup by its games, no further than the measured spread allows (Aatrox into Akali)', () => {
    const eclipse = option('o0', [6692], { games: 2219, winRate: 0.5588, wpa: -0.0045, wpaGames: 6179, vsWpa: -0.0834, vsGames: 87 })
    const shojin = option('o1', [3161], { games: 92, winRate: 0.5435, wpa: -0.0006, wpaGames: 5191, vsWpa: 0.0482, vsGames: 64 })
    const full = statsOf([eclipse, shojin], 'item')
    const lane = statsOf([{ ...eclipse, vsGames: 0 }, { ...shojin, vsGames: 0 }], 'item')
    // −8.3 and +4.8 points over 87 and 64 games: a 13-point gap that moves the estimate by under one.
    const gap = (one: JevOption, other: JevOption) => addedWinProbability(one)! - addedWinProbability(other)!
    expect(gap(shojin, eclipse) - gap({ ...shojin, vsGames: 0 }, { ...eclipse, vsGames: 0 })).toBeLessThan(0.01)
    // Neither the lane's 0.4 points nor the matchup's games make Spear of Shojin surely better than Eclipse.
    expect(full.o1).toBeCloseTo(0.5)
    expect(lane.o1).toBeCloseTo(0.5)
  })

  it('does not compare a situational option\'s win rate, measured wherever the item was bought, with the slot\'s', () => {
    const stats = statsOf([option('o0', [1], { winRate: 0.56 }), option('o1', [2], { winRate: 0.56 }), option('o2', [3], { winRate: 0.497, games: 6179, situational: true })])
    expect(stats.o2).toBeCloseTo(0.5)
  })

  it('reads an item\'s WPA at the slot\'s place of the build, pulled toward its WPA elsewhere by how far slots truly stray', () => {
    // Jinx's Infinity Edge (16.22, Emerald+): +1.41 points over 24,881 games, +0.74 as her second item over 4,943, +1.20 after Kraken Slayer over 2,319.
    const ie = option('o1', [3031], { wpa: 0.01406, wpaGames: 24881 })
    const atSlot = addedWinProbability({ ...ie, slotWpa: 0.00742, slotGames: 4943 })!
    expect(atSlot).toBeLessThan(addedWinProbability(ie)!)
    expect(atSlot).toBeGreaterThan(0.00742)
    // A thin slot reading is pulled to the item's own WPA, not to nothing.
    expect(addedWinProbability({ ...ie, slotWpa: -0.1, slotGames: 30 })).toBeCloseTo(addedWinProbability(ie)!, 3)
    // An item bought only at that slot: its lane and slot readings are the same games, counted once.
    const only = option('o2', [6676], { wpa: 0.04, wpaGames: 500 })
    expect(addedWinProbability({ ...only, slotWpa: 0.04, slotGames: 500 })).toBeCloseTo(addedWinProbability(only)!, 2)
    // After the items held before it, the path's reading narrows it again, as far as its games go: a little, toward +1.20.
    const onPath = addedWinProbability({ ...ie, slotWpa: 0.00742, slotGames: 4943, pathWpa: 0.01195, pathGames: 2319 })!
    expect(onPath).toBeLessThan(atSlot)
    expect(onPath).toBeGreaterThan(0.01195)
  })

  it('compares a slot\'s items as measured at that place (Jinx\'s second item after Kraken Slayer)', () => {
    const runaan = option('o0', [3085], { games: 19557, pickRate: 0.8, wpa: 0.00545, wpaGames: 28226 })
    const ie = option('o1', [3031], { games: 2319, pickRate: 0.1, wpa: 0.01406, wpaGames: 24881 })
    const dancer = option('o2', [3046], { games: 2112, pickRate: 0.1, wpa: 0.00648, wpaGames: 3959 })
    // Over every slot, Infinity Edge's 0.9 points over Runaan's Hurricane read surely better…
    expect(statsOf([runaan, ie, dancer], 'item').o1).toBeGreaterThan(0.5)
    // …but as the second item, after Kraken Slayer, the edge is not sure.
    const here = (entry: JevOption, slot: [number, number], path: [number, number]) => ({ ...entry, slotWpa: slot[0], slotGames: slot[1], pathWpa: path[0], pathGames: path[1] })
    const stats = statsOf([here(runaan, [0.00416, 24836], [0.00519, 19557]), here(ie, [0.00742, 4943], [0.01195, 2319]), here(dancer, [0.0045, 3186], [0.00876, 2112])], 'item')
    expect(stats.o1).toBeCloseTo(0.5)
  })

  it('pulls a thin option\'s rate toward the edge the same item\'s WPA shows, not toward nothing', () => {
    const reference = option('o0', [1], { games: 30000, winRate: 0.5, pickRate: 0.6, wpa: 0, wpaGames: 30000 })
    const thin = option('o1', [2], { games: 29, winRate: 0.7586, pickRate: 0.001 })
    const known = { ...thin, wpa: -0.04, wpaGames: 20000 }
    expect(credibleEdge(thin, reference, SELECTION.item, entry => entry.pickRate)).toBe(0)
    // 75.9% over 29 games reads what the item does elsewhere: four points below the reference.
    expect(credibleEdge(known, reference, SELECTION.item, entry => entry.pickRate, -0.04 * (20000 / 21000))).toBeLessThan(-0.03)
    // In a slot not every option of which Blitz measured, the rates compare, each pulled toward its WPA.
    const stats = statsOf([reference, known, option('o2', [3], { games: 400, winRate: 0.5, pickRate: 0.1 })], 'item')
    expect(stats.o1).toBeLessThan(0.1)
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
    expect(ranked.reason).toEqual({ kind: 'draft', need: 'physical' })
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

  it('takes Plated Steelcaps on a marksman into physical burst (Caitlyn into Jhin, Zed and Pyke): there armor answers whatever the kit makes of it', () => {
    const boots: JevSlot = { name: 'boots', kind: 'boots', lane: true, options: [option('o0', [3006], { games: 47843, winRate: 0.5043, pickRate: 0.83 }), option('o1', [3047], { games: 615, winRate: 0.5561, pickRate: 0.0107 })] }
    const assassins = needs({ physical: 0.9, magic: 0.05, burst: 0.8, autos: 0.2 })
    const ranked = rankSlot(boots, context(assassins, new Map([[3006, item({ kit: 1 })], [3047, item({ antiBurst: 0.6, vsAutos: 0.9, kit: 0.5 })]])))
    expect(ranked.pick.itemIds).toEqual([3047])
    expect(ranked.reason).toEqual({ kind: 'draft', need: 'physical' })
  })

  it('weighs an item\'s parts as WEIGHTS says, an unread kit giving its weight to the rest', () => {
    // Under 30 games the kit weighs its whole share (`modeled`).
    const slot: JevSlot = { name: 'item4', kind: 'item', lane: false, options: [option('o0', [3065], { games: 20 }), option('o1', [3071], { games: 20 })] }
    const ranked = rankSlot(slot, context(needs({ physical: 0.2, magic: 0.8 }), new Map([[3065, item({ kit: 1 })]])))
    const { parts, total } = ranked.scored.o0!
    expect(total).toBeCloseTo(0.4 * parts.stats! + 0.35 * parts.draft! + 0.25 * parts.kit!)
    const other = ranked.scored.o1!
    expect(other.parts.kit).toBeUndefined()
    expect(other.total).toBeCloseTo((0.4 * other.parts.stats! + 0.35 * other.parts.draft!) / 0.75)
    // Over 900 games, a thirtieth of it.
    const measured = rankSlot({ ...slot, options: [option('o0', [3065], { games: 900 })] }, context(needs({ physical: 0.2, magic: 0.8 }), new Map([[3065, item({ kit: 1 })]]))).scored.o0!
    expect(measured.total).toBeCloseTo((0.4 * measured.parts.stats! + 0.35 * measured.parts.draft! + 0.25 / 30 * measured.parts.kit!) / (0.75 + 0.25 / 30))
  })

  it('keeps the most played when the statistics are even and only Jev\'s read of the kit favours a rarer option', () => {
    const slot: JevSlot = { name: 'item2', kind: 'item', lane: false, options: [option('o0', [3071], { games: 30000 }), option('o1', [3153], { games: 60 })] }
    const ranked = rankSlot(slot, context(needs({}), new Map([[3071, item({ kit: 0.3 })], [3153, item({ kit: 1 })]])))
    expect(ranked.scored.o0!.parts.stats).toBeCloseTo(0.5)
    expect(ranked.scored.o1!.parts.stats).toBeCloseTo(0.5)
    // Its total is the higher, on the read alone: no reason to part from what the bracket builds.
    expect(ranked.scored.o1!.total).toBeGreaterThan(ranked.scored.o0!.total)
    expect(ranked.pick.key).toBe('o0')
    expect(ranked.reason).toBeUndefined()
    expect(ranked.scored.o1!.reason).toBeUndefined()
  })

  it('takes an item that answers a need of the enemy team the most played does not: Grievous Wounds into heavy healing', () => {
    const slot: JevSlot = { name: 'item4', kind: 'item', lane: false, options: [option('o0', [3071], { games: 20000 }), option('o1', [3165], { games: 800 })] }
    const reads = new Map([[3071, item({ kit: 0.9 })], [3165, item({ antiHeal: 0.98, kit: 0.8 })]])
    const ranked = rankSlot(slot, context(needs({ heal: 1 }), reads))
    expect(ranked.pick.key).toBe('o1')
    expect(ranked.reason).toEqual({ kind: 'draft', need: 'heal' })
    // A little healing past a usual team's does not call for it: the most played stays, though the read kit put it ahead before.
    const little = rankSlot(slot, context(needs({ heal: 0.3 }), reads))
    expect(little.scored.o1!.answers.map(answer => answer.need)).toEqual(['heal'])
    expect(little.pick.key).toBe('o0')
  })

  it('takes an option whose games prove an edge over the most played, and says by how much (Jayce top: Ignite over Teleport)', () => {
    const spells: JevSlot = { name: 'spells', kind: 'spells', lane: true, options: [option('o0', [], { games: 15800, winRate: 0.479, pickRate: 0.54 }), option('o1', [], { games: 13419, winRate: 0.505, pickRate: 0.458 })] }
    const ranked = rankSlot(spells, context(needs({})))
    expect(ranked.pick.key).toBe('o1')
    expect(ranked.reason).toMatchObject({ kind: 'proven' })
    expect(ranked.reason!.kind === 'proven' && ranked.reason!.edge).toBeGreaterThan(0.005)
    // The same +2.6 points over 600 games prove nothing.
    const thin = { ...spells, options: [spells.options[0]!, { ...spells.options[1]!, games: 600, pickRate: 0.02 }] }
    expect(rankSlot(thin, context(needs({}))).pick.key).toBe('o0')
  })

  it('takes a rune page Jev read suits the lane clearly better, with confidence, unless its games show it wins credibly less', () => {
    const runes: JevSlot = { name: 'runes', kind: 'runes', lane: true, options: [option('o0', [], { games: 20000 }), option('o1', [], { games: 2000 })] }
    const fit = (value: number, confidence = 0.85) => ({ fit: value, confidence })
    const ranked = (slot: JevSlot, mine: { fit: number, confidence: number }) => rankSlot(slot, { ...context(needs({})), fits: { r_o0: fit(0.45), r_o1: mine } })
    expect(ranked(runes, fit(0.85))).toMatchObject({ pick: { key: 'o1' }, reason: { kind: 'lane', fit: 0.85, standard: 0.45 } })
    // A little better, or read unsure: the most played stays, though its total is lower.
    expect(ranked(runes, fit(0.65)).pick.key).toBe('o0')
    const unsure = ranked(runes, fit(0.85, 0.5))
    expect(unsure.scored.o1!.total).toBeGreaterThan(unsure.scored.o0!.total)
    expect(unsure.pick.key).toBe('o0')
    // Three points below the most played over 5,000 games: credibly worse, whatever Jev read.
    const worse = ranked({ ...runes, options: [runes.options[0]!, { ...runes.options[1]!, games: 5000, winRate: 0.47 }] }, fit(0.85))
    expect(worse.scored.o1!.total).toBeGreaterThan(worse.scored.o0!.total)
    expect(worse.pick.key).toBe('o0')
  })

  it('weighs Jev\'s read of the kit only as far as the option\'s games are few (LoLTheory\'s "Modeled" rates, under 30)', () => {
    expect(modeled(0)).toBe(1)
    expect(modeled(20)).toBe(1)
    expect(modeled(300)).toBeCloseTo(0.1)
    expect(modeled(3000)).toBeCloseTo(0.01)
    const totalOf = (games: number, kit: number) => rankSlot(
      { name: 'item4', kind: 'item', lane: false, options: [option('o0', [3071], { games: 20000 }), option('o1', [3153], { games })] },
      context(needs({}), new Map([[3153, item({ kit })]])),
    ).scored.o1!.total
    expect(totalOf(20, 1) - totalOf(20, 0)).toBeGreaterThan(0.2)
    expect(totalOf(3000, 1) - totalOf(3000, 0)).toBeLessThan(0.005)
  })

  it('writes a reason as the line under the pick', () => {
    expect(reasonMessage({ kind: 'proven', edge: 0.0123 }, 'en')).toEqual({ key: 'jev.reason.proven', params: { points: '1.2' } })
    expect(reasonMessage({ kind: 'proven', edge: 0.0123 }, 'pt-BR').params).toEqual({ points: '1,2' })
    expect(reasonMessage({ kind: 'draft', need: 'heal' })).toEqual({ key: 'jev.reason.draft.heal' })
    expect(reasonMessage({ kind: 'draft', need: null })).toEqual({ key: 'jev.reason.draft.misfit' })
    expect(reasonMessage({ kind: 'lane', fit: 0.85, standard: 0.45 })).toEqual({ key: 'jev.reason.lane' })
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
