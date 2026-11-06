import { tr } from '#common/utils/i18n'
import type { PlayerGame } from '~/types/record'

/** The player's own recent games on one champion: how many of the last `of`, and how many won. */
export interface Comfort {
  played: number
  of: number
  wins: number
}

/** The games the comfort line counts over — the client's first page of history. */
export const COMFORT_GAMES = 20

/**
 * The player's comfort on a champion (#1906), from their own client's match
 * history: the line the card says on hover. Remakes are not games played. Null
 * when the champion is not among them. The order weighs the same games only
 * through the player's own suggestion weights, its comfort category
 * (`utils/draft-weights`, `useDraftSuggestionItems`), which they can set to 0.
 */
export function comfortOf(games: PlayerGame[], championId: number): Comfort | null {
  const recent = games.filter(game => !game.remake).slice(0, COMFORT_GAMES)
  const on = recent.filter(game => game.championId === championId)
  if (!on.length) return null
  return { played: on.length, of: recent.length, wins: on.filter(game => game.win).length }
}

/** "Your Annie: 12 of your last 20 games, 7 wins". */
export function comfortText(name: string, comfort: Comfort): string {
  return tr(comfort.wins === 1 ? 'draft.comfort.one' : 'draft.comfort.other', { name, played: comfort.played, of: comfort.of, wins: comfort.wins })
}
