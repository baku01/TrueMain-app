import type { TopPlayer } from '~/utils/sources/analytics'
import type { DataSource } from '~/utils/data-source'
import type { Obj } from '~/utils/sources/opgg'
import { dataSource } from '~/utils/data-source'
import { readPlayerAccount, splitRiotId } from '~/utils/blitz/player'
import { championSlug, liveVersion } from '~/utils/sources/champions'
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

const icons = new Map<string, Promise<string | null>>()

/**
 * A player's profile icon, read from their account through Blitz (lolalytics
 * lists names only): Data Dragon's picture for the icon the account wears.
 * Kept for the session; null for an account Blitz does not find. Read by
 * each avatar on its own (`PlayerAvatar`), so a list never waits on them.
 */
export function accountIconOf(name: string, region: string | null): Promise<string | null> {
  const key = `${region}:${name}`
  let read = icons.get(key)
  if (!read) {
    const id = splitRiotId(name)
    read = id && region
      ? Promise.all([readPlayerAccount(region, id.gameName, id.tagLine), liveVersion()])
          .then(([account, version]) => (account?.profileIconId != null ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${account.profileIconId}.png` : null))
          .catch(() => null)
      : Promise.resolve(null)
    icons.set(key, read)
  }
  return read
}

async function lolalyticsPlayers(championId: number, position: string): Promise<TopPlayer[]> {
  const build = await readLolalyticsBuild(championId, position)
  const players = (build?.sidebar?.topList ?? []).map(([, name, region, wr, games, elo]) => ({
    name,
    region: region ? region.toUpperCase() : null,
    winRate: Number(wr) / 100,
    games: Number(games),
    rank: elo || null,
  }))
  return players
}


const READERS: Partial<Record<DataSource, (championId: number, position: string) => Promise<TopPlayer[]>>> = {
  opgg: opggPlayers,
  lolalytics: lolalyticsPlayers,
}

/** The picked source's best players on the champion; null for Blitz, whose pros are read with their games. */
export function readTopPlayers(championId: number, position: string): Promise<TopPlayer[]> | null {
  return READERS[dataSource.value]?.(championId, position) ?? null
}
