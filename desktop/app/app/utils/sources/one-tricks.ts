import type { DataSource } from '~/utils/data-source'
import { dataSource } from '~/utils/data-source'
import { blitzRole, blitzRows } from '~/utils/blitz/client'
import { apiGet } from '~/composables/useApi'

/**
 * A champion's one-tricks on a lane — the players who play it in nearly every
 * game, ranked by how much of a one-trick they are — as ProBuild lists them
 * (Blitz's "One Tricks" page). Which sources carry them, probed (16.22):
 *
 * - TrueMain: yes — its true mains filtered to one-tricks
 *   (`GET /truemains?otpOnly=true&sort=dedication`): the dedication score
 *   (0–100), the champion's share of their games, their games on it, their
 *   rank. Its win rate is the player's overall one, not on the champion: left
 *   out. Never asked once another source is picked: the shell refuses
 *   TrueMain's API then (`api.rs`).
 * - Blitz: yes — `otp_players` (by lane, optionally by platform): its OTP
 *   score (0–1), the champion's share, games and win rate on it, the rank.
 * - op.gg: no — its champion leaderboard (`lol_list_champion_leaderboard`)
 *   ranks master+ players by their play on the champion, with no share of
 *   their games: the most active, not the one-tricks.
 * - lolalytics: no — its top list is the champion's best-ranked players, the
 *   same reading.
 * - Tencent: no player of any kind.
 *
 * So the picked source answers when it has them (TrueMain), Blitz otherwise
 * — and after a TrueMain that fails or lists none.
 */

export type OneTrickSource = 'truemain' | 'blitz'

export interface OneTrick {
  gameName: string
  tagLine: string
  /** Riot's platform id (`EUW1`); null where the source does not say. */
  platformId: string | null
  profileIconId: number | null
  tier: string | null
  division: string | null
  leaguePoints: number | null
  /** How much of a one-trick, 0–1: Blitz's OTP score, TrueMain's dedication over 100. */
  score: number | null
  /** Games on the champion. */
  games: number
  /** The champion's share of their games, 0–1. */
  share: number | null
  /** Their win rate on the champion; null where the source has none for it. */
  winRate: number | null
}

export interface OneTricks {
  source: OneTrickSource
  players: OneTrick[]
}

/** Rows asked for: Blitz answers about two hundred, TrueMain pages them; a table of fifty reads as a leaderboard. */
const LIMIT = 50

type Reader = (championId: number, position: string, platformId: string | null) => Promise<OneTrick[]>

interface BlitzOtpRow {
  riot_id_game_name: string
  riot_id_tagline: string
  profile_region: string | null
  rank_tier: string | null
  rank_division: string | null
  league_points: number | null
  otp_score: number | null
  games_on_champion: number
  champion_share: number | null
  winrate_on_champion: number | null
}

const blitzOneTricks: Reader = async (championId, position, platformId) => {
  const rows = await blitzRows<BlitzOtpRow>('otp_players', { champion_id: championId, individual_position: blitzRole(position), profile_region: platformId })
  return rows
    .map(row => ({
      gameName: row.riot_id_game_name,
      tagLine: row.riot_id_tagline,
      platformId: row.profile_region || null,
      profileIconId: null,
      tier: row.rank_tier || null,
      division: row.rank_division || null,
      leaguePoints: row.league_points ?? null,
      score: row.otp_score ?? null,
      games: row.games_on_champion ?? 0,
      share: row.champion_share ?? null,
      winRate: row.winrate_on_champion ?? null,
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, LIMIT)
}

interface TruemainRow {
  identity: { gameName: string, tagLine: string, platformId: string | null, profileIconId: number | null }
  ranked: { tier: string, division: string, leaguePoints: number } | null
  dedication: { score: number, playRate: number, championGames: number, championId: number } | null
}

const truemainOneTricks: Reader = async (championId, position, platformId) => {
  const answer = await apiGet<{ rows: TruemainRow[] }>('/truemains', { championId, position, otpOnly: true, sort: 'dedication', pageSize: LIMIT })
  return (answer.rows ?? [])
    .filter(row => !platformId || row.identity.platformId?.toUpperCase() === platformId.toUpperCase())
    .map(row => ({
      gameName: row.identity.gameName,
      tagLine: row.identity.tagLine,
      platformId: row.identity.platformId ?? null,
      profileIconId: row.identity.profileIconId ?? null,
      tier: row.ranked?.tier || null,
      division: row.ranked?.division || null,
      leaguePoints: row.ranked?.leaguePoints ?? null,
      score: row.dedication ? row.dedication.score / 100 : null,
      games: row.dedication?.championGames ?? 0,
      share: row.dedication?.playRate ?? null,
      winRate: null,
    }))
}

const READERS: Record<OneTrickSource, Reader> = { truemain: truemainOneTricks, blitz: blitzOneTricks }

/** The sources asked, in turn, with `picked` in Settings: TrueMain only when it is the pick, Blitz always. */
export function oneTrickOrder(picked: DataSource): OneTrickSource[] {
  return picked === 'truemain' ? ['truemain', 'blitz'] : ['blitz']
}

/**
 * The first source in `order` that lists someone; one that fails or lists no
 * one passes to the next. Every source empty: the first that answered, with
 * no one. Every source failed: the last failure.
 */
export async function firstOneTricks(
  order: OneTrickSource[],
  readers: Record<OneTrickSource, Reader>,
  championId: number,
  position: string,
  platformId: string | null,
): Promise<OneTricks> {
  let failure: unknown = null
  let empty: OneTrickSource | null = null
  for (const source of order) {
    try {
      const players = await readers[source](championId, position, platformId)
      if (players.length) return { source, players }
      empty ??= source
    }
    catch (error) {
      failure = error
    }
  }
  if (empty) return { source: empty, players: [] }
  throw failure ?? new Error('no source lists one-tricks')
}

/** The champion's one-tricks on the lane, from the first source that has them; `platformId` (`EUW1`) narrows them to one server. */
export function readOneTricks(championId: number, position: string, platformId: string | null = null): Promise<OneTricks> {
  return firstOneTricks(oneTrickOrder(dataSource.value), READERS, championId, position, platformId)
}
