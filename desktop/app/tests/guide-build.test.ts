import { describe, expect, it } from 'vitest'
import type { StaticItemData } from '#shared/types/static-data'
import type { GuideIndex } from '~/utils/guide-entities'
import type { GuideAbility, GuideBuild, GuideRunePage } from '~/utils/mobafire'
import { championOfWord, skinNumOf, skinWord, tileOfSkin } from '~/utils/guide-art'
import { abilityPoints, guideItemBlocks, guideItemSetBlocks, guideSetTitle, maxOrder, shopText, unresolvedRunes } from '~/utils/guide-build'
import { namedItemSet } from '~/utils/recommended-item-set'

const BRIAR_SKINS = [
  { num: 0, name: 'default' },
  { num: 1, name: 'Street Demons Briar' },
  { num: 2, name: 'Street Demons Briar (Ruby)' },
  { num: 10, name: 'Primordian Briar' },
  { num: 20, name: 'Battle Academia Briar' },
]

describe('a guide\'s pictures as the game\'s art', () => {
  it('reads the skin\'s word of a banner, an avatar, and nothing else', () => {
    expect(skinWord('https://www.mobafire.com/images/champion/skins/banner/briar-street-demons.jpg')).toBe('briar-street-demons')
    expect(skinWord('https://www.mobafire.com/images/avatars/briar-battle-academia.png')).toBe('briar-battle-academia')
    expect(skinWord('https://www.mobafire.com/images/item/titanic-hydra.png')).toBeNull()
    expect(skinWord(null)).toBeNull()
  })

  it('finds the skin by its name, never a chroma, and the base skin by the champion alone', () => {
    expect(skinNumOf('briar-street-demons', 'Briar', BRIAR_SKINS)).toBe(1)
    expect(skinNumOf('briar-battle-academia', 'Briar', BRIAR_SKINS)).toBe(20)
    expect(skinNumOf('briar', 'Briar', BRIAR_SKINS)).toBe(0)
    expect(skinNumOf('briar-new-skin', 'Briar', BRIAR_SKINS)).toBeNull()
    expect(skinNumOf('gwen-cafe-cuties', 'Briar', BRIAR_SKINS)).toBeNull()
  })

  it('reads MOBAFire\'s ampersand, and a skin that names the champion its own way', () => {
    const skins = [{ num: 4, name: 'Nunu & Willump Bot' }, { num: 26, name: 'Nunu & Beelump' }, { num: 16, name: 'Space Groove Nunu & Willump' }]
    expect(skinNumOf('nunu-amp-willump-space-groove', 'Nunu & Willump', skins)).toBe(16)
    expect(skinNumOf('nunu-amp-willump-nunu-amp-beelump', 'Nunu & Willump', skins)).toBe(26)
    expect(skinNumOf('nunu-amp-willump-nunu-amp-willump-bot', 'Nunu & Willump', skins)).toBe(4)
    expect(skinNumOf('ahri-kda-all-out', 'Ahri', [{ num: 28, name: 'K/DA ALL OUT Ahri' }])).toBe(28)
  })

  it('tells whose skin a word is by the longest champion name it starts with', () => {
    const champions = new Map([['nunuwillump', 20], ['briar', 233], ['vi', 254], ['viego', 234]])
    expect(championOfWord('nunu-amp-willump-sasquatch', champions)).toBe(20)
    expect(championOfWord('viego-lunar-beast', champions)).toBe(234)
    expect(championOfWord('vi-officer', champions)).toBe(254)
    expect(championOfWord('unknown-skin', champions)).toBeNull()
    expect(tileOfSkin('Briar', 20)).toBe('https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/Briar_20.jpg')
  })
})

const index: GuideIndex = {
  items: new Map([['titanichydra', 3748], ['blackcleaver', 3071], ['platedsteelcaps', 3047], ['healthpotion', 2003], ['gustwalkerhatchling', 1102]]),
  spells: new Map(),
  runes: new Map([['presstheattack', 8005], ['triumph', 9111], ['adaptiveforce', 5008]]),
  styles: new Map([['precision', 8000]]),
  champions: new Map(),
}
const item = (name: string) => ({ name, image: null })

describe('a guide\'s itemization as one item set', () => {
  const build: GuideBuild = {
    recommended: [item('Titanic Hydra'), item('Black Cleaver'), item('Plated Steelcaps'), item('An Item Gone')],
    runes: [],
    spells: [],
    items: [
      { title: 'Jungle Item / No potion 🩸😈', notes: null, items: [item('Gustwalker Hatchling'), item('Health Potion'), item('Health Potion')] },
      { title: '', notes: null, items: [item('Plated Steelcaps')] },
      { title: 'Only items the patch lost', notes: null, items: [item('An Item Gone')] },
      { title: 'TANKY Bruiser. Best build overall in every elo (HIGH ELO~)', notes: null, items: [item('Titanic Hydra'), item('Black Cleaver')] },
    ],
    abilities: null,
  }

  it('writes the recommended items first, then each section under its own title, in the guide\'s order', () => {
    expect(guideItemBlocks(build, index, { recommended: 'Recommended items', untitled: 'Items' })).toEqual([
      { title: 'Recommended items', items: [3748, 3071, 3047] },
      { title: 'Jungle Item / No potion', items: [1102, 2003] },
      { title: 'Items', items: [3047] },
      { title: 'TANKY Bruiser. Best build overall in…', items: [3748, 3071] },
    ])
  })

  it('keeps every title the shop shows within its forty characters, emoji left out', () => {
    for (const block of guideItemBlocks(build, index, { recommended: 'Recommended items', untitled: 'Items' })) expect([...block.title].length).toBeLessThanOrEqual(40)
    expect(shopText('Hello 👋🏽 world', 40)).toBe('Hello world')
    expect(guideSetTitle('Briar', '{26.22} Rank 1 Briar / All Matchups 🩸😈 Briar Jungle ALL BUILDS')).toBe('Briar · {26.22} Rank 1 Briar / All Matchups…')
    expect(guideSetTitle('Briar', '😈')).toBe('Briar')
  })

  it('lays the blocks out as the shop\'s recommended set, under TrueMain\'s name', () => {
    const items = { 3748: {}, 3071: {}, 2003: {} } as unknown as Record<number, StaticItemData>
    const set = namedItemSet('Briar · A guide', 'Briar', [{ title: 'Recommended items', items: [3748, 3071, 3748] }, { title: 'Gone', items: [9999] }, { title: 'Start', items: [2003] }], items)
    expect(set.title).toBe('TrueMain Briar · A guide')
    expect(set.championKey).toBe('Briar')
    expect(set.blocks.map(block => [block.type, block.items.map(entry => entry.id)])).toEqual([['Recommended items', ['3748', '3071']], ['Start', ['2003']]])
  })
})

describe('a guide of several builds as one item set', () => {
  const titles = { recommended: 'Recommended items', untitled: 'Items', build: (number: number) => `Build ${number}`, more: 'More items' }
  const tank: GuideBuild = {
    recommended: [item('Titanic Hydra'), item('Black Cleaver')],
    runes: [],
    spells: [],
    items: [
      { title: 'Starter', notes: null, items: [item('Gustwalker Hatchling'), item('Health Potion')] },
      { title: 'Boots', notes: null, items: [item('Plated Steelcaps')] },
    ],
    abilities: null,
  }
  const lethality: GuideBuild = { ...tank, recommended: [item('Black Cleaver')], items: [{ title: 'Starter', notes: null, items: [item('Gustwalker Hatchling'), item('Health Potion')] }, { title: 'Core: a title long enough to be cut by the shop', notes: null, items: [item('Titanic Hydra')] }] }

  it('writes every build\'s blocks into the one set, each build in turn under its name', () => {
    const blocks = guideItemSetBlocks([tank, lethality], index, titles)
    expect(blocks).toEqual([
      { title: 'Build 1 — Recommended items', items: [3748, 3071] },
      { title: 'Build 1 — Starter', items: [1102, 2003] },
      { title: 'Build 1 — Boots', items: [3047] },
      { title: 'Build 2 — Recommended items', items: [3071] },
      { title: 'Build 2 — Starter', items: [1102, 2003] },
      { title: 'Build 2 — Core: a title long enough to…', items: [3748] },
    ])
    for (const block of blocks) expect([...block.title].length).toBeLessThanOrEqual(40)
    // One set for the shop, holding both builds.
    const items = { 3748: {}, 3071: {}, 3047: {}, 2003: {}, 1102: {} } as unknown as Record<number, StaticItemData>
    const set = namedItemSet('Briar · A guide', 'Briar', blocks, items)
    expect(set.blocks.map(block => block.type)).toEqual(blocks.map(block => block.title))
  })

  it('keeps a guide of one build as it was, its titles unprefixed', () => {
    expect(guideItemSetBlocks([tank], index, titles)).toEqual(guideItemBlocks(tank, index, titles))
  })

  it('fits many builds in the shop\'s sixteen blocks, no build and no item lost', () => {
    // Three builds of ten blocks each, every item its own.
    const many: GuideIndex = { ...index, items: new Map(Array.from({ length: 30 }, (_, at) => [`item${at}`, 1000 + at])) }
    const buildOf = (first: number): GuideBuild => ({ ...tank, recommended: [item(`Item${first}`)], items: Array.from({ length: 9 }, (_, at) => ({ title: `Section ${at}`, notes: null, items: [item(`Item${first + 1 + at}`)] })) })
    const blocks = guideItemSetBlocks([buildOf(0), buildOf(10), buildOf(20)], many, titles)
    expect(blocks).toHaveLength(16)
    expect(blocks.map(block => block.title).filter(title => title.endsWith('More items'))).toEqual(['Build 1 — More items', 'Build 2 — More items', 'Build 3 — More items'])
    expect(new Set(blocks.flatMap(block => block.items)).size).toBe(30)
  })

  it('leaves out a block that only repeats an earlier build\'s before gathering any', () => {
    const repeated: GuideBuild = { ...tank, items: Array.from({ length: 8 }, () => ({ title: 'Starter', notes: null, items: [item('Gustwalker Hatchling'), item('Health Potion')] })) }
    const blocks = guideItemSetBlocks([repeated, repeated, repeated], index, titles)
    expect(blocks.map(block => block.title)).toEqual(['Build 1 — Recommended items', 'Build 1 — Starter', 'Build 2 — Recommended items', 'Build 3 — Recommended items'])
  })
})

describe('a guide\'s ability order and runes', () => {
  const rows: GuideAbility[] = [
    { key: 'P', name: 'Crimson Curse', image: null, levels: [] },
    { key: 'Q', name: 'Head Rush', image: null, levels: [2, 8, 10, 12, 13] },
    { key: 'W', name: 'Blood Frenzy', image: null, levels: [1, 4, 5, 7, 9] },
    { key: 'E', name: 'Chilling Scream', image: null, levels: [3, 14, 15, 17, 18] },
    { key: 'R', name: 'Certain Death', image: null, levels: [6, 11, 16] },
  ]

  it('reads the points level by level, and the order the basic abilities are maxed in', () => {
    expect(abilityPoints(rows)).toMatchObject({ 1: 'W', 2: 'Q', 3: 'E', 6: 'R', 18: 'E' })
    expect(Object.keys(abilityPoints(rows))).toHaveLength(18)
    expect(maxOrder(rows)).toEqual(['W', 'Q', 'E'])
    expect(maxOrder(rows.slice(0, 2))).toEqual(['Q'])
  })

  it('names what keeps a rune page from importing', () => {
    const page: GuideRunePage = {
      title: '',
      notes: null,
      primary: { tree: 'Precision', runes: [item('Press the Attack'), item('Triumph'), item('A Rune Riot Retired')] },
      secondary: { tree: 'Unknown Tree', runes: [] },
      shards: [item('adaptive force')],
      bonuses: [],
    }
    expect(unresolvedRunes(page, index)).toEqual(['Unknown Tree', 'A Rune Riot Retired'])
  })
})
