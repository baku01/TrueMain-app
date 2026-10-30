import { describe, expect, it } from 'vitest'
import { allMessages } from '#common/utils/i18n'
import { CLASSES, groupChampions, subclassesOf } from '~/utils/champion-classes'

const byId = (a: number, b: number) => a - b

describe('subclassesOf', () => {
  it('reads a champion\'s subclasses, the main one first', () => {
    expect(subclassesOf(799)).toEqual(['diver', 'skirmisher']) // Ambessa
    expect(subclassesOf(1)).toEqual(['burst']) // Annie
    expect(subclassesOf(51)).toEqual(['lanebully', 'poke']) // Caitlyn
    expect(subclassesOf(166)).toEqual(['allin', 'assassin']) // Akshan
  })

  it('has none for a champion the table does not know', () => {
    expect(subclassesOf(99999)).toEqual([])
  })
})

describe('groupChampions', () => {
  it('groups by class and subclass, and lists a two-subclass champion under both', () => {
    const { groups } = groupChampions([799, 1, 2], byId)
    const fighter = groups.find(group => group.class.id === 'fighter')!
    expect(fighter.subclasses.find(sub => sub.subclass === 'diver')!.champions).toEqual([2, 799])
    const slayer = groups.find(group => group.class.id === 'slayer')!
    expect(slayer.subclasses.find(sub => sub.subclass === 'skirmisher')!.champions).toEqual([799])
    expect(groups.find(group => group.class.id === 'mage')!.total).toBe(1)
  })

  it('counts a champion once within its class', () => {
    // Ambessa is a diver and a skirmisher: two classes, one entry in each.
    const { groups } = groupChampions([799], byId)
    expect(groups.map(group => group.total)).toEqual([0, 1, 1, 0, 0, 0, 0])
  })

  it('returns what the table does not know as unclassified', () => {
    expect(groupChampions([99999, 1], byId).unclassified).toEqual([99999])
  })
})

describe('CLASSES', () => {
  it('place every subclass of the table under exactly one class', () => {
    const subclasses = CLASSES.flatMap(definition => definition.subclasses)
    expect(new Set(subclasses).size).toBe(subclasses.length)
    expect(subclasses).toHaveLength(17)
  })
})

describe('the words of the page', () => {
  it('name and explain every class and subclass in both languages', () => {
    const { en, 'pt-BR': pt } = allMessages()
    for (const definition of CLASSES) {
      for (const key of [`class.${definition.id}.name`, `class.${definition.id}.desc`, ...definition.subclasses.flatMap(sub => [`sub.${sub}.name`, `sub.${sub}.desc`])]) {
        expect(en[key], key).toBeTruthy()
        expect(pt[key], key).toBeTruthy()
      }
    }
  })
})
