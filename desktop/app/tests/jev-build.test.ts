import { describe, expect, it } from 'vitest'
import type { StaticItemData } from '#shared/types/static-data'
import type { JevSlot } from '~/utils/jev-build'
import { plainAbility, questionsOf, settle, stateOf } from '~/utils/jev-build'

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
  options: ids.map((id, index) => ({ key: `o${index}`, itemIds: [id], label: items[id]?.name ?? String(id), games: 100, winRate: 0.5 })),
})
const answer = (probabilities: Record<string, number>) => ({ type: 'choice' as const, choice: Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0]![0], confidence: 0.6, probabilities })

describe('questionsOf', () => {
  it('asks each slot with more than one option, every option with its measure', () => {
    const questions = questionsOf([slot('item4', [3075, 3065]), slot('item5', [3071])])
    expect(Object.keys(questions)).toEqual(['item4'])
    expect(questions.item4!.criteria.o1).toBe('Spirit Visage (100 games, 50.0% win rate)')
  })
})

describe('settle', () => {
  it('takes Jev\'s pick, the next most probable when it repeats an item or is a fourth pure defence', () => {
    const picks = settle(
      [slot('item4', [4401, 3065]), slot('item5', [4401, 3071]), slot('item6', [3143, 6333])],
      { item4: answer({ o0: 0.7, o1: 0.3 }), item5: answer({ o0: 0.8, o1: 0.2 }), item6: answer({ o0: 0.9, o1: 0.1 }) },
      items,
      [3075, 3065],
    )
    expect(picks.map(pick => pick.option.itemIds[0])).toEqual([4401, 3071, 6333])
    expect(picks.map(pick => pick.overruled)).toEqual([false, true, true])
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
    expect(state).toContain('Laning phase: the boots and the first item are bought while laning against Aatrox')
    expect(state).toContain('Q The Darkin Blade: Deals physical damage.')
    expect(state).toContain('900 games, 48.0% game win rate, 45.0% of decided lanes won, -210 gold difference at 15 minutes')
    expect(state).toContain('Lux:\n  Q Light Binding: Roots two enemies.')
  })

  it('cuts a long ability to its limit', () => {
    expect(plainAbility('a'.repeat(50), 10)).toBe(`${'a'.repeat(9)}…`)
  })
})
