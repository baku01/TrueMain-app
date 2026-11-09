import type { BuildCoreView, BuildItemSet } from '~/types/build'
import type { ItemOption } from '~/utils/sources/model'

/**
 * The support quest's rewards. A support starts on World Atlas, which grows
 * into Runic Compass and Bounty of Worlds as the quest is done; on completing
 * it the player picks one of these five (Data Dragon's Bounty of Worlds builds
 * into them). None is bought, so none is a place of the buying order: a build
 * names the one to pick apart from it (`BuildOptions.questRewards`,
 * `BuildCore.questReward`). lolalytics counts the pick as a support's first
 * item, Blitz among its items outside the cores.
 */
export const QUEST_REWARDS: ReadonlySet<number> = new Set([3869, 3870, 3871, 3876, 3877])

export const isQuestReward = (id: number) => QUEST_REWARDS.has(id)

/** The quest's line before its reward: World Atlas, Runic Compass, Bounty of Worlds. */
export const QUEST_LINE: ReadonlySet<number> = new Set([3865, 3866, 3867])

/** The rewards among a source's items, each one's share of the rewards picked, most picked first. */
export function questRewardsOf(options: ItemOption[]): ItemOption[] {
  const rewards = options.filter(option => isQuestReward(option.itemIds[0]!))
  const total = rewards.reduce((sum, option) => sum + option.games, 0)
  return rewards.map(option => ({ ...option, pickRate: total ? option.games / total : 0 })).sort((a, b) => b.games - a.games)
}

/** Whether most of a place's games picked a reward there: lolalytics' first item of a support. */
export const rewardPlace = (options: ItemOption[]): boolean => {
  const total = options.reduce((sum, option) => sum + option.games, 0)
  return total > 0 && options.filter(option => isQuestReward(option.itemIds[0]!)).reduce((sum, option) => sum + option.games, 0) > total / 2
}

/**
 * A build's core with its quest reward apart, where its source wrote it among
 * the starting items (TrueMain's own builds count the quest's completion as
 * one): the starting items without it, the reward on its own, measured as the
 * starting items were.
 */
export function rewardApart<T extends BuildCoreView>(core: T): T {
  const { starter, reward } = starterApart(core.starterItems)
  return reward ? { ...core, starterItems: starter, questReward: core.questReward ?? reward } : core
}

/** Starting items with the quest's reward apart, where they hold it; the reward null where they do not. */
export function starterApart(starter: BuildItemSet | null): { starter: BuildItemSet | null, reward: BuildItemSet | null } {
  const reward = starter?.itemIds.find(isQuestReward)
  if (!starter || reward === undefined) return { starter, reward: null }
  return { starter: { ...starter, itemIds: starter.itemIds.filter(id => !isQuestReward(id)) }, reward: { ...starter, itemIds: [reward] } }
}
