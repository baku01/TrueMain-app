import { describe, expect, it } from 'vitest'
import type { BuildCoreView } from '~/types/build'
import { questRewardsOf, rewardApart, rewardPlace, starterApart } from '~/utils/support-quest'

const m = (games: number, id: number) => ({ games, winRate: 0.5, pickRate: 0.1, itemIds: [id] })
const set = (itemIds: number[]) => ({ itemIds, games: 900, pickRate: 0.9, winRate: 0.51 })

describe('support quest', () => {
  it('reads the rewards among a source\'s items, each its share of the picks, most first (Blitz\'s Lulu)', () => {
    const rewards = questRewardsOf([m(700, 3504), m(4015, 3871), m(9320, 3870), m(47, 3869)], true)
    expect(rewards.map(option => option.itemIds[0])).toEqual([3870, 3871, 3869])
    expect(rewards[0]!.pickRate).toBeCloseTo(9320 / 13382)
  })

  it('reads no reward off the support lane: Ashe\'s 7 picks in 71,593 games are no build of hers', () => {
    expect(questRewardsOf([m(5, 3871), m(1, 3869), m(1, 3876)], false)).toEqual([])
  })

  it('tells lolalytics\' first item of a support, its reward, from a first item bought', () => {
    expect(rewardPlace([m(828, 3870), m(79, 3869), m(10, 3504)])).toBe(true)
    expect(rewardPlace([m(828, 3504), m(79, 3870)])).toBe(false)
    expect(rewardPlace([])).toBe(false)
  })

  it('takes the reward out of the starting items where a source wrote it there (TrueMain\'s own builds)', () => {
    expect(starterApart(set([3865, 3870, 2003]))).toEqual({ starter: set([3865, 2003]), reward: set([3870]) })
    expect(starterApart(set([1055, 2003]))).toEqual({ starter: set([1055, 2003]), reward: null })
    const core: BuildCoreView = { itemPath: null, boots: null, starterItems: set([3865, 3870, 2003]), summonerSpells: null, skillOrder: null, runePage: null }
    expect(rewardApart(core)).toMatchObject({ starterItems: { itemIds: [3865, 2003] }, questReward: { itemIds: [3870] } })
    // A reward the source named on its own stays; the starting items lose theirs all the same.
    expect(rewardApart({ ...core, questReward: set([3871]) })).toMatchObject({ starterItems: { itemIds: [3865, 2003] }, questReward: { itemIds: [3871] } })
  })
})
