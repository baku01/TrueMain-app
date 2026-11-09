import type { StaticItemData } from '#shared/types/static-data'
import { describe, expect, it } from 'vitest'
import { againstTitle, buyingOrder, componentsOf, finalBuild, recommendedSets, withMeasuredPlaces } from '~/utils/recommended-item-set'

const item = (id: number, totalGold: number, from: number[] = []): StaticItemData => ({ id, name: String(id), iconUrl: '', totalGold, from })
const items: Record<number, StaticItemData> = Object.fromEntries([
  item(2003, 50), item(1055, 450), item(1001, 300), item(3020, 1100, [1001]),
  item(1052, 400), item(1053, 900), item(3145, 1100, [1052, 1052]), item(3146, 3000, [3145, 1053]),
  item(3057, 900), item(3113, 900), item(1026, 850), item(3100, 3100, [3057, 3113, 1026]),
  item(4645, 3000), item(3089, 3600), item(4646, 2900), item(3118, 2900), item(3111, 1250), item(3102, 3000), item(3157, 3250),
].map(entry => [entry.id, entry]))

// Blitz's own set for AP Ezreal, as it wrote it into the game's Recommended folder.
const ezreal = { key: 'draft', title: 'Ezreal', starter: [2003, 1055], path: [3146, 3100, 4645, 3089, 4646], boots: [3020], situational: [3118] }
const orders = { 3146: [{ items_order: [3145, 1052, 1053], games: 90, pick_rate_rank: 1 }], 3020: [{ items_order: [1001], games: 90, pick_rate_rank: 1 }] }

describe('recommended item sets', () => {
  it('puts the boots second in the final build', () => {
    expect(finalBuild(ezreal)).toEqual([3146, 3020, 3100, 4645, 3089, 4646])
  })

  it('puts the boots where the build buys them, as Blitz\'s final build does', () => {
    expect(finalBuild({ ...ezreal, bootsAt: 0 })).toEqual([3020, 3146, 3100, 4645, 3089, 4646])
    expect(finalBuild({ ...ezreal, bootsAt: 2 })).toEqual([3146, 3100, 3020, 4645, 3089, 4646])
  })

  it('reads the buying order like Blitz: measured components, else the recipe dearest first', () => {
    expect(buyingOrder(finalBuild(ezreal), ezreal.starter, items, orders)).toEqual([3145, 1052, 1053, 3146, 1001, 3020, 3057, 3113, 1026, 3100])
    expect(componentsOf(3146, items)).toEqual([3145, 1053].sort((a, b) => items[b]!.totalGold - items[a]!.totalGold))
  })

  it('writes a block per need of the draft after the final build, its items out of the situational block', () => {
    const titles = { starting: 'S', order: 'O', final: 'F', situational: 'X', boots: 'B', against: (block: { need: string, names: string[] }) => `vs ${block.need} — ${block.names.join(', ')}` }
    const draft = [{ need: 'magic' as const, names: ['Ekko', 'Anivia'], items: [3111, 3102, 9999] }]
    const [set] = recommendedSets({ ...ezreal, situational: [3118, 3102], draft }, [], 'Ezreal', titles, items, orders)
    expect(set!.blocks.map(block => block.type)).toEqual(['S', 'O', 'F', 'vs magic — Ekko, Anivia', 'X', 'B'])
    // Ids the patch does not know are dropped; an item answering the draft is not listed again as situational.
    expect(set!.blocks[3]!.items.map(entry => entry.id)).toEqual(['3111', '3102'])
    expect(set!.blocks[4]!.items.map(entry => entry.id)).toEqual(['3118'])
  })

  it('fits a need\'s block title within the 40 characters the shop shows, the enemies that do not fit counted', () => {
    expect(againstTitle('Contra dano mágico', ['Ekko', 'Anivia'])).toBe('Contra dano mágico — Ekko, Anivia')
    expect(againstTitle('Contra dano mágico', ['Ekko', 'Anivia', 'Aurelion Sol', 'Amumu'])).toBe('Contra dano mágico — Ekko, Anivia +2')
    expect(againstTitle('Contra dano mágico', ['Aurelion Sol, the Star Forger of the long name'])).toBe('Contra dano mágico')
    expect(againstTitle('Contra burst', [])).toBe('Contra burst')
  })

  it('writes the blocks in Blitz order, the selected build first and duplicates once', () => {
    const titles = { starting: 'S', order: 'O', final: 'F', situational: 'X', boots: 'B' }
    const sets = recommendedSets(ezreal, [ezreal, { ...ezreal, key: 'lane-1', title: 'Other' }], 'Ezreal', titles, items, orders)
    expect(sets).toHaveLength(1)
    expect(sets[0]!.title).toBe('TrueMain Ezreal')
    expect(sets[0]!.blocks.map(block => block.type)).toEqual(['S', 'O', 'F', 'X', 'B'])
    expect(sets[0]!.blocks[0]!.items).toEqual([{ id: '2003', count: 1 }, { id: '1055', count: 1 }])
  })
})

describe('quest reward block', () => {
  // Lulu: World Atlas and two potions, Dream Maker to pick, Ardent Censer and Shurelya's; Ionian Boots.
  const lulu = { key: 'lane', title: 'Lulu', starter: [3865, 2003, 2003], path: [3504, 2065], boots: [3158], situational: [] }
  const known: Record<number, StaticItemData> = Object.fromEntries([3865, 2003, 3870, 3504, 2065, 3158].map(id => [id, item(id, 3000)]))
  const titles = { starting: 'S', order: 'O', final: 'F', situational: 'X', boots: 'B', quest: 'Q' }

  it('names the reward in a block of its own after the starting items, in no buying order', () => {
    const [set] = recommendedSets({ ...lulu, questReward: [3870] }, [], 'Lulu', titles, known, null)
    expect(set!.blocks.map(block => block.type)).toEqual(['S', 'Q', 'O', 'F', 'B'])
    expect(set!.blocks[1]!.items.map(entry => entry.id)).toEqual(['3870'])
    for (const block of set!.blocks.filter(block => block.type !== 'Q')) expect(block.items.map(entry => entry.id)).not.toContain('3870')
  })

  it('moves a reward a source wrote among the starting items to its block (TrueMain\'s own builds)', () => {
    const [set] = recommendedSets({ ...lulu, starter: [3865, 3870, 2003, 2003] }, [], 'Lulu', titles, known, null)
    expect(set!.blocks[0]!.items.map(entry => entry.id)).not.toContain('3870')
    expect(set!.blocks[1]!.items.map(entry => entry.id)).toEqual(['3870'])
  })
})

describe('place blocks', () => {
  // Ashe: Yun Tal Wildarrows, Phantom Dancer, Infinity Edge, Lord Dominik's Regards, Guardian Angel; Berserker's Greaves.
  const ashe = { key: 'draft', title: 'Ashe', starter: [1055], path: [3032, 3046, 3031, 3036, 3026], boots: [3006], situational: [] }
  const known: Record<number, StaticItemData> = Object.fromEntries([1055, 1001, 3006, 3009, 3047, 3032, 6672, 3153, 3046, 3085, 3031, 3036, 3033, 3026, 3072, 3139].map(id => [id, item(id, 3000)]))
  const titles = { starting: 'S', order: 'O', final: 'F', situational: 'X', boots: 'B', place: (place: number) => `Item ${place} — opções` }
  const places = [
    { place: 0, items: [3006, 3009, 3047, 1001] },
    { place: 1, items: [3032, 6672, 3153] },
    { place: 2, items: [3046] },
    { place: 3, items: [3031, 3036, 3033, 9999, 3072] },
  ]

  it('writes each place with its options after the other blocks, the boots\' options in the boots block', () => {
    const [set] = recommendedSets({ ...ashe, places }, [], 'Ashe', titles, known, null)
    expect(set!.blocks.map(block => block.type)).toEqual(['S', 'O', 'F', 'B', 'Item 1 — opções', 'Item 3 — opções'])
    // The basic boots are a step on the way, not a choice.
    expect(set!.blocks[3]!.items.map(entry => entry.id)).toEqual(['3006', '3009', '3047'])
    // A place with nothing to choose from is left out; an id the patch does not know is dropped.
    expect(set!.blocks[5]!.items.map(entry => entry.id)).toEqual(['3031', '3036', '3033', '3072'])
  })

  it('keeps a set within the 16 blocks a set carries, the last places giving way', () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ place: index + 1, items: [3032, 6672] }))
    const [set] = recommendedSets({ ...ashe, places: many }, [], 'Ashe', titles, known, null)
    expect(set!.blocks).toHaveLength(16)
    expect(set!.blocks.at(-1)!.type).toBe('Item 12 — opções')
  })

  it('reads the lane\'s measures for a build that brings no places, never for a kit\'s', () => {
    const measures = { boots: new Map([[3006, 90000], [3009, 6000], [3047, 1500]]), places: [new Map([[3032, 48000], [6672, 17000], [3153, 7000]])] }
    expect(withMeasuredPlaces(ashe, measures).places).toEqual([{ place: 0, items: [3006, 3009, 3047] }, { place: 1, items: [3032, 6672, 3153] }])
    expect(withMeasuredPlaces({ ...ashe, places: [] }, measures).places).toEqual([])
    expect(withMeasuredPlaces({ ...ashe, places }, measures).places).toBe(places)
    expect(withMeasuredPlaces(ashe, null).places).toBeUndefined()
  })
})
