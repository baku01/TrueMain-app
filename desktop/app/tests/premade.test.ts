import { describe, expect, it } from 'vitest'
import type { LoadingPlayer } from '~/types/loading'
import { premades } from '~/utils/premade'

const player = (riotId: string, team: 'ORDER' | 'CHAOS', gameIds: number[]): LoadingPlayer => ({
  riotId, championId: 1, team, position: '', isMe: false, anonymous: false, failed: false, rank: null, rankRead: true, rankFailed: false, laning: null,
  form: { games: gameIds.length, championGames: 0, championWins: 0, championKills: 0, championDeaths: 0, championAssists: 0, positions: [], streak: 0, recent: [], champions: [], gameIds },
})

describe('premades', () => {
  it('groups the players of a team who share their latest games, a third joining a duo', () => {
    const groups = premades([
      player('a#1', 'ORDER', [1, 2, 3, 9]),
      player('b#1', 'ORDER', [1, 2, 7]),
      player('c#1', 'ORDER', [2, 3, 8]),
      player('d#1', 'ORDER', [4, 5]),
      player('e#1', 'ORDER', [5, 6]),
      player('x#1', 'CHAOS', [1, 2, 3]),
    ])
    expect(groups.get('a#1')).toEqual({ size: 3, group: 0 })
    expect(groups.get('b#1')).toEqual({ size: 3, group: 0 })
    expect(groups.get('c#1')).toEqual({ size: 3, group: 0 })
    // One game shared is a coincidence, not a duo; and the other team is its own.
    expect(groups.has('d#1')).toBe(false)
    expect(groups.has('x#1')).toBe(false)
  })

  it('tells two duos of one team apart', () => {
    const groups = premades([player('a#1', 'CHAOS', [1, 2]), player('b#1', 'CHAOS', [1, 2]), player('c#1', 'CHAOS', [5, 6]), player('d#1', 'CHAOS', [5, 6])])
    expect([groups.get('a#1')!.group, groups.get('c#1')!.group]).toEqual([0, 1])
    expect(groups.get('d#1')).toEqual({ size: 2, group: 1 })
  })
})
