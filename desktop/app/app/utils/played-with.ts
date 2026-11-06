import type { PlayerGame } from '~/types/record'

/**
 * The players the profiled player keeps meeting on their own side — a duo, a
 * premade, a friend — as Blitz's "Recently played with" lists them: everyone
 * on the player's team in at least two of the games read, with the games
 * together and how they went. Pure folds; who carries them is
 * `utils/sources/played-with.ts`.
 */

export interface Teammate {
  gameName: string
  tagLine: string
  games: number
  wins: number
  /** The account's icon where the source gives it; the avatar reads it otherwise. */
  profileIconId: number | null
}

/** One game seen from the player's side: whether it was won, and who else was on the team. */
export interface SideGame {
  win: boolean
  allies: { gameName: string | null, tagLine: string | null }[]
}

/** Below this many games together a teammate is a stranger matched once. */
export const MIN_GAMES_TOGETHER = 2

/** The teammates met in at least `MIN_GAMES_TOGETHER` of the games, the most met first, then the most won with. */
export function teammatesOf(games: readonly SideGame[], self?: { gameName: string, tagLine: string } | null): Teammate[] {
  const own = self ? `${self.gameName}#${self.tagLine}`.toLowerCase() : null
  const met = new Map<string, Teammate>()
  for (const game of games) {
    const seen = new Set<string>()
    for (const ally of game.allies) {
      if (!ally.gameName || !ally.tagLine) continue
      const key = `${ally.gameName}#${ally.tagLine}`.toLowerCase()
      if (key === own || seen.has(key)) continue
      seen.add(key)
      const line = met.get(key) ?? { gameName: ally.gameName, tagLine: ally.tagLine, games: 0, wins: 0, profileIconId: null }
      met.set(key, line)
      line.games += 1
      if (game.win) line.wins += 1
    }
  }
  return sortTeammates([...met.values()])
}

export const sortTeammates = (teammates: Teammate[]) => teammates
  .filter(teammate => teammate.games >= MIN_GAMES_TOGETHER)
  .sort((a, b) => b.games - a.games || b.wins - a.wins || a.gameName.localeCompare(b.gameName))

/** The client's (or Blitz's) games as sides: remakes left out, as from every count of the profile's. */
export function sidesOfGames(games: readonly PlayerGame[]): SideGame[] {
  return games.filter(game => !game.remake).map(game => ({
    win: game.win,
    allies: game.participants
      .filter(participant => participant.teamId === game.teamId && participant.participantId !== game.participantId)
      .map(participant => ({ gameName: participant.gameName, tagLine: participant.tagLine })),
  }))
}
