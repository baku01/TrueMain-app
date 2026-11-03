import type { ChampionAnalytics } from '~/utils/sources/analytics'
import { emptyAnalytics, summaryFromOptions } from '~/utils/sources/analytics'
import { SOLO_QUEUE, blitzRows, blitzTier, truemainPosition } from '~/utils/blitz/client'
import { matchupsFromBlitz, trendFromBlitz } from '~/utils/blitz/stats'
import { readProMatches } from '~/utils/blitz/pro'
import { blitzOptions } from '~/utils/sources/blitz'

/**
 * Blitz's analytics: the header with the patch before, the lanes, the build
 * panel's options, every opponent on the lane, the two patches' trend, and the
 * pros who played the champion lately.
 */
const GRADE: Record<number, string> = { 1: 'S', 2: 'A', 3: 'B', 4: 'C', 5: 'D' }

interface Row {
  individual_position: string
  patch: string
  games: number
  win_rate: number
  pick_rate: number
  champion_ban_rate: number | null
  champion_role_tier: number | null
  role_pct_games: number | null
  previous_patch_stats: { patch: string, games: number, win_rate: number, role_pickrate: number, ban_rate: number | null } | null
}

export async function blitzAnalytics(championId: number, position: string, eloBracket: unknown): Promise<ChampionAnalytics> {
  const query = { position, eloBracket }
  const [rows, options, matchups, trend, pros] = await Promise.all([
    blitzRows<Row>('champion_postmatch_stats', {
      queue_id: SOLO_QUEUE,
      region: 'WORLD',
      tier: blitzTier(eloBracket),
      champion_id: championId,
      columns: 'individual_position,patch,games,win_rate,pick_rate,champion_ban_rate,champion_role_tier,role_pct_games,previous_patch_stats',
    }),
    blitzOptions(championId, position),
    matchupsFromBlitz(championId, query),
    trendFromBlitz(championId, query),
    readProMatches(championId, position).catch(() => []),
  ])
  const analytics = emptyAnalytics()
  const lanes = rows.filter(row => row.individual_position !== 'ALL')
  const row = lanes.find(entry => truemainPosition(entry.individual_position) === position)
  analytics.patch = row?.patch ?? null
  if (row) {
    const previous = row.previous_patch_stats
    analytics.header = {
      games: row.games,
      winRate: row.win_rate,
      pickRate: row.pick_rate,
      banRate: row.champion_ban_rate,
      tier: GRADE[row.champion_role_tier ?? 0] ?? null,
      rank: null,
      rankTotal: null,
      averageWinRate: null,
      previous: previous ? { patch: previous.patch, winRate: previous.win_rate, pickRate: previous.role_pickrate, banRate: previous.ban_rate, games: previous.games } : null,
    }
  }
  analytics.lanes = lanes
    .map(entry => ({ position: truemainPosition(entry.individual_position), share: entry.role_pct_games ?? 0 }))
    .filter(lane => lane.share > 0)
    .sort((a, b) => b.share - a.share)
  analytics.options = options
  if (analytics.options) {
    analytics.summary = { common: summaryFromOptions(analytics.options, false), winning: summaryFromOptions(analytics.options, true) }
    analytics.skillPaths.priority = analytics.options.skills.map(skill => ({ ...skill }))
  }
  analytics.matchups = [{
    position,
    rows: matchups.matchups.map(entry => ({ championId: entry.opponentChampionId, winRate: entry.winRate, pickRate: entry.playRate, games: entry.games })),
  }]
  const series = (pick: (point: typeof trend.points[number]) => number) => [{ label: 'all', points: trend.points.map(point => ({ label: point.patch, value: pick(point) })) }]
  analytics.trend = { winRate: series(point => point.winRate), pickRate: series(point => point.pickRate), banRate: series(point => point.banRate ?? 0), games: series(point => point.games) }

  const players = new Map<number, ChampionAnalytics['topPlayers'][number] & { wins: number }>()
  for (const match of pros) {
    const known = players.get(match.player.id) ?? { name: match.player.name, region: match.region, winRate: 0, games: 0, wins: 0, rank: null, team: match.team?.tag ?? null, portraitUrl: match.player.portraitUrl }
    known.games += 1
    known.wins += match.win ? 1 : 0
    known.winRate = known.wins / known.games
    players.set(match.player.id, known)
  }
  analytics.topPlayers = [...players.values()].sort((a, b) => b.games - a.games).map(({ wins: _wins, ...player }) => player)
  return analytics
}
