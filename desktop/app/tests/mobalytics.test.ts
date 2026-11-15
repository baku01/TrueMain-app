import { describe, expect, it } from 'vitest'
import { mobalyticsOptionsOf, mobalyticsRank } from '~/utils/sources/mobalytics'

/** Briar's jungle on 16.22 as Mobalytics answers it, cut down: two builds of one page and spells. */
const champion = {
  stats: { tier: 'S', totalMatchCount: 1000, winRateHistory: [{ value: 51.4, x: '16.22' }], pickRateHistory: [], banRateHistory: [] },
  buildsOptions: {
    options: [
      {
        id: '1', type: 'MOST_POPULAR', stats: { wins: 330, matchCount: 600 },
        perks: { IDs: [8005, 9111, 9104, 8014, 8143, 8135, 5008, 5008, 5001], style: 8000, subStyle: 8100 },
        items: [{ type: 'Starter', items: [1103, 3340] }, { type: 'Core', items: [6676, 3047, 3748] }, { type: 'FullBuild', items: [3036] }],
        spells: [11, 4], skillOrder: [2, 3, 1, 2, 2, 4],
      },
      {
        id: '2', type: 'ALTERNATIVE', stats: { wins: 200, matchCount: 400 },
        perks: { IDs: [8005, 9111, 9104, 8014, 8143, 8135, 5008, 5008, 5001], style: 8000, subStyle: 8100 },
        items: [{ type: 'Starter', items: [1103, 3340] }, { type: 'Core', items: [3748, 3047, 3071] }],
        spells: [4, 11], skillOrder: [2, 3, 1, 2, 2, 4],
      },
    ],
  },
  countersOptions: null,
}

describe('Mobalytics', () => {
  it('reads TrueMain\'s brackets as its rank filter: the "+" it pools, else the tier alone', () => {
    expect(mobalyticsRank('EMERALD_PLUS')).toBe('EmeraldPlus')
    expect(mobalyticsRank('MASTER_PLUS')).toBe('MasterPlus')
    expect(mobalyticsRank('GOLD_PLUS')).toBe('Gold')
    expect(mobalyticsRank('GRANDMASTER')).toBe('GrandMaster')
    expect(mobalyticsRank('ALL')).toBe('All')
    expect(mobalyticsRank(undefined)).toBe('EmeraldPlus')
  })

  it('groups its builds\' parts by their games: the page and spells of both builds as one, the cores apart, the boots out of the path', () => {
    const options = mobalyticsOptionsOf(champion as never)!
    expect(options.games).toBe(1000)
    expect(options.pages).toHaveLength(1)
    expect(options.pages[0]).toMatchObject({ games: 1000, winRate: 0.53, page: { primaryKeystoneId: 8005, secondaryStyleId: 8100, statDefense: 5001 } })
    expect(options.spells[0]).toMatchObject({ games: 1000, spellIds: [4, 11] })
    expect(options.cores.map(core => [core.itemIds, core.games])).toEqual([[[6676, 3748], 600], [[3748, 3071], 400]])
    expect(options.boots[0]).toMatchObject({ itemIds: [3047], games: 1000 })
    expect(options.cores[0]!.pickRate).toBeCloseTo(0.6)
    // A build's later items carry its whole games: left to the sources that count items one by one.
    expect(options.followUps(options.cores[0]!)).toEqual([])
    expect(options.situational).toBeUndefined()
  })
})
