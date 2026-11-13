import { describe, expect, it } from 'vitest'
import type { ChampionStaticData } from '#shared/types/static-data'
import { quickAbilities } from '~/utils/ability-data'

describe('quickAbilities', () => {
  it('reads Q, W, E and R from Data Dragon\'s champion file, figures per rank, while the game data is read', () => {
    const ahri = {
      partype: 'Mana',
      championSpells: {
        Q: { key: 'Q', name: 'Orb of Deception', iconUrl: '', description: 'Throws an orb.<br>Returns.', cooldownBurn: '7', costBurn: '55/65/75/85/95', rangeBurn: '970' },
        R: { key: 'R', name: 'Spirit Rush', iconUrl: '', description: 'Dashes.', cooldownBurn: '130/105/80', costBurn: '0', rangeBurn: '450' },
      },
    } as unknown as ChampionStaticData
    const [q, r] = quickAbilities(ahri)
    expect(q).toMatchObject({ key: 'Q', name: 'Orb of Deception', cooldown: [7], cost: [55, 65, 75, 85, 95], range: [970], resource: 'Mana', ammo: null })
    expect(r).toMatchObject({ key: 'R', cooldown: [130, 105, 80], maxRank: 3, resource: null })
    expect(q!.html).toContain('Throws an orb.')
    expect(quickAbilities(null)).toEqual([])
  })
})
