import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeagueSnapshot } from '~/utils/league-history'
import type { PoolRow } from '~/utils/champion-pool'
import type { PlayedWith, PlayedWithContext } from '~/utils/sources/played-with'
import { apiGet } from '~/composables/useApi'
import { blitzGet } from '~/utils/blitz/client'
import { RANK_HISTORY_CARRIERS, rankHistoryOrder, readLeagueHistory } from '~/utils/sources/rank-history'
import { championPoolOrder, readChampionPool } from '~/utils/sources/champion-pool'
import { PLAYED_WITH_CARRIERS, playedWithOrder, readPlayedWith } from '~/utils/sources/played-with'
import { game } from './fixtures'

/**
 * The profile's season readers — LP history, champion pool, played with —
 * each asking the source picked when it carries the data, then the next that
 * does, then (LP history, played with) what the app holds itself.
 */

vi.mock('~/composables/useApi', () => ({ apiGet: vi.fn() }))
vi.mock('~/utils/blitz/client', () => ({ blitzGet: vi.fn() }))
vi.mock('~/utils/sources/opgg-profile', () => ({ readOpggProfile: vi.fn(async () => null), opggRegion: (region: string) => region.toUpperCase() }))
vi.mock('~/utils/sources/opgg', () => ({
  callOpgg: vi.fn(),
  asList: (value: unknown) => (Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : []),
  num: (value: unknown) => (typeof value === 'number' ? value : 0),
}))

const player = { riotId: 'Kami#BR1', region: 'br' }
const snap = (leaguePoints: number): LeagueSnapshot => ({ capturedAtUtc: '2026-11-01T00:00:00.000Z', tier: 'MASTER', division: 'I', leaguePoints })
/** A history: two snapshots, the least a curve is drawn from. */
const curve = (leaguePoints: number) => [snap(leaguePoints), snap(leaguePoints + 20)]
const SOLO = 'RANKED_SOLO_5x5'
const FLEX = 'RANKED_FLEX_SR'

beforeEach(() => vi.mocked(apiGet).mockReset())

describe('LP history', () => {
  it('asks the pick first when it carries the queue, then Blitz, then op.gg — TrueMain only as the pick', () => {
    expect(rankHistoryOrder('truemain', SOLO)).toEqual(['truemain', 'blitz', 'opgg'])
    expect(rankHistoryOrder('opgg', SOLO)).toEqual(['opgg', 'blitz'])
    expect(rankHistoryOrder('blitz', SOLO)).toEqual(['blitz', 'opgg'])
    expect(rankHistoryOrder('lolalytics', SOLO)).toEqual(['blitz', 'opgg'])
    expect(rankHistoryOrder('tencent', SOLO)).toEqual(['blitz', 'opgg'])
    // Flex: Blitz alone keeps it.
    expect(rankHistoryOrder('truemain', FLEX)).toEqual(['blitz'])
    expect(rankHistoryOrder('opgg', FLEX)).toEqual(['blitz'])
  })

  it('hands over to the next source when one fails or has nothing, and names the one that answered', async () => {
    const carriers = {
      truemain: { queues: [SOLO] as const, read: vi.fn(async () => { throw new Error('404') }) },
      blitz: { queues: [SOLO, FLEX] as const, read: vi.fn(async () => []) },
      opgg: { queues: [SOLO] as const, read: vi.fn(async () => curve(10)) },
    }
    expect(await readLeagueHistory(player, SOLO, { picked: 'truemain', carriers })).toEqual({ source: 'opgg', entries: curve(10) })
    expect(carriers.truemain.read).toHaveBeenCalled()
    expect(carriers.blitz.read).toHaveBeenCalled()
  })

  it('keeps this machine\'s snapshots as the last resort, for Solo/Duo only', async () => {
    const carriers = { blitz: { queues: [SOLO, FLEX] as const, read: async () => [] } }
    expect(await readLeagueHistory(player, SOLO, { picked: 'blitz', carriers, local: curve(5) })).toEqual({ source: 'local', entries: curve(5) })
    expect(await readLeagueHistory(player, FLEX, { picked: 'blitz', carriers, local: curve(5) })).toBeNull()
  })

  it('takes a lone snapshot for a standing, not a history: the next source is asked, and it is drawn only when nothing holds more', async () => {
    const lone = { truemain: { queues: [SOLO] as const, read: async () => [snap(1)] }, blitz: { queues: [SOLO] as const, read: async () => curve(2) } }
    expect((await readLeagueHistory(player, SOLO, { picked: 'truemain', carriers: lone }))?.source).toBe('blitz')
    const thin = { truemain: { queues: [SOLO] as const, read: async () => [snap(1)] }, blitz: { queues: [SOLO] as const, read: async () => [] } }
    expect(await readLeagueHistory(player, SOLO, { picked: 'truemain', carriers: thin })).toEqual({ source: 'truemain', entries: [snap(1)] })
    expect((await readLeagueHistory(player, SOLO, { picked: 'truemain', carriers: thin, local: curve(3) }))?.source).toBe('local')
  })

  it('stops at the pick when it answers', async () => {
    const blitz = vi.fn(async () => curve(1))
    const carriers = { opgg: { queues: [SOLO] as const, read: async () => curve(2) }, blitz: { queues: [SOLO] as const, read: blitz } }
    expect((await readLeagueHistory(player, SOLO, { picked: 'opgg', carriers }))?.source).toBe('opgg')
    expect(blitz).not.toHaveBeenCalled()
  })

  it('reads Blitz\'s queue from its account answer, and TrueMain\'s from the player\'s page', async () => {
    vi.mocked(blitzGet).mockResolvedValueOnce({ league_lol: { RANKED_FLEX_SR: [{ tier: 'EMERALD', rank: 'II', league_points: 7, wins: 5, losses: 3, timestamp: 1749080507 }] } })
    expect(await RANK_HISTORY_CARRIERS.blitz!.read(player, FLEX)).toMatchObject([{ tier: 'EMERALD', division: 'II', leaguePoints: 7 }])
    expect(vi.mocked(blitzGet).mock.calls[0]).toEqual(['lol', 'riot_account_v2/lol/BR1/Kami/BR1'])

    vi.mocked(apiGet).mockResolvedValueOnce({ entries: [snap(3)] })
    expect(await RANK_HISTORY_CARRIERS.truemain!.read({ riotId: 'never type#1998', region: 'na' }, SOLO)).toEqual([snap(3)])
    expect(vi.mocked(apiGet).mock.calls[0]![0]).toBe('/truemains/never%20type-1998/rank-history')
  })
})

describe('champion pool', () => {
  const rows = (queueId: number): PoolRow[] => [{ championId: 1, role: 'MIDDLE', queueId, games: 3, wins: 2, kills: 9, deaths: 3, assists: 6, lp: 0, lpGames: 0 }]

  it('asks the pick first when it carries the queue, then Blitz, then op.gg (Solo/Duo only) — never TrueMain', () => {
    expect(championPoolOrder('truemain', 'all')).toEqual(['blitz'])
    expect(championPoolOrder('truemain', 'solo')).toEqual(['blitz', 'opgg'])
    expect(championPoolOrder('opgg', 'solo')).toEqual(['opgg', 'blitz'])
    expect(championPoolOrder('opgg', 'flex')).toEqual(['blitz'])
    expect(championPoolOrder('lolalytics', 'aram')).toEqual(['blitz'])
  })

  it('hands over when the source has no games in the queue shown', async () => {
    const carriers = {
      blitz: { filters: ['all', 'solo', 'flex', 'normal', 'aram'] as const, read: async () => rows(440) },
      opgg: { filters: ['solo'] as const, read: async () => rows(420) },
    }
    expect((await readChampionPool(player, 'solo', { picked: 'blitz', carriers }))?.source).toBe('opgg')
    expect((await readChampionPool(player, 'flex', { picked: 'opgg', carriers }))?.source).toBe('blitz')
    expect(await readChampionPool(player, 'aram', { picked: 'blitz', carriers })).toBeNull()
  })

  it('survives a source that fails', async () => {
    const carriers = {
      opgg: { filters: ['solo'] as const, read: async () => { throw new Error('down') } },
      blitz: { filters: ['solo'] as const, read: async () => rows(420) },
    }
    expect((await readChampionPool(player, 'solo', { picked: 'opgg', carriers }))?.source).toBe('blitz')
  })
})

describe('played with', () => {
  const ally = (participantId: number, gameName: string) => ({
    participantId, championId: 1, teamId: 100, position: null, gameName, tagLine: 'BR1', win: true,
    kills: 0, deaths: 0, assists: 0, cs: 0, goldEarned: 0, damageToChampions: 0, visionScore: 0, marks: [],
  })
  const games = [1, 2, 3].map(gameId => game({ gameId, participantId: 3, participants: [ally(3, 'Kami'), ally(4, 'Duo')] }))
  const context = (own: boolean): PlayedWithContext => ({ own, games, gamesSource: own ? 'client' : 'blitz' })
  const answer = (source: PlayedWith['source'], count: number): PlayedWith => ({ source, games: count, teammates: [] })

  it('asks the pick first when it carries the list, then Blitz', () => {
    expect(playedWithOrder('truemain')).toEqual(['truemain', 'blitz'])
    expect(playedWithOrder('blitz')).toEqual(['blitz'])
    expect(playedWithOrder('opgg')).toEqual(['blitz'])
  })

  it('reads the player\'s own games from the client when TrueMain is the pick', async () => {
    const result = await PLAYED_WITH_CARRIERS.truemain!(player, context(true))
    expect(result).toMatchObject({ source: 'client', games: 3, teammates: [{ gameName: 'Duo', games: 3, wins: 3 }] })
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('falls back from a source that fails or read nothing to the games on screen', async () => {
    const carriers = { truemain: async () => { throw new Error('404') }, blitz: async () => answer('blitz', 0) }
    expect(await readPlayedWith(player, context(false), { picked: 'truemain', carriers })).toMatchObject({ source: 'blitz', games: 3, teammates: [{ gameName: 'Duo' }] })
  })

  it('takes a source\'s empty list as its answer once it read games', async () => {
    const blitz = vi.fn(async () => answer('blitz', 20))
    const carriers = { blitz }
    expect(await readPlayedWith(player, context(false), { picked: 'opgg', carriers })).toEqual(answer('blitz', 20))
  })

  it('is null with no source and no games', async () => {
    expect(await readPlayedWith(player, { own: false, games: [], gamesSource: 'blitz' }, { picked: 'opgg', carriers: { blitz: async () => null } })).toBeNull()
  })
})
