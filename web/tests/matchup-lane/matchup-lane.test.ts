import { describe, expect, it } from 'vitest'
import type { MatchupBoard } from '#common/utils/matchup-lane'
import { movedTo } from '#common/utils/matchup-lane'

const empty = () => ({ TOP: null, JUNGLE: null, MIDDLE: null, BOTTOM: null, UTILITY: null })

describe('movedTo', () => {
  // Ahri against Syndra in the middle; Ornn and Darius on top.
  const board: MatchupBoard = {
    championId: 103,
    position: 'MIDDLE',
    opponentId: 134,
    allies: { ...empty(), TOP: 516 },
    enemies: { ...empty(), TOP: 122 },
  }

  it('moves no champion: the old duel stays in its lane, the new lane\'s picks become the matchup', () => {
    const moved = movedTo(board, 'TOP')
    expect(moved).toMatchObject({ championId: 516, position: 'TOP', opponentId: 122 })
    expect(moved.allies).toMatchObject({ MIDDLE: 103, TOP: null })
    expect(moved.enemies).toMatchObject({ MIDDLE: 134, TOP: null })
  })

  it('leaves the matchup empty on a lane with no picks, and brings it back on the way back', () => {
    const jungle = movedTo(board, 'JUNGLE')
    expect(jungle).toMatchObject({ championId: null, opponentId: null })
    expect(movedTo(jungle, 'MIDDLE')).toMatchObject({ championId: 103, opponentId: 134, allies: { MIDDLE: null }, enemies: { MIDDLE: null } })
  })

  it('keeps the matchup\'s picks when the first lane is picked, filling only what they leave empty', () => {
    const first = movedTo({ ...board, position: null, opponentId: null }, 'TOP')
    expect(first).toMatchObject({ championId: 103, opponentId: 122, allies: { TOP: null }, enemies: { TOP: null } })
  })

  it('changes nothing on the same lane, and keeps the picks when the lane is cleared', () => {
    expect(movedTo(board, 'MIDDLE')).toBe(board)
    expect(movedTo(board, null)).toMatchObject({ championId: 103, opponentId: 134, position: null })
  })
})
