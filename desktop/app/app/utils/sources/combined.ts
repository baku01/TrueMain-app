import type { ChampionMatchups, ChampionTierListResponse } from '#shared/types/champions'
import type { BuildOptions, Measure, SlotGroup } from '~/utils/sources/model'

/**
 * Two sources read as one (lolalytics and Blitz): what both measured is pooled
 * game by game — the games added up, the wins added up, the rate read again
 * over the whole — never two rates averaged as if their samples weighed the
 * same. What only one measured is kept as it is.
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
  }
}

/** Lower and upper bounds of the 95% Wilson interval around `wins / games`. */
function wilson(wins: number, games: number): [number, number] {
  if (!games) return [0, 1]
  const z = 1.96
  const rate = wins / games
  const centre = rate + (z * z) / (2 * games)
  const spread = z * Math.sqrt((rate * (1 - rate) + (z * z) / (4 * games)) / games)
  const scale = 1 + (z * z) / games
  return [(centre - spread) / scale, (centre + spread) / scale]
}

/** A lane's matchups from two sources, each opponent's games and wins pooled. */
export function combineMatchups(first: ChampionMatchups, second: ChampionMatchups): ChampionMatchups {
  const byOpponent = new Map(first.matchups.map(entry => [entry.opponentChampionId, { ...entry }]))
  for (const entry of second.matchups) {
    const known = byOpponent.get(entry.opponentChampionId)
    if (!known) {
      byOpponent.set(entry.opponentChampionId, { ...entry })
      continue
    }
    known.games += entry.games
    known.wins += entry.wins
  }
  const total = [...byOpponent.values()].reduce((sum, entry) => sum + entry.games, 0)
  return {
    ...first,
    matchups: [...byOpponent.values()].map((entry) => {
      const [lower, upper] = wilson(entry.wins, entry.games)
      return { ...entry, winRate: entry.games ? entry.wins / entry.games : entry.winRate, playRate: total ? entry.games / total : entry.playRate, winRateLowerBound: lower, winRateUpperBound: upper }
    }).sort((a, b) => b.games - a.games),
  }
}

/**
 * Two tier lists as one: each champion's line on each lane pooled (games,
 * wins, its share of the lane's games), in the tiers the first source put it.
 * A line only the second source has joins the first's tier its pooled rate
 * would sit in among its lane.
 */
export function combineTierLists(first: ChampionTierListResponse, second: ChampionTierListResponse): ChampionTierListResponse {
  type Line = ChampionTierListResponse['tiers'][number]['entries'][number]
  const key = (line: Line) => `${line.championId}:${line.position}`
  const others = new Map(second.tiers.flatMap(group => group.entries).map(line => [key(line), line]))
  const pooled = (line: Line, other: Line | undefined): Line => {
    if (!other) return line
    const games = line.games + other.games
    const bans = [line.banRate, other.banRate].filter((rate): rate is number => rate !== null)
    return {
      ...line,
      games,
      winRate: games ? (line.winRate * line.games + other.winRate * other.games) / games : line.winRate,
      pickRate: games ? (line.pickRate * line.games + other.pickRate * other.games) / games : line.pickRate,
      banRate: bans.length ? bans.reduce((sum, rate) => sum + rate, 0) / bans.length : null,
    }
  }
  const tiers = first.tiers.map(group => ({ ...group, entries: group.entries.map((line) => {
    const other = others.get(key(line))
    others.delete(key(line))
    return pooled(line, other)
  }) }))
  for (const line of others.values()) {
    // The tier of the first source's line on the same lane closest to it in win rate.
    const nearest = tiers.flatMap(group => group.entries.filter(entry => entry.position === line.position).map(entry => ({ group, gap: Math.abs(entry.winRate - line.winRate) })))
      .sort((a, b) => a.gap - b.gap)[0]
    nearest?.group.entries.push(line)
  }
  for (const group of tiers) group.entries.sort((a, b) => b.winRate - a.winRate)
  return { ...first, tiers }
}
