import type { ChampionAnalytics, LaneRows } from '~/utils/sources/analytics'
import type { Obj } from '~/utils/sources/opgg'
import { emptyAnalytics, summaryFromOptions } from '~/utils/sources/analytics'
import { POSITION, analysis, asList, items, num, optionsOf } from '~/utils/sources/opgg'

/**
 * op.gg's analytics, from the one champion analysis its API answers: the
 * header (op.gg grades 1–5 and ranks the champion on its lane), the lanes, the
 * build panel's options, the fourth to sixth items, the lane's counters, the
 * best allies on each other lane, and the patch's rates.
 */
export async function opggAnalytics(championId: number, position: string, eloBracket: unknown): Promise<ChampionAnalytics> {
  const data = await analysis(championId, position, eloBracket)
  const analytics = emptyAnalytics()
  if (!data) return analytics
  const summary = data.summary as Obj | undefined
  const average = summary?.average_stats as Obj | undefined
  const tierData = average?.tier_data as Obj | undefined
  const trends = data.trends as Obj | undefined
  const win = asList(trends?.win)[0]

  analytics.patch = win ? String(win.version) : null
  analytics.header = {
    games: num(average?.play),
    winRate: num(average?.win_rate),
    pickRate: num(average?.pick_rate),
    banRate: num(average?.ban_rate),
    tier: average?.tier === undefined ? null : String(average.tier),
    rank: tierData ? num(tierData.rank) : null,
    rankTotal: null,
    averageWinRate: null,
    previous: null,
  }
  const lanes = asList(summary?.positions)
  const lanesGames = lanes.reduce((sum, lane) => sum + num((lane.stats as Obj | undefined)?.play), 0)
  analytics.lanes = lanes.map(lane => ({
    position: POSITION[String(lane.name).toLowerCase()] ?? String(lane.name),
    share: lanesGames > 0 ? num((lane.stats as Obj | undefined)?.play) / lanesGames : 0,
  })).sort((a, b) => b.share - a.share)
  analytics.options = optionsOf(data)
  if (analytics.options) {
    analytics.summary = { common: summaryFromOptions(analytics.options, false), winning: summaryFromOptions(analytics.options, true) }
    analytics.skillPaths.priority = analytics.options.skills.map(skill => ({ ...skill }))
  }
  analytics.itemSlots = [
    { slot: 4, options: items(data.fourth_items) },
    { slot: 5, options: items(data.fifth_items) },
    { slot: 6, options: items(data.sixth_items) },
  ].filter(slot => slot.options.length > 0)

  const counters = new Map<number, { games: number, wins: number }>()
  for (const entry of [...asList(data.strong_counters), ...asList(data.weak_counters), ...lanes.flatMap(lane => asList(lane.counters))]) {
    const id = num(entry.champion_id)
    if (id && !counters.has(id)) counters.set(id, { games: num(entry.play), wins: num(entry.win) })
  }
  analytics.matchups = [{
    position,
    rows: [...counters].map(([id, { games, wins }]) => ({ championId: id, winRate: games > 0 ? wins / games : 0, pickRate: null, games })),
  }]

  const synergies = data.synergies as Obj | undefined
  analytics.synergies = Object.entries(synergies ?? {}).map(([lane, list]): LaneRows => ({
    position: POSITION[lane] ?? lane.toUpperCase(),
    rows: asList(list).map(entry => ({ championId: num(entry.synergy_champion_id), winRate: num(entry.win_rate), pickRate: null, games: num(entry.play) })),
  })).filter(lane => lane.rows.length > 0)

  if (win) {
    const point = (value: Obj | undefined) => [{ label: String(win.version), value: num(value?.rate) }]
    analytics.trend = {
      winRate: [{ label: 'all', points: point(win) }],
      pickRate: [{ label: 'all', points: point(asList(trends?.pick)[0]) }],
      banRate: [{ label: 'all', points: point(asList(trends?.ban)[0]) }],
      games: [],
    }
  }
  return analytics
}
