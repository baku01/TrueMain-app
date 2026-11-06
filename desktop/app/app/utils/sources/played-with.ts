import type { PlayerGame } from '~/types/record'
import type { DataSource } from '~/utils/data-source'
import type { SideGame, Teammate } from '~/utils/played-with'
import type { ProfilePlayer } from '~/utils/sources/rank-history'
import { apiGet } from '~/composables/useApi'
import { blitzGet } from '~/utils/blitz/client'
import { platformOf, splitRiotId } from '~/utils/blitz/player'
import { keepBounded } from '~/utils/bounded'
import { dataSource } from '~/utils/data-source'
import { sidesOfGames, sortTeammates, teammatesOf } from '~/utils/played-with'

/**
 * Who the player has recently played with — the profile's card of the same
 * name — read from the source Settings picked when it carries it, else from
 * the next one that does, and at the last from the games on screen.
 *
 * Who carries it (each probed against live players, November 2026):
 * - TrueMain: the player's own games, from the client (the shell's `record`
 *   command); another player's matches on TrueMain's API
 *   (`/truemains/{nameTag}/matches`, both teams named), for the players it
 *   tracks only. Asked only when it is the pick: with another source the
 *   shell refuses TrueMain's API.
 * - Blitz (`lol/playstyles`): its "recently played with" over the player's
 *   latest twenty games, each with games and wins together and the account's icon.
 * - op.gg: none — its match list (`lol_list_summoner_matches`) names the
 *   player alone, and a game's full detail is one call per game.
 * - lolalytics: none — it reads no players.
 * - Tencent: none — lol.qq.com's guides are champion data, no players.
 * - The games on screen: the client's for the player's own profile, Blitz's
 *   match data for anyone else's — the last resort.
 */

/** Where the list came from: a source, or the League client's own games. */
export type PlayedWithSource = DataSource | 'client'

export interface PlayedWith { source: PlayedWithSource, games: number, teammates: Teammate[] }

/** What a read knows beyond the player: whether the profile is their own, and the games on screen with where they came from. */
export interface PlayedWithContext {
  own: boolean
  games: readonly PlayerGame[]
  gamesSource: PlayedWithSource
}

type Carrier = (player: ProfilePlayer, context: PlayedWithContext) => Promise<PlayedWith | null>

interface TruemainMatches {
  matches?: { gameDurationSeconds: number, self: { teamId: number, win: boolean }, participants: { teamId: number, gameName: string | null, tagLine: string | null }[] }[]
}

interface Playstyles {
  total_games?: number
  recently_played_with?: { game_name: string, tag_line: string, profile_icon_id?: number | null, games: number, wins: number }[] | null
}

/** The games on screen, folded: the last resort, and TrueMain's answer for the player's own profile. */
function fromGames(player: ProfilePlayer, context: PlayedWithContext, source = context.gamesSource): PlayedWith {
  const sides = sidesOfGames(context.games)
  return { source, games: sides.length, teammates: teammatesOf(sides, splitRiotId(player.riotId)) }
}

const reads = new Map<string, Promise<PlayedWith | null>>()

function kept(source: string, player: ProfilePlayer, read: () => Promise<PlayedWith | null>) {
  const key = `${source}:${platformOf(player.region)}:${player.riotId}`.toLowerCase()
  let answer = reads.get(key)
  if (!answer) {
    answer = read()
    answer.catch(() => reads.delete(key))
    keepBounded(reads, key, answer, 20)
  }
  return answer
}

export const PLAYED_WITH_CARRIERS: Partial<Record<DataSource, Carrier>> = {
  truemain: (player, context) => (context.own
    ? Promise.resolve(fromGames(player, context, 'client'))
    : kept('truemain', player, async () => {
        const answer = await apiGet<TruemainMatches>(`/truemains/${encodeURIComponent(player.riotId.replace('#', '-'))}/matches`, { pageSize: 20 }, { background: true })
        const sides: SideGame[] = (answer.matches ?? []).filter(match => match.gameDurationSeconds >= 300).map(match => ({
          win: match.self.win,
          allies: match.participants.filter(participant => participant.teamId === match.self.teamId),
        }))
        return { source: 'truemain', games: sides.length, teammates: teammatesOf(sides, splitRiotId(player.riotId)) }
      })),
  blitz: player => kept('blitz', player, async () => {
    const parts = splitRiotId(player.riotId)
    if (!parts) return null
    const answer = await blitzGet<Playstyles | null>('lol', `lol/playstyles/${platformOf(player.region)}/${encodeURIComponent(parts.gameName)}/${encodeURIComponent(parts.tagLine)}`)
    const teammates = sortTeammates((answer?.recently_played_with ?? []).map(line => ({
      gameName: line.game_name,
      tagLine: line.tag_line,
      games: line.games,
      wins: line.wins,
      profileIconId: line.profile_icon_id ?? null,
    })))
    return { source: 'blitz', games: answer?.total_games ?? 0, teammates }
  }),
}

/** After the pick, the sources asked in turn, before the games on screen. */
const FALLBACK: DataSource[] = ['blitz']

export function playedWithOrder(picked: DataSource, carriers = PLAYED_WITH_CARRIERS): DataSource[] {
  return [...new Set([picked, ...FALLBACK])].filter(source => carriers[source])
}

/**
 * The list from the first source in `playedWithOrder` that read any games —
 * one that fails or read none hands over to the next — else from the games
 * on screen. A source that read games but met no one twice answers an empty
 * list: that is the answer, not a gap.
 */
export async function readPlayedWith(
  player: ProfilePlayer,
  context: PlayedWithContext,
  options: { picked?: DataSource, carriers?: Partial<Record<DataSource, Carrier>> } = {},
): Promise<PlayedWith | null> {
  const carriers = options.carriers ?? PLAYED_WITH_CARRIERS
  for (const source of playedWithOrder(options.picked ?? dataSource.value, carriers)) {
    const answer = await carriers[source]!(player, context).catch(() => null)
    if (answer && answer.games > 0) return answer
  }
  const fallback = fromGames(player, context)
  return fallback.games > 0 ? fallback : null
}
