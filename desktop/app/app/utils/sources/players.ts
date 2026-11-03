import type { TopPlayer } from '~/utils/sources/analytics'
import type { DataSource } from '~/utils/data-source'
import type { Obj } from '~/utils/sources/opgg'
import { dataSource } from '~/utils/data-source'
import { championSlug } from '~/utils/sources/champions'
import { readLolalyticsBuild } from '~/utils/sources/lolalytics'
import { asList, callOpgg, num } from '~/utils/sources/opgg'

/**
 * The best players on a champion, as each source ranks them — for ProBuild
 * and the champion page's side list. Blitz's pros come with their games
 * (`utils/blitz/pro.ts`) and are drawn apart; the others give players:
 * op.gg its master+ leaderboard of the champion, region by region; lolalytics
 * the top of its own ladder on the lane. TrueMain lists none.
 */
const OPGG_REGIONS = ['KR', 'EUW', 'NA', 'BR'] as const

async function opggPlayers(championId: number): Promise<TopPlayer[]> {
  const slug = await championSlug(championId)
  if (!slug) return []
  const boards = await Promise.all(OPGG_REGIONS.map(region =>
    callOpgg('lol_list_champion_leaderboard', { region, champion: slug.toUpperCase() })
      .then(answer => asList(answer.leaderboard).map(entry => ({ entry, region })))
      .catch(() => [])))
  return boards.flat().map(({ entry, region }) => {
    const summoner = entry.summoner as Obj | undefined
    const stat = entry.most_champion_stat as Obj | undefined
    const solo = asList(summoner?.league_stats).find(league => league.game_type === 'SOLORANKED')?.tier_info as Obj | undefined
    const games = num(stat?.play)
    return {
      name: summoner?.game_name ? `${String(summoner.game_name)}#${String(summoner.tagline ?? '')}` : String(summoner?.name ?? '?'),
      region,
      winRate: games > 0 ? num(stat?.win) / games : null,
      games,
      rank: solo?.tier ? `${String(solo.tier)}${solo.division ? ` ${num(solo.division)}` : ''} · ${num(solo.lp)} LP` : null,
      portraitUrl: typeof summoner?.profile_image_url === 'string' ? summoner.profile_image_url : null,
    }
  }).sort((a, b) => b.games - a.games)
}

async function lolalyticsPlayers(championId: number, position: string): Promise<TopPlayer[]> {
  const build = await readLolalyticsBuild(championId, position)
  return (build?.sidebar?.topList ?? []).map(([, name, region, wr, games, elo]) => ({
    name,
    region: region ? region.toUpperCase() : null,
    winRate: Number(wr) / 100,
    games: Number(games),
    rank: elo || null,
  }))
}

const READERS: Partial<Record<DataSource, (championId: number, position: string) => Promise<TopPlayer[]>>> = {
  opgg: opggPlayers,
  lolalytics: lolalyticsPlayers,
}

/** The picked source's best players on the champion; null for Blitz, whose pros are read with their games. */
export function readTopPlayers(championId: number, position: string): Promise<TopPlayer[]> | null {
  return READERS[dataSource.value]?.(championId, position) ?? null
}
