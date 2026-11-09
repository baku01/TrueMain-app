import type { StaticItemData } from '#shared/types/static-data'
import { describe, expect, it } from 'vitest'
import { againstTitle, buyingOrder, componentsOf, finalBuild, recommendedSets } from '~/utils/recommended-item-set'

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
