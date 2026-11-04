import { describe, expect, it } from 'vitest'
import { spellsInOrder } from '~/composables/useAutoImport'

describe('spellsInOrder', () => {
  it('puts Flash on the key the player plays it on', () => {
    expect(spellsInOrder(14, 4, 'D')).toEqual([4, 14])
    expect(spellsInOrder(4, 14, 'D')).toEqual([4, 14])
    expect(spellsInOrder(4, 12, 'F')).toEqual([12, 4])
    expect(spellsInOrder(12, 4, 'F')).toEqual([12, 4])
  })
  it('leaves a pair without Flash as the build has it', () => {
    expect(spellsInOrder(11, 6, 'D')).toEqual([11, 6])
  })
})
