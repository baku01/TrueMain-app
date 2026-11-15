import type { ChampionAnalytics } from '~/utils/sources/analytics'
import { emptyAnalytics, summaryFromOptions } from '~/utils/sources/analytics'
import { mobalyticsMatchups, mobalyticsOptionsOf, readMobalyticsChampion } from '~/utils/sources/mobalytics'

/**
 * Mobalytics' analytics, from the one champion read its build panel makes:
 * the header (its games, the latest patch's rates, its grade), the build
 * panel's options and the opponents on the lane. Its rates are percentages.
 */
export async function mobalyticsAnalytics(championId: number, position: string, eloBracket: unknown): Promise<ChampionAnalytics> {
  const [champion, matchups] = await Promise.all([
    readMobalyticsChampion(championId, position, eloBracket),
    mobalyticsMatchups(championId, { position, eloBracket }),
  ])
  const analytics = emptyAnalytics()
  const stats = champion?.stats
  if (!champion || !stats) return analytics
  const latest = (history: { value: number }[]) => history.at(-1)?.value ?? null
  const winRate = latest(stats.winRateHistory)
  analytics.patch = stats.winRateHistory.at(-1)?.x ?? null
  analytics.header = winRate === null
    ? null
    : {
        games: stats.totalMatchCount,
        winRate: winRate / 100,
        pickRate: (latest(stats.pickRateHistory) ?? 0) / 100,
        banRate: latest(stats.banRateHistory) === null ? null : latest(stats.banRateHistory)! / 100,
        tier: stats.tier,
        rank: null,
        rankTotal: null,
        averageWinRate: null,
        previous: null,
      }
  analytics.options = mobalyticsOptionsOf(champion)
  if (analytics.options) {
    analytics.summary = { common: summaryFromOptions(analytics.options, false), winning: summaryFromOptions(analytics.options, true) }
    analytics.skillPaths.priority = analytics.options.skills.map(skill => ({ ...skill }))
  }
  analytics.matchups = [{
    position,
    rows: matchups.matchups.map(entry => ({ championId: entry.opponentChampionId, winRate: entry.winRate, pickRate: entry.playRate, games: entry.games })),
  }]
  return analytics
}
