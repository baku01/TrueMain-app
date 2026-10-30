import { describe, expect, it } from 'vitest'
import { KNOWN_ITEM_CONTEXT_AXES } from '#shared/utils/item-context'
import { PT_BR_AXIS_PHRASES } from '#common/utils/item-context-phrases'

describe('item context phrases', () => {
  it('word in Portuguese every axis the shared module words in English', () => {
    expect(Object.keys(PT_BR_AXIS_PHRASES).sort()).toEqual([...KNOWN_ITEM_CONTEXT_AXES].sort())
  })
})
