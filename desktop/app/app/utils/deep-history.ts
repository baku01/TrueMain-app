import type { PlayerGame } from '~/types/record'
import type { MatchAnswer, RiotTimeline } from '~/utils/blitz/player'

/**
 * The player's history read past what the client keeps: the client's own
 * pages, then their games on Blitz (`useDeepHistory`), then what this machine
 * saved from earlier sessions (`history-store`). The pure half of it: merging
 * the three without counting a game twice, and which of Blitz's match ids are
 * still worth reading.
 *
 * A game is one game whatever reads it: the client's `gameId` is the number
 * after the platform in Riot's match id (`KR_8421752997` is game 8421752997).
 */

/** Where a game was read from, this session: the client, Blitz, or this machine's store of earlier ones. */
export type GameSource = 'client' | 'blitz' | 'saved'

/** A match id (`BR1_3012345678`) to the client's `gameId`; null when it carries none. */
export function gameIdOfMatch(matchId: string): number | null {
  const id = Number(matchId.slice(matchId.lastIndexOf('_') + 1))
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export interface MergedHistory {
  /** Newest first, one game per `gameId`, at most the limit. */
  games: PlayerGame[]
  /** Which source each kept game was taken from. */
  sourceOf: Map<number, GameSource>
}

/**
 * Several reads of the history as one: newest first, one game per `gameId`,
 * the first list that holds a game giving it — the client's before Blitz's
 * before the saved one, so the freshest read of a game is the one kept —
 * and only the newest `limit`.
 */
export function mergeHistory(lists: readonly (readonly [GameSource, readonly PlayerGame[]])[], limit = Number.POSITIVE_INFINITY): MergedHistory {
  const byId = new Map<number, { game: PlayerGame, source: GameSource }>()
  for (const [source, games] of lists) {
    for (const game of games) {
      if (!byId.has(game.gameId)) byId.set(game.gameId, { game, source })
    }
  }
  const kept = [...byId.values()]
    .sort((a, b) => b.game.playedAt - a.game.playedAt || b.game.gameId - a.game.gameId)
    .slice(0, Math.max(0, limit))
  return { games: kept.map(entry => entry.game), sourceOf: new Map(kept.map(entry => [entry.game.gameId, entry.source])) }
}

/**
 * The match ids still worth reading, newest first: those of no game held and
 * none skipped (read and failed this session). Once `limit` games are held,
 * only the ids newer than the oldest one kept — an older game would fall off
 * the end the moment it landed. A platform numbers its games in order, so the
 * id says which is newer.
 */
export function idsToRead(ids: readonly string[], held: readonly PlayerGame[], limit: number, skip: ReadonlySet<string> = new Set()): string[] {
  const known = new Set(held.map(game => game.gameId))
  const newest = [...held].sort((a, b) => b.playedAt - a.playedAt || b.gameId - a.gameId)
  const floor = newest.length >= limit ? newest[limit - 1]?.gameId ?? null : null
  return ids
    .map(id => ({ id, gameId: gameIdOfMatch(id) }))
    .filter((entry): entry is { id: string, gameId: number } => entry.gameId !== null && !known.has(entry.gameId) && !skip.has(entry.id))
    .filter(entry => floor === null || entry.gameId > floor)
    .sort((a, b) => b.gameId - a.gameId)
    .map(entry => entry.id)
}

/** `work` over every item, at most `limit` at once, the answers in the items' order. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const answers = Array.from<R>({ length: items.length })
  let next = 0
  const lane = async () => {
    while (next < items.length) {
      const index = next++
      answers[index] = await work(items[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, lane))
  return answers
}

/** How many of the games each source gave. */
export function sourceCounts(sourceOf: ReadonlyMap<number, GameSource>): Record<GameSource, number> {
  const counts: Record<GameSource, number> = { client: 0, blitz: 0, saved: 0 }
  for (const source of sourceOf.values()) counts[source]++
  return counts
}

/**
 * What reading the player's games on Blitz takes: their match ids, newest
 * first, and each match with its timeline — Blitz itself in the app
 * (`useDeepHistory`), a made-up history in `npm run dev`.
 */
export interface BlitzHistorySource {
  /** The player's id in Riot's match data, to find their line in each match. */
  puuid: string
  matchIds: () => Promise<string[]>
  match: (id: string) => Promise<MatchAnswer>
  timeline: (id: string) => Promise<RiotTimeline | null>
}
