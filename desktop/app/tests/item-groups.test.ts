import { describe, expect, it } from 'vitest'
import { BOOTS, STARTER_LINE, fitsWith } from '~/utils/item-groups'
import { isBoots } from '~/utils/blitz/builds'

/** The game's limited item groups (`utils/item-groups.ts`): what one inventory can hold. */
describe('item groups', () => {
  it('holds one Lifeline item: no Maw of Malmortius beside Sterak\'s Gage or Immortal Shieldbow', () => {
    expect(fitsWith(3156, [3053])).toBe(false)
    expect(fitsWith(3156, [6673])).toBe(false)
    expect(fitsWith(3031, [3053])).toBe(true)
  })

  it('holds one Last Whisper item: Black Cleaver, Lord Dominik\'s Regards and Mortal Reminder exclude each other', () => {
    expect(fitsWith(3036, [3071])).toBe(false)
    expect(fitsWith(3033, [3036])).toBe(false)
  })

  it('holds one of Void Staff and Cryptbloom, one Immolate item, one Annul item, one Spellblade item', () => {
    expect(fitsWith(3137, [3135])).toBe(false)
    expect(fitsWith(6664, [3068])).toBe(false)
    expect(fitsWith(3814, [3102])).toBe(false)
    expect(fitsWith(3508, [3078])).toBe(false)
  })

  it('holds one pair of boots, Gluttonous Greaves and its Immortal Path included', () => {
    expect(BOOTS.has(3008) && BOOTS.has(3168) && isBoots(3008)).toBe(true)
    expect(fitsWith(3008, [3047])).toBe(false)
  })

  it('never holds an item twice, and counts the support item and the jungle pets apart', () => {
    expect(fitsWith(3031, [3031])).toBe(false)
    expect(STARTER_LINE.has(3865) && STARTER_LINE.has(1101)).toBe(true)
  })
})
