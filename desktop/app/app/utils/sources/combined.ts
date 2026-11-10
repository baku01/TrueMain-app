import type { BuildOptions, Measure, SlotGroup } from '~/utils/sources/model'
import { questRewardsOf } from '~/utils/support-quest'

/**
 * Two sources read as one (lolalytics and Blitz), for the Jev matchup page's
 * ranking alone — every other build is the picked source's only: what both
 * measured is pooled game by game — the games added up, the wins added up,
 * the rate read again over the whole — never two rates averaged as if their
 * samples weighed the same. What only one measured is kept as it is.
 */

const winsOf = (measure: Measure) => measure.winRate * measure.games

/** Lists of the same kind of option, pooled by `key`, most played first; shares read again over `total` games. */
export function poolMeasures<T extends Measure>(lists: T[][], key: (option: T) => string, total: number): T[] {
  const pooled = new Map<string, { option: T, games: number, wins: number }>()
  for (const option of lists.flat()) {
    const id = key(option)
    const known = pooled.get(id)
    if (known) {
      known.games += option.games
      known.wins += winsOf(option)
    }
    else {
      pooled.set(id, { option, games: option.games, wins: winsOf(option) })
    }
  }
  return [...pooled.values()]
    .map(({ option, games, wins }) => ({ ...option, games, winRate: games ? wins / games : option.winRate, pickRate: total ? games / total : option.pickRate }))
    .sort((a, b) => b.games - a.games)
}

const ids = (list: number[]) => list.join(',')

/** Two sources' options on one lane, pooled; either alone when the other measured nothing. */
export function combineOptions(first: BuildOptions | null, second: BuildOptions | null): BuildOptions | null {
  if (!first || !second) return first ?? second
  const games = first.games + second.games
  const pool = <T extends Measure>(pick: (options: BuildOptions) => T[], key: (option: T) => string) => poolMeasures([pick(first), pick(second)], key, games)
  const cores = pool(options => options.cores, option => ids(option.itemIds))
  return {
    patch: first.patch ?? second.patch,
    games,
    pages: pool(options => options.pages, option => JSON.stringify(option.page)),
    shares: first.shares ?? second.shares,
    spells: pool(options => options.spells, option => ids([...option.spellIds].sort((a, b) => a - b))),
    starters: pool(options => options.starters, option => ids(option.itemIds)),
    boots: pool(options => options.boots, option => ids(option.itemIds)),
    cores,
    // Each source's items after the same core (the one it measured with those
    // items), slot by slot; the lane's when it measured that core not at all.
    followUps: (core) => {
      const own = (options: BuildOptions) => options.followUps(core ? options.cores.find(option => ids(option.itemIds) === ids(core.itemIds)) ?? null : null)
      const groups = [...own(first), ...own(second)]
      const slots = [...new Set(groups.map(group => group.slot))].sort((a, b) => a - b)
      return slots.map((slot): SlotGroup => {
        const lists = groups.filter(group => group.slot === slot).map(group => group.options)
        const total = lists.flat().reduce((sum, option) => sum + option.games, 0)
        return { slot, options: poolMeasures(lists, option => ids(option.itemIds), total) }
      })
    },
    skills: pool(options => options.skills, option => ids(option.points)),
    priorities: first.priorities || second.priorities
      ? poolMeasures([first.priorities ?? [], second.priorities ?? []], option => option.order.join(''), games)
      : undefined,
    situational: first.situational || second.situational
      ? poolMeasures([first.situational ?? [], second.situational ?? []], option => ids(option.itemIds), games)
      : undefined,
    // Each source's rewards are a support lane's already (`questRewardsOf`): pooled, they are too.
    questRewards: first.questRewards || second.questRewards
      ? questRewardsOf(poolMeasures([first.questRewards ?? [], second.questRewards ?? []], option => ids(option.itemIds), games), true)
      : undefined,
    places: first.places || second.places
      ? Array.from({ length: Math.max(first.places?.length ?? 0, second.places?.length ?? 0) }, (_, at) => {
          const lists = [first.places?.[at] ?? [], second.places?.[at] ?? []]
          return poolMeasures(lists, option => ids(option.itemIds), lists.flat().reduce((sum, option) => sum + option.games, 0))
        })
      : undefined,
  }
}
