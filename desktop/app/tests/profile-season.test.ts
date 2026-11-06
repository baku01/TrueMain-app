import { describe, expect, it, vi } from 'vitest'
import type { PoolRow } from '~/utils/champion-pool'
import { poolRoles, rowsIn } from '~/utils/champion-pool'
import { sidesOfGames, teammatesOf } from '~/utils/played-with'
import { blitzPoolRows, opggPoolRows } from '~/utils/sources/champion-pool'
import { game } from './fixtures'

/** The folds behind the Champion pool tab and the "Recently played with" card. */

vi.mock('~/utils/blitz/client', () => ({ blitzGet: vi.fn() }))
vi.mock('~/utils/sources/opgg-profile', () => ({ opggRegion: (region: string) => region }))
vi.mock('~/utils/sources/opgg', () => ({
  callOpgg: vi.fn(),
  asList: (value: unknown) => (Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : []),
  num: (value: unknown) => (typeof value === 'number' ? value : 0),
}))

const row = (overrides: Partial<PoolRow>): PoolRow => ({ championId: 1, role: 'MIDDLE', queueId: 420, games: 1, wins: 1, kills: 1, deaths: 1, assists: 1, lp: 0, lpGames: 0, ...overrides })

describe('poolRoles', () => {
  it('folds the rows lane by lane, champions summed over queues, the most played first', () => {
    const roles = poolRoles([
      row({ championId: 1, games: 4, wins: 3, kills: 20, deaths: 8, assists: 12, lp: 40, lpGames: 3 }),
      row({ championId: 1, queueId: 440, games: 2, wins: 0, kills: 2, deaths: 6, assists: 4 }),
      row({ championId: 2, games: 1, wins: 1 }),
      row({ championId: 3, role: 'JUNGLE', games: 10, wins: 4 }),
    ])
    expect(roles.map(role => [role.role, role.games, role.wins, role.lp])).toEqual([['JUNGLE', 10, 4, null], ['MIDDLE', 7, 4, 40]])
    expect(roles[1]!.champions).toEqual([
      { championId: 1, games: 6, wins: 3, kills: 22, deaths: 14, assists: 16, lp: 40 },
      { championId: 2, games: 1, wins: 1, kills: 1, deaths: 1, assists: 1, lp: null },
    ])
  })

  it('keeps one queue filter\'s rows', () => {
    const rows = [row({ queueId: 420 }), row({ queueId: 440 }), row({ queueId: 450 }), row({ queueId: 480 })]
    expect(rowsIn(rows, 'solo').map(entry => entry.queueId)).toEqual([420])
    expect(rowsIn(rows, 'normal').map(entry => entry.queueId)).toEqual([480])
    expect(rowsIn(rows, 'all')).toHaveLength(4)
  })
})

describe('pool rows', () => {
  it('keeps Blitz\'s latest season only', () => {
    const base = { champion_id: 7, role: 'TOP', queue_id: 420, game_count: 2, wins: 1, kills: 3, deaths: 2, assists: 1, lp: 0, lp_games: 0 }
    const rows = blitzPoolRows([{ ...base, riot_season_id: 15 }, { ...base, riot_season_id: 16, champion_id: 8 }])
    expect(rows.map(entry => entry.championId)).toEqual([8])
  })

  it('reads op.gg\'s season champions as Solo/Duo rows without a lane', () => {
    const rows = opggPoolRows({ most_champions: { game_type: 'RANKED', champion_stats: [{ id: 136, play: 94, win: 59, lose: 35, kill: 747, death: 473, assist: 1048 }] } })
    expect(rows).toEqual([{ championId: 136, role: '', queueId: 420, games: 94, wins: 59, kills: 747, deaths: 473, assists: 1048, lp: 0, lpGames: 0 }])
  })
})

describe('teammatesOf', () => {
  const side = (win: boolean, ...names: string[]) => ({ win, allies: names.map(name => ({ gameName: name, tagLine: 'BR1' })) })

  it('lists the allies met at least twice, the most met then the most won with first, the player left out', () => {
    const mates = teammatesOf([
      side(true, 'Kami', 'Duo', 'Once'),
      side(false, 'Kami', 'Duo', 'Pair'),
      side(true, 'kami', 'DUO', 'Pair'),
      side(true, 'Pair'),
    ], { gameName: 'Kami', tagLine: 'BR1' })
    // Duo and Pair tie on games and wins: by name.
    expect(mates.map(mate => [mate.gameName, mate.games, mate.wins])).toEqual([['Duo', 3, 2], ['Pair', 3, 2]])
  })

  it('reads a game\'s allies from its scoreboard, remakes left out', () => {
    const p = (participantId: number, teamId: number, gameName: string) => ({
      participantId, championId: 1, teamId, position: null, gameName, tagLine: 'X', win: true,
      kills: 0, deaths: 0, assists: 0, cs: 0, goldEarned: 0, damageToChampions: 0, visionScore: 0, marks: [],
    })
    const participants = [p(3, 100, 'Me'), p(4, 100, 'Ally'), p(6, 200, 'Enemy')]
    const sides = sidesOfGames([game({ participants }), game({ gameId: 2, participants, remake: true })])
    expect(sides).toEqual([{ win: true, allies: [{ gameName: 'Ally', tagLine: 'X' }] }])
  })
})
