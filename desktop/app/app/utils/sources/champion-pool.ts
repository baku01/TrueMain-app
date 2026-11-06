import type { DataSource } from '~/utils/data-source'
import type { PoolRow } from '~/utils/champion-pool'
import type { QueueFilter } from '~/utils/player-form'
import type { Obj } from '~/utils/sources/opgg'
import type { ProfilePlayer } from '~/utils/sources/rank-history'
import { blitzGet } from '~/utils/blitz/client'
import { platformOf, splitRiotId } from '~/utils/blitz/player'
import { keepBounded } from '~/utils/bounded'
import { dataSource } from '~/utils/data-source'
import { rowsIn } from '~/utils/champion-pool'
import { asList, callOpgg, num } from '~/utils/sources/opgg'
import { opggRegion } from '~/utils/sources/opgg-profile'

/**
 * The player's season champion pool — the profile's Champion pool tab — read
 * from the source Settings picked when it carries the queue shown, else from
 * the next one that does.
 *
 * Who carries it (each probed against live players, November 2026):
 * - Blitz (`lol/player_champion_aggregate`): every queue, champion by lane,
 *   with record, KDA and — for the games Blitz saw end, its own users' — LP.
 * - op.gg (`lol_get_summoner_profile` → `most_champions`): Solo/Duo only,
 *   the season's ten most played champions with record and KDA; no lanes, no LP.
 * - TrueMain: none — its profile's mains (`/truemains/{nameTag}/profile`)
 *   count games over the latest fifty, with no record, and only for the
 *   players it tracks: a sample, not a season.
 * - lolalytics: none — it reads no players.
 * - Tencent: none — lol.qq.com's guides are champion data, no players.
 */

interface Carrier {
  filters: readonly QueueFilter[]
  read: (player: ProfilePlayer) => Promise<PoolRow[]>
}

interface BlitzAggregate {
  champion_id: number
  role?: string | null
  queue_id: number
  riot_season_id?: number
  game_count: number
  wins: number
  kills: number
  deaths: number
  assists: number
  lp?: number | null
  lp_games?: number | null
}

const reads = new Map<string, Promise<PoolRow[]>>()

/** One read per player and source, kept for the session: every queue filter folds the same rows. */
function kept(source: string, player: ProfilePlayer, read: () => Promise<PoolRow[]>): Promise<PoolRow[]> {
  const key = `${source}:${platformOf(player.region)}:${player.riotId}`.toLowerCase()
  let answer = reads.get(key)
  if (!answer) {
    answer = read()
    answer.catch(() => reads.delete(key))
    keepBounded(reads, key, answer, 20)
  }
  return answer
}

/** Blitz's rows of the latest season it lists: an aggregate that reaches back a season is not this one's. */
export function blitzPoolRows(rows: readonly BlitzAggregate[]): PoolRow[] {
  const season = rows.reduce((latest, row) => Math.max(latest, row.riot_season_id ?? 0), 0)
  return rows
    .filter(row => (row.riot_season_id ?? 0) === season)
    .map(row => ({
      championId: row.champion_id,
      role: row.role ?? '',
      queueId: row.queue_id,
      games: row.game_count,
      wins: row.wins,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      lp: row.lp ?? 0,
      lpGames: row.lp_games ?? 0,
    }))
}

/** op.gg's season champions (Solo/Duo) as rows without a lane. */
export function opggPoolRows(summoner: Obj | undefined): PoolRow[] {
  const most = asList(summoner?.most_champions)[0]
  return asList(most?.champion_stats).map(stat => ({
    championId: num(stat.id),
    role: '',
    queueId: 420,
    games: num(stat.play),
    wins: num(stat.win),
    kills: num(stat.kill),
    deaths: num(stat.death),
    assists: num(stat.assist),
    lp: 0,
    lpGames: 0,
  })).filter(row => row.championId > 0)
}

export const CHAMPION_POOL_CARRIERS: Partial<Record<DataSource, Carrier>> = {
  blitz: {
    filters: ['all', 'solo', 'flex', 'normal', 'aram'],
    read: player => kept('blitz', player, async () => {
      const parts = splitRiotId(player.riotId)
      if (!parts) return []
      const rows = await blitzGet<BlitzAggregate[] | null>('lol', `lol/player_champion_aggregate/${platformOf(player.region)}/${encodeURIComponent(parts.gameName)}/${encodeURIComponent(parts.tagLine)}`)
      return blitzPoolRows(Array.isArray(rows) ? rows : [])
    }),
  },
  opgg: {
    filters: ['solo'],
    read: player => kept('opgg', player, async () => {
      const parts = splitRiotId(player.riotId)
      if (!parts) return []
      const root = await callOpgg('lol_get_summoner_profile', {
        game_name: parts.gameName,
        tag_line: parts.tagLine,
        region: opggRegion(player.region),
        desired_output_fields: ['data.summoner.most_champions.{game_type,season_id,play,win,lose}', 'data.summoner.most_champions.champion_stats[].{id,play,win,lose,kill,death,assist}'],
      })
      return opggPoolRows((root.data as Obj | undefined)?.summoner as Obj | undefined)
    }),
  },
}

/** After the pick, the sources asked in turn. */
const FALLBACK: DataSource[] = ['blitz', 'opgg']

/** The sources asked for a queue filter's pool, in turn: the pick when it carries the queue, then the others that do. */
export function championPoolOrder(picked: DataSource, filter: QueueFilter, carriers = CHAMPION_POOL_CARRIERS): DataSource[] {
  return [...new Set([picked, ...FALLBACK])].filter(source => carriers[source]?.filters.includes(filter))
}

/**
 * The pool's rows in the queue filter, from the first source in
 * `championPoolOrder` with games in it — one that fails or has none hands
 * over to the next. Null when none has any.
 */
export async function readChampionPool(
  player: ProfilePlayer,
  filter: QueueFilter,
  options: { picked?: DataSource, carriers?: Partial<Record<DataSource, Carrier>> } = {},
): Promise<{ source: DataSource, rows: PoolRow[] } | null> {
  const carriers = options.carriers ?? CHAMPION_POOL_CARRIERS
  for (const source of championPoolOrder(options.picked ?? dataSource.value, filter, carriers)) {
    const rows = rowsIn(await carriers[source]!.read(player).catch(() => []), filter)
    if (rows.some(row => row.games > 0)) return { source, rows }
  }
  return null
}
