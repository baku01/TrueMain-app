import type { Ref } from 'vue'
import type { ChampionPosition } from '#common/utils/positions'

/** The matchup board: our pick and lane, the lane opponent, and the other eight slots. */
export interface MatchupBoard {
  championId: number | null
  position: ChampionPosition | null
  opponentId: number | null
  allies: Record<ChampionPosition, number | null>
  enemies: Record<ChampionPosition, number | null>
}

/**
 * The board once the matchup moves to another lane: every pick stays where it
 * stands. Ours and the opponent's become the old lane's ally and enemy, and
 * the new lane's ally and enemy become ours and the opponent's — the lane
 * picked says which duel is the matchup, it moves no champion (Ahri against
 * Syndra in the middle, the lane set to top: they stay in the middle, and
 * the top lane's picks face each other). With no lane before, the matchup's
 * picks stand and the new lane's fill only what they leave empty.
 */
export function movedTo(board: MatchupBoard, position: ChampionPosition | null): MatchupBoard {
  if (position === board.position) return board
  const allies = { ...board.allies }
  const enemies = { ...board.enemies }
  if (!position) return { ...board, position }
  const before = board.position
  const championId = before ? allies[position] : board.championId ?? allies[position]
  const opponentId = before ? enemies[position] : board.opponentId ?? enemies[position]
  if (before) {
    allies[before] = board.championId
    enemies[before] = board.opponentId
  }
  allies[position] = null
  enemies[position] = null
  return { championId, position, opponentId, allies, enemies }
}

/** A page's board as its refs, each field of `MatchupBoard` one. */
export type MatchupBoardRefs = { [Key in keyof MatchupBoard]: Ref<MatchupBoard[Key]> }

/** The lane picker's handler: the board's refs set to the board moved to `position` (`movedTo`). */
export function moveLane(board: MatchupBoardRefs, position: ChampionPosition | null) {
  const moved = movedTo({ championId: board.championId.value, position: board.position.value, opponentId: board.opponentId.value, allies: board.allies.value, enemies: board.enemies.value }, position)
  board.championId.value = moved.championId
  board.position.value = moved.position
  board.opponentId.value = moved.opponentId
  board.allies.value = moved.allies
  board.enemies.value = moved.enemies
}
