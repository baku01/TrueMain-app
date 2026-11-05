import { describe, expect, it } from 'vitest'
import type { StaticItemData } from '#shared/types/static-data'
import type { JevSlot } from '~/utils/jev-build'
import { decide, draftNeeds, itemEffect, laidBuild, plainAbility, questionsOf, stateOf } from '~/utils/jev-build'

const items = {
  3075: { id: 3075, name: 'Thornmail', tags: ['Armor', 'Health'] },
  3143: { id: 3143, name: 'Randuin', tags: ['Armor', 'Health'] },
  3065: { id: 3065, name: 'Spirit Visage', tags: ['SpellBlock', 'Health'] },
  4401: { id: 4401, name: 'Force of Nature', tags: ['SpellBlock', 'Health'] },
  3071: { id: 3071, name: 'Black Cleaver', tags: ['Damage', 'Health'] },
  6333: { id: 6333, name: 'Death\'s Dance', tags: ['Damage', 'Armor'] },
} as unknown as Record<number, StaticItemData>

const slot = (name: string, ids: number[]): JevSlot => ({
  name,
  instructions: name,
  options: ids.map((id, index) => ({ key: `o${index}`, itemIds: [id], label: items[id]?.name ?? String(id), games: 100, pickRate: 0.1, winRate: 0.5 })),
})
const answer = (probabilities: Record<string, number>) => ({ type: 'choice' as const, choice: Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0]![0], confidence: 0.6, probabilities })

describe('questionsOf', () => {
  it('asks each slot with more than one option, every option with its measure', () => {
    const questions = questionsOf([slot('item4', [3075, 3065]), slot('item5', [3071])])
    expect(Object.keys(questions)).toEqual(['item4'])
    expect(questions.item4!.criteria.o1).toBe('Spirit Visage (100 games, 10.0% pick rate, 50.0% win rate)')
  })
})

describe('decide and laidBuild', () => {
  it('takes Jev\'s pick as it is, keeps the source\'s most played beside it, and lays the boots where Jev times them', () => {
    const core: JevSlot = { name: 'core', instructions: '', options: [{ key: 'o0', itemIds: [3071, 6333], label: 'BC > DD', games: 900, pickRate: 0.4, winRate: 0.5 }, { key: 'o1', itemIds: [3143, 3075], label: 'R > T', games: 50, pickRate: 0.02, winRate: 0.55 }] }
    const boots: JevSlot = { name: 'boots', instructions: '', options: [{ key: 'o0', itemIds: [3047], label: 'Steelcaps', games: 800, pickRate: 0.6, winRate: 0.47 }, { key: 'o1', itemIds: [3111], label: 'Mercury', games: 400, pickRate: 0.3, winRate: 0.5 }] }
    const timing: JevSlot = { name: 'bootsAfter', instructions: '', options: [0, 1, 2].map(after => ({ key: `o${after}`, after, itemIds: [], label: String(after), games: 0, pickRate: 0, winRate: 0 })) }
    const decisions = [
      decide(core, answer({ o0: 0.2, o1: 0.8 })),
      decide(boots, answer({ o0: 0.1, o1: 0.9 })),
      decide(timing, answer({ o0: 0.7, o1: 0.2, o2: 0.1 })),
    ]
    expect(decisions.map(entry => [entry.jev.key, entry.standard.key])).toEqual([['o1', 'o0'], ['o1', 'o0'], ['o0', 'o0']])
    expect(laidBuild(decisions, 'jev', [4401]).order).toEqual([3111, 3143, 3075, 4401])
    expect(laidBuild(decisions, 'standard', [3065]).order).toEqual([3047, 3071, 6333, 3065])
  })

  it('takes a single option when Jev was not asked', () => {
    expect(decide(slot('item4', [4401]), undefined).jev.itemIds).toEqual([4401])
  })
})

describe('stateOf', () => {
  it('tells Jev the lane opponent\'s kit for the laning phase and the rest of the team\'s for later', () => {
    const champion = (id: number, name: string, attack: number, magic: number) => ({ id, alias: name, name, tags: ['Mage'], info: { attack, magic, defense: 3 }, attackRange: 550 })
    const aatrox = { ...champion(266, 'Aatrox', 8, 3), tags: ['Fighter'], attackRange: 175 }
    const lux = champion(99, 'Lux', 2, 9)
    const state = stateOf({
      champion: champion(122, 'Darius', 9, 0),
      position: 'TOP',
      opponent: aatrox,
      enemies: [aatrox, lux],
      allies: [],
      situations: [{ axis: 'EnemyMagicDamage', bucket: 'High', strength: 1 }],
      games: 5000,
      abilities: new Map([[266, [{ key: 'Q', name: 'The Darkin Blade', description: 'Deals <physicalDamage>physical damage</physicalDamage>.' }]], [99, [{ key: 'Q', name: 'Light Binding', description: 'Roots two enemies.' }]]]),
      lane: { games: 900, winRate: 0.48, laneWinRate: 0.45, goldDiffAt15: -210 },
    })
    expect(state).toContain('Laning phase: the starter, the boots and the first item are bought while laning against Aatrox')
    expect(state).toContain('Q The Darkin Blade: Deals physical damage.')
    expect(state).toContain('900 games, 48.0% game win rate, 45.0% of decided lanes won, -210 gold difference at 15 minutes')
    expect(state).toContain('Lux:\n  Q Light Binding: Roots two enemies.')
  })

  it('cuts a long ability to its limit', () => {
    expect(plainAbility('a'.repeat(50), 10)).toBe(`${'a'.repeat(9)}…`)
  })
})

describe('itemEffect', () => {
  it('reads an item\'s stats and effects out of Data Dragon and says what it answers', () => {
    const effect = itemEffect({
      description: '<mainText><stats><attention>350</attention> Health<br><attention>55</attention> Magic Resist</stats><br><br><passive>Steadfast</passive><br>Taking magic damage grants stacks.</mainText>',
      plaintext: 'Grants magic resist and health',
      tags: ['Health', 'SpellBlock'],
    })
    expect(effect).toBe('stats: 350 Health, 55 Magic Resist; effects: Steadfast; Grants magic resist and health; answers magic damage')
  })

  it('names anti-heal by its Grievous Wounds', () => {
    expect(itemEffect({ description: '<passive>Rend</passive> applies Grievous Wounds', tags: ['Damage'] })).toContain('answers healing')
  })
})

describe('draftNeeds', () => {
  it('sums the enemy team up in one line: damage split, crowd control, frontline, healing', () => {
    const champion = (alias: string, attack: number, magic: number, tags: string[]) => ({ id: alias.length, alias, name: alias, tags, info: { attack, magic, defense: 5 } })
    expect(draftNeeds([champion('Lux', 2, 9, ['Mage', 'Support']), champion('Soraka', 2, 7, ['Support']), champion('Ornn', 5, 3, ['Tank']), champion('Jinx', 9, 2, ['Marksman'])]))
      .toBe('50% magic and 50% physical damage, heavy crowd control from Lux, Soraka, Ornn, a frontline of Ornn, healing from Soraka')
  })
})
