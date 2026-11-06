import { describe, expect, it } from 'vitest'
import type { PlayerGame } from '~/types/record'
import type { CardSource } from '~/utils/sources/draft-player'
import { blitzHistory, cardOrder, clientHistory, firstRead, queuedWith } from '~/utils/sources/draft-player'

describe('the player card\'s sources', () => {
  it('ask the picked source first, then Blitz, then the others that carry the part', () => {
    expect(cardOrder('rank', 'blitz', false)).toEqual(['blitz', 'opgg'])
    expect(cardOrder('rank', 'opgg', false)).toEqual(['opgg', 'blitz'])
    // lolalytics and Tencent read no player: Blitz first.
    expect(cardOrder('history', 'lolalytics', false)).toEqual(['blitz', 'opgg'])
    expect(cardOrder('history', 'tencent', true)).toEqual(['blitz', 'opgg', 'client'])
  })

  it('read the player\'s own client first on TrueMain, and TrueMain only while it is the source', () => {
    expect(cardOrder('rank', 'truemain', true)).toEqual(['client', 'truemain', 'blitz', 'opgg'])
    expect(cardOrder('rank', 'truemain', false)).toEqual(['truemain', 'blitz', 'opgg'])
    expect(cardOrder('rank', 'blitz', true)).not.toContain('truemain')
  })

  it('never ask op.gg for mastery, which it does not carry', () => {
    expect(cardOrder('mastery', 'opgg', false)).toEqual(['blitz'])
    expect(cardOrder('mastery', 'blitz', true)).toEqual(['blitz', 'client'])
  })

  it('pass a failed or empty answer to the next source', async () => {
    const asked: CardSource[] = []
    const answers: Record<string, () => Promise<unknown>> = {
      opgg: () => Promise.reject(new Error('down')),
      blitz: () => Promise.resolve(null),
      client: () => Promise.resolve({ games: 0, wins: 0, positions: [], champions: [], mates: [] }),
      truemain: () => Promise.resolve({ tier: 'GOLD', division: 'II', leaguePoints: 10, wins: 1, losses: 1 }),
    }
    const read = await firstRead(['opgg', 'blitz', 'client', 'truemain'], (source) => {
      asked.push(source)
      return answers[source]!() as Promise<unknown>
    })
    expect(asked).toEqual(['opgg', 'blitz', 'client', 'truemain'])
    expect(read?.source).toBe('truemain')
  })

  it('stop at the first that answers, and answer nothing when none does', async () => {
    const asked: CardSource[] = []
    const read = await firstRead(['blitz', 'opgg'], (source) => {
      asked.push(source)
      return Promise.resolve({ tier: 'EMERALD', division: 'I', leaguePoints: 0, wins: 0, losses: 0 })
    })
    expect(asked).toEqual(['blitz'])
    expect(read?.source).toBe('blitz')
    expect(await firstRead(['blitz'], () => null)).toBeNull()
  })
})

const game = (championId: number, position: string, win: boolean, mates: string[]): PlayerGame => ({
  gameId: Math.random(),
  participantId: 1,
  playedAt: 0,
  teamId: 100,
  championId,
  position,
  win,
  remake: false,
  participants: [
    { participantId: 1, teamId: 100, gameName: 'Me', tagLine: 'EUW' },
    ...mates.map((riotId, index) => ({ participantId: index + 2, teamId: 100, gameName: riotId.split('#')[0], tagLine: riotId.split('#')[1] })),
    { participantId: 9, teamId: 200, gameName: 'Enemy', tagLine: 'EUW' },
  ],
} as unknown as PlayerGame)

describe('a player\'s latest games', () => {
  it('count the client\'s roles, champions and the teammates met twice or more', () => {
    const history = clientHistory([game(103, 'MIDDLE', true, ['Duo#EUW']), game(103, 'MIDDLE', false, ['Duo#EUW']), game(7, 'TOP', true, [])])
    expect(history.games).toBe(3)
    expect(history.wins).toBe(2)
    expect(history.positions).toEqual([{ position: 'MIDDLE', games: 2 }, { position: 'TOP', games: 1 }])
    expect(history.champions[0]).toEqual({ championId: 103, games: 2 })
    expect(history.mates).toEqual([{ riotId: 'Duo#EUW', games: 2 }])
  })

  it('read Blitz\'s playstyles in TrueMain\'s lanes, games without a lane left out', () => {
    const history = blitzHistory({ roles: { '': 3, 'MID': 5, 'SUPPORT': 12 }, champion_counts: { 103: 4, 12: 9 }, recently_played_with: [{ game_name: 'Duo', tag_line: 'EUW', games: 3 }], wins: 11, total_games: 20 })
    expect(history.positions).toEqual([{ position: 'UTILITY', games: 12 }, { position: 'MIDDLE', games: 5 }])
    expect(history.champions[0]).toEqual({ championId: 12, games: 9 })
    expect(history.mates).toEqual([{ riotId: 'Duo#EUW', games: 3 }])
  })

  it('name the lobby\'s teammates the player queued with', () => {
    const history = blitzHistory({ recently_played_with: [{ game_name: 'Duo', tag_line: 'EUW', games: 3 }, { game_name: 'Once', tag_line: 'EUW', games: 1 }] })
    expect(queuedWith(history, ['duo#euw', 'Once#EUW', 'Other#EUW'])).toEqual(['duo#euw'])
    expect(queuedWith(null, ['Duo#EUW'])).toEqual([])
  })
})
