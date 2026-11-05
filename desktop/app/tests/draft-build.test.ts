import { describe, expect, it } from 'vitest'
import type { StaticItemData } from '#shared/types/static-data'
import type { BuildOptions } from '~/utils/sources/model'
import { draftBuildFromOptions, enemySituation, proShares, winRateFactor } from '~/utils/draft-build'

/**
 * The draft's build from another source (`utils/draft-build.ts`): the source's
 * measured options, reordered by the enemy team read from Riot's champion data
 * and by what the pros finish — never an item the source did not measure.
 */
const champ = (id: number, attack: number, magic: number, tags: string[], attackRange = 550) => [id, { id, alias: `C${id}`, name: `C${id}`, tags, info: { attack, magic, defense: 5 }, attackRange }] as const
const champions = new Map([
  champ(1, 2, 9, ['Mage']), champ(2, 3, 8, ['Mage', 'Support']), champ(3, 2, 8, ['Tank', 'Mage']),
  champ(4, 8, 2, ['Marksman']), champ(5, 4, 3, ['Tank', 'Support'], 125), champ(6, 5, 7, ['Tank'], 125),
])
const item = (id: number, tags: string[] = [], totalGold = 3000) => [id, { id, name: `I${id}`, tags, totalGold }] as const
const items = Object.fromEntries([
  item(3111, ['Boots', 'SpellBlock'], 1100), item(3020, ['Boots'], 1100), item(3047, ['Boots', 'Armor'], 1100),
  item(3118), item(4645), item(3157, ['Armor', 'SpellDamage']), item(3102, ['SpellBlock']), item(3135, ['MagicPenetration']), item(3089),
  item(3075, ['Armor', 'Health']), item(3065, ['SpellBlock', 'Health']),
]) as unknown as Record<number, StaticItemData>

const m = (games: number) => ({ games, winRate: 0.5, pickRate: 0.1 })
const options: BuildOptions = {
  patch: '16.21',
  games: 10000,
  pages: [],
  shares: null,
  spells: [],
  starters: [],
  boots: [{ ...m(6000), itemIds: [3020] }, { ...m(2500), itemIds: [3111] }, { ...m(100), itemIds: [3047] }],
  cores: [{ ...m(4000), itemIds: [3118, 3020, 4645] }],
  followUps: () => [
    { slot: 4, options: [{ ...m(3000), itemIds: [3089] }, { ...m(2000), itemIds: [3102] }] },
    { slot: 5, options: [{ ...m(2500), itemIds: [3135] }, { ...m(2400), itemIds: [3089] }] },
    { slot: 6, options: [{ ...m(2600), itemIds: [3075] }, { ...m(1200), itemIds: [3065] }] },
  ],
  skills: [],
}

describe('enemySituation', () => {
  it('reads a magic, tanky, crowd-controlling team from the champions\' ratings and classes', () => {
    expect(enemySituation([1, 2, 3, 5, 6], champions).map(entry => entry.axis)).toEqual(['EnemyMagicDamage', 'EnemyFrontline', 'EnemyCrowdControl'])
  })

  it('says nothing about a team it cannot read', () => {
    expect(enemySituation([999], champions)).toEqual([])
  })
})

describe('draftBuildFromOptions', () => {
  it('Darius into an AD laner and four mages takes Mercury\'s Treads: the board outweighs the lane', () => {
    const board = new Map([
      ...champions,
      [266, { id: 266, alias: 'Aatrox', name: 'Aatrox', tags: ['Fighter'], info: { attack: 8, magic: 3, defense: 4 }, attackRange: 175 }],
    ])
    const situation = enemySituation([266, 1, 2, 3, 6], board, 266)
    const darius: BuildOptions = { ...options, boots: [{ games: 3805, winRate: 0.469, pickRate: 0.48, itemIds: [3047] }, { games: 2172, winRate: 0.498, pickRate: 0.28, itemIds: [3111] }] }
    const boots = draftBuildFromOptions(darius, situation, items).find(step => step.isBoots)
    expect(boots?.itemId).toBe(3111)
    expect(boots?.reason?.axis).toBe('EnemyMagicDamage')
  })

  it('reads the board the same way for every item, not the boots alone: an AD laner into four mages buys no pure armour', () => {
    const board = new Map([...champions, [266, { id: 266, alias: 'Aatrox', name: 'Aatrox', tags: ['Fighter'], info: { attack: 8, magic: 3, defense: 4 }, attackRange: 175 }]])
    const ids = draftBuildFromOptions(options, enemySituation([266, 1, 2, 3, 6], board, 266), items).map(step => step.itemId)
    expect(ids).not.toContain(3075)
    expect(ids).toContain(3102)
  })

  it('an AD laner still decides the boots when the team leans no way', () => {
    const board = new Map([...champions, [266, { id: 266, alias: 'Aatrox', name: 'Aatrox', tags: ['Fighter'], info: { attack: 8, magic: 3, defense: 4 }, attackRange: 175 }]])
    const darius: BuildOptions = { ...options, boots: [{ games: 2000, winRate: 0.5, pickRate: 0.3, itemIds: [3111] }, { games: 1800, winRate: 0.5, pickRate: 0.27, itemIds: [3047] }] }
    expect(draftBuildFromOptions(darius, enemySituation([266], board, 266), items).find(step => step.isBoots)?.itemId).toBe(3047)
  })

  it('prefers boots that win over a slightly more popular pair that loses', () => {
    const lopsided: BuildOptions = {
      ...options,
      boots: [{ games: 6000, winRate: 0.47, pickRate: 0.5, itemIds: [3020] }, { games: 5000, winRate: 0.54, pickRate: 0.4, itemIds: [3111] }],
    }
    expect(draftBuildFromOptions(lopsided, [], items).find(step => step.isBoots)?.itemId).toBe(3111)
  })

  it('does not trust a handful of lucky games', () => {
    expect(winRateFactor(0.8, 20, 0.5)).toBeLessThan(1.3)
    expect(winRateFactor(0.53, 5000, 0.5)).toBeGreaterThan(winRateFactor(0.6, 60, 0.5))
    expect(winRateFactor(0.5, 1000, 0.5)).toBe(1)
  })

  it('reads a healer on the enemy team and takes the anti-heal the source measured', () => {
    const healers = new Map([...champions, [9, { id: 9, alias: 'Soraka', name: 'Soraka', tags: ['Support'], info: { attack: 2, magic: 7, defense: 5 } }]])
    const situation = enemySituation([4, 9], healers)
    expect(situation.map(entry => entry.axis)).toContain('EnemySustain')
    const steps = draftBuildFromOptions(options, [{ axis: 'EnemySustain', bucket: 'High', strength: 1 }], items)
    expect(steps.find(step => step.itemId === 3075)?.reason?.axis).toBe('EnemySustain')
  })

  it('keeps the source\'s most played items, in the order it measures them, when the draft asks nothing of it', () => {
    const steps = draftBuildFromOptions(options, [], items)
    // The most played core first, the boots second, then the items measured fourth, fifth, sixth.
    expect(steps.map(step => step.itemId)).toEqual([3118, 3020, 4645, 3089, 3135, 3075])
    expect(steps.every(step => step.reason === null)).toBe(true)
  })

  it('reads a later item\'s win rate against its own slot\'s, not the cores\': a sixth item wins more, the game having gone on', () => {
    const late: BuildOptions = { ...options, followUps: () => options.followUps(null).map(group => (group.slot === 6 ? { ...group, options: group.options.map(option => ({ ...option, winRate: 0.75 })) } : group)) }
    expect(draftBuildFromOptions(late, [], items).map(step => step.itemId)).toEqual([3118, 3020, 4645, 3089, 3135, 3075])
  })

  it('against a magic team, drops the purely defensive armour for the answers the source measured, saying why', () => {
    const steps = draftBuildFromOptions(options, [{ axis: 'EnemyMagicDamage', bucket: 'High', strength: 1 }], items)
    const ids = steps.map(step => step.itemId)
    expect(ids[1]).toBe(3111)
    expect(ids).not.toContain(3075)
    expect(ids).toContain(3102)
    expect(steps.find(step => step.itemId === 3102)?.reason?.axis).toBe('EnemyMagicDamage')
    // Every item is one the source measured: the draft reorders its build, it never invents one.
    expect(ids.filter(id => id !== 3111).every(id => [3118, 4645, 3089, 3102, 3135, 3075, 3065].includes(id))).toBe(true)
  })

  it('keeps a damage item that carries armour into a magic team: it is built for its damage', () => {
    const withZhonya: BuildOptions = { ...options, followUps: () => [{ slot: 4, options: [{ ...m(5000), itemIds: [3157] }] }] }
    expect(draftBuildFromOptions(withZhonya, [{ axis: 'EnemyMagicDamage', bucket: 'High', strength: 1 }], items).map(step => step.itemId)).toContain(3157)
  })

  it('puts in the boots that answer the board when the source measured only the wrong pair', () => {
    const onePair: BuildOptions = { ...options, boots: [{ ...m(9000), itemIds: [3047] }] }
    const boots = draftBuildFromOptions(onePair, [{ axis: 'EnemyMagicDamage', bucket: 'High', strength: 1 }], items).find(step => step.isBoots)
    expect(boots?.itemId).toBe(3111)
    expect(boots?.reason?.axis).toBe('EnemyMagicDamage')
  })

  it('reads a lone lane opponent: a magic one moves the boots to Mercury\'s Treads', () => {
    const situation = enemySituation([1], champions, 1)
    expect(situation).toEqual([{ axis: 'OpponentMagicDamage', bucket: 'High' }])
    expect(draftBuildFromOptions(options, situation, items).find(step => step.isBoots)?.itemId).toBe(3111)
  })

  it('weighs in what the pros finish, the games against the lane opponent counting twice', () => {
    const pros = proShares([
      { items: [3118, 4645, 3089, 3020], opponentChampionId: 7 },
      { items: [3118, 4645, 3089, 3020], opponentChampionId: 7 },
      { items: [3118, 3135, 3111], opponentChampionId: 8 },
    ], 7, items)
    expect(pros.get(3089)).toBeCloseTo(4 / 5)
    const steps = draftBuildFromOptions(options, [], items, pros)
    expect(steps.find(step => step.itemId === 3089)?.pros).toBeCloseTo(0.8)
  })
})
