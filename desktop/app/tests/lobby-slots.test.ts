import { describe, expect, it } from 'vitest'
import type { KitRunePage } from '#shared/types/kit'
import { lanesFor, pickerChampions, searchKey, slotPerks } from '~/utils/lobby-slots'

const page: KitRunePage = {
  primaryStyleId: 8100,
  primaryKeystoneId: 8112,
  primaryPerk1Id: 8139,
  primaryPerk2Id: 8138,
  primaryPerk3Id: 8135,
  secondaryStyleId: 8200,
  secondaryPerk1Id: 8226,
  secondaryPerk2Id: 8210,
  statOffense: 5008,
  statFlex: 5008,
  statDefense: 5001,
}

describe('slotPerks', () => {
  it('writes the nine perks in the client\'s order with the two trees, as a JSON string', () => {
    expect(JSON.parse(slotPerks(page)!)).toEqual({
      perkIds: [8112, 8139, 8138, 8135, 8226, 8210, 5008, 5008, 5001],
      perkStyle: 8100,
      perkSubStyle: 8200,
    })
  })

  it('refuses a page with a hole in it', () => {
    expect(slotPerks({ ...page, statFlex: 0 })).toBeNull()
    expect(slotPerks({ ...page, secondaryStyleId: 0 })).toBeNull()
  })
})

describe('lanesFor', () => {
  it('leaves out the lane the other slot holds', () => {
    const slots = [{ championId: 103, position: 'MIDDLE' }, { championId: 64, position: 'JUNGLE' }]
    expect(lanesFor(slots, 0)).toEqual(['TOP', 'MIDDLE', 'BOTTOM', 'UTILITY'])
    expect(lanesFor(slots, 1)).toEqual(['TOP', 'JUNGLE', 'BOTTOM', 'UTILITY'])
  })
})

describe('pickerChampions', () => {
  const champions = [
    { id: 96, name: 'Kog\'Maw' },
    { id: 103, name: 'Ahri' },
    { id: 64, name: 'Lee Sin' },
    { id: 1, name: 'Annie' },
  ]

  it('matches a term whatever its case, spaces and apostrophes', () => {
    expect(searchKey('Kog\'Maw')).toBe('kogmaw')
    expect(pickerChampions(champions, null, [], 'kogm').map(c => c.id)).toEqual([96])
    expect(pickerChampions(champions, null, [], 'LEESIN').map(c => c.id)).toEqual([64])
  })

  it('lists only what the client lets the player play, once it has said', () => {
    expect(pickerChampions(champions, [1, 103], [], '').map(c => c.id)).toEqual([103, 1])
  })

  it('puts the player\'s pool first, most played first, then the rest by name', () => {
    expect(pickerChampions(champions, null, [64, 96], '').map(c => c.id)).toEqual([64, 96, 103, 1])
  })
})
