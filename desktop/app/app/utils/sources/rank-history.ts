import type { RankHistoryResponse } from '#shared/types/rank-history'
import type { DataSource } from '~/utils/data-source'
import type { BlitzLeagueRow, LeagueSnapshot, RankedQueueType } from '~/utils/league-history'
import { apiGet } from '~/composables/useApi'
import { blitzGet } from '~/utils/blitz/client'
import { platformOf, splitRiotId } from '~/utils/blitz/player'
import { keepBounded } from '~/utils/bounded'
import { dataSource } from '~/utils/data-source'
import { leagueSnapshots } from '~/utils/league-history'
import { readOpggProfile } from '~/utils/sources/opgg-profile'

/**
 * A player's LP over time in one ranked queue — the ranked card's curve and
 * the LP history tab — read from the source Settings picked when it carries
 * that queue, else from the next one that does.
 *
 * Who carries it (each probed against live players, November 2026):
 * - Blitz (`riot_account_v2` → `league_lol`): Solo/Duo and Flex, for any
 *   player, Blitz's latest 100 snapshots of each — most of a season, often
 *   the start of it.
 * - TrueMain (`/truemains/{nameTag}/rank-history`): Solo/Duo only, 90 days,
 *   only the players TrueMain tracks (any other answers 404). Asked only when
 *   it is the pick: with another source the shell refuses TrueMain's API.
 * - op.gg (`lol_get_summoner_profile` → `lp_histories`): Solo/Duo only, a few
 *   snapshots over recent weeks.
 * - lolalytics: none — it reads no players (its API answers `invalid end
 *   point` to a profile; it lists names on a champion's ladder only).
 * - Tencent: none — lol.qq.com's guides are champion data, no players.
 * - This machine (`utils/lp-history.ts`): the player's own Solo/Duo, as the
 *   app saw it since it was installed — the last resort, after every source.
 */

export interface ProfilePlayer { riotId: string, region: string }

/** Where a history came from: a source, or this machine's own record of the player. */
export type HistorySource = DataSource | 'local'

export interface LeagueHistory { source: HistorySource, entries: LeagueSnapshot[] }

interface Carrier {
  queues: readonly RankedQueueType[]
  read: (player: ProfilePlayer, queue: RankedQueueType) => Promise<LeagueSnapshot[]>
}

type AccountLeagues = { league_lol?: Record<string, BlitzLeagueRow[] | null> | null }

const accounts = new Map<string, Promise<AccountLeagues>>()

/** Blitz's account read, kept for the session: both queues come in the one answer. */
function blitzLeagues(player: ProfilePlayer): Promise<AccountLeagues> {
  const parts = splitRiotId(player.riotId)
  if (!parts) return Promise.resolve({})
  const key = `${platformOf(player.region)}/${parts.gameName}/${parts.tagLine}`.toLowerCase()
  let answer = accounts.get(key)
  if (!answer) {
    answer = blitzGet<AccountLeagues>('lol', `riot_account_v2/lol/${platformOf(player.region)}/${encodeURIComponent(parts.gameName)}/${encodeURIComponent(parts.tagLine)}`)
    answer.catch(() => accounts.delete(key))
    keepBounded(accounts, key, answer, 30)
  }
  return answer
}

const byTime = (entries: LeagueSnapshot[]) => [...entries].sort((a, b) => a.capturedAtUtc.localeCompare(b.capturedAtUtc))

export const RANK_HISTORY_CARRIERS: Partial<Record<DataSource, Carrier>> = {
  truemain: {
    queues: ['RANKED_SOLO_5x5'],
    read: player => apiGet<RankHistoryResponse>(`/truemains/${encodeURIComponent(player.riotId.replace('#', '-'))}/rank-history`, {}, { background: true })
      .then(answer => byTime(answer.entries ?? [])),
  },
  blitz: {
    queues: ['RANKED_SOLO_5x5', 'RANKED_FLEX_SR'],
    read: (player, queue) => blitzLeagues(player).then(answer => leagueSnapshots(answer.league_lol?.[queue] ?? [])),
  },
  opgg: {
    queues: ['RANKED_SOLO_5x5'],
    read: (player) => {
      const parts = splitRiotId(player.riotId)
      return parts ? readOpggProfile(player.region, parts.gameName, parts.tagLine).then(profile => byTime(profile?.lpHistory ?? [])) : Promise.resolve([])
    },
  },
}

/** After the pick, the sources asked in turn. Not TrueMain: with another source picked the shell refuses its API. */
const FALLBACK: DataSource[] = ['blitz', 'opgg']

/** The sources asked for a queue's history, in turn: the pick when it carries the queue, then the others that do. */
export function rankHistoryOrder(picked: DataSource, queue: RankedQueueType, carriers = RANK_HISTORY_CARRIERS): DataSource[] {
  return [...new Set([picked, ...FALLBACK])].filter(source => carriers[source]?.queues.includes(queue))
}

/** Below this many snapshots a source holds a standing, not a history: the next one is asked. */
const MIN_SNAPSHOTS = 2

/**
 * The queue's history from the first source in `rankHistoryOrder` that
 * answers with a history — one that fails, has none or holds a lone snapshot
 * hands over to the next — then, for the player's own Solo/Duo, the snapshots
 * this machine kept (`local`). A lone snapshot is drawn when nothing holds
 * more; null when nothing carries any.
 */
export async function readLeagueHistory(
  player: ProfilePlayer,
  queue: RankedQueueType,
  options: { picked?: DataSource, carriers?: Partial<Record<DataSource, Carrier>>, local?: readonly LeagueSnapshot[] } = {},
): Promise<LeagueHistory | null> {
  const carriers = options.carriers ?? RANK_HISTORY_CARRIERS
  let lone: LeagueHistory | null = null
  for (const source of rankHistoryOrder(options.picked ?? dataSource.value, queue, carriers)) {
    const entries = await carriers[source]!.read(player, queue).catch(() => [])
    if (entries.length >= MIN_SNAPSHOTS) return { source, entries }
    if (entries.length) lone ??= { source, entries }
  }
  const local = queue === 'RANKED_SOLO_5x5' ? options.local ?? [] : []
  if (local.length >= MIN_SNAPSHOTS || (local.length && !lone)) return { source: 'local', entries: [...local] }
  return lone
}
