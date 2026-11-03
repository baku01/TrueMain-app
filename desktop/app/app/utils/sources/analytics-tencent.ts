import type { ChampionAnalytics } from '~/utils/sources/analytics'
import { emptyAnalytics, summaryFromOptions } from '~/utils/sources/analytics'
import { measure } from '~/utils/sources/model'
import { TENCENT_POSITION, num, rate, readTencentDetail, tencentLane, tencentMatchups, tencentOptionsOf, tencentRows } from '~/utils/sources/tencent'

/**
 * Tencent's analytics, from a champion's guide: the lane's figures and its
 * rank among the lane's champions, the lanes it is played on, the build
 * panel's options, the lane's matchups, the win rate by game length and the
 * per-game averages. Tencent measures one bracket only, so `eloBracket` is not
 * read.
 */
export async function tencentAnalytics(championId: number, position: string): Promise<ChampionAnalytics> {
  const analytics = emptyAnalytics()
  const detail = await readTencentDetail(championId)
  const lane = detail?.championLane[tencentLane(position)]
  if (!detail || !lane || !num(lane.igamecnt)) return analytics
  const rows = await tencentRows({ position }).catch(() => [])

  analytics.patch = lane.gameversion || null
  const games = num(lane.igamecnt)
  analytics.header = {
    games,
    winRate: num(lane.wincnt) / games,
    pickRate: rate(lane.lanshowrate),
    banRate: rows.find(row => row.championId === championId)?.banRate ?? null,
    tier: rows.find(row => row.championId === championId)?.tier ?? null,
    rank: num(lane.champlanorder) || null,
    rankTotal: rows.length || null,
    averageWinRate: null,
    previous: null,
  }
  const lanes = Object.entries(detail.championLane).filter(([, entry]) => num(entry.igamecnt) > 0)
  const total = lanes.reduce((sum, [, entry]) => sum + num(entry.igamecnt), 0)
  analytics.lanes = lanes
    .map(([name, entry]) => ({ position: TENCENT_POSITION[name] ?? name.toUpperCase(), share: total ? num(entry.igamecnt) / total : 0 }))
    .sort((a, b) => b.share - a.share)

  analytics.options = await tencentOptionsOf(lane)
  analytics.summary = { common: summaryFromOptions(analytics.options, false), winning: summaryFromOptions(analytics.options, true) }
  analytics.skillPaths.priority = analytics.options.skills.map(skill => ({ ...skill }))

  const matchups = await tencentMatchups(championId, { position })
  analytics.matchups = [{ position, rows: matchups.matchups.map(row => ({ championId: row.opponentChampionId, winRate: row.winRate, pickRate: row.playRate, games: row.games })) }]

  // `"wins|games|win rate"` per band, shortest games first.
  try {
    const bands = JSON.parse(detail.championTrend[tencentLane(position)]?.playtime_json || '{}') as Record<string, string>
    analytics.gameLength = Object.keys(bands).sort((a, b) => Number(a) - Number(b)).map((band) => {
      const [, played, winRate] = bands[band]!.split('|').map(Number)
      return measure(played ?? 0, (winRate ?? 0) / 10_000, 0)
    })
  }
  catch {
    // No bands: the section says so.
  }

  analytics.stats = [
    { key: 'kills', value: num(lane.kills) / games, rank: null },
    { key: 'deaths', value: num(lane.deaths) / games, rank: null },
    { key: 'assists', value: num(lane.assists) / games, rank: null },
    { key: 'gold', value: num(lane.goldearnedpergame), rank: null },
    { key: 'minions', value: num(lane.minionskilled), rank: null },
  ]
  return analytics
}
