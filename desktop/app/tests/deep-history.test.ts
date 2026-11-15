import { describe, expect, it } from 'vitest'
import type { MatchAnswer, Participant, RiotTimeline } from '~/utils/blitz/player'
import type { HistoryBackend } from '~/utils/history-store'
import { marksByParticipant, withMarks } from '~/utils/blitz/marks'
import { gameOf } from '~/utils/blitz/profile'
import { gameIdOfMatch, idsToRead, mapLimit, mergeHistory, sourceCounts } from '~/utils/deep-history'
import { createHistoryStore, memoryBackend } from '~/utils/history-store'
import { gameValues } from '~/utils/nerd-stats/features'
import { syntheticHistory } from '~/fixtures/synthetic-history'
import { matchAnswerOf, timelineOf } from '~/fixtures/synthetic-blitz'
import { game, MINUTE } from './fixtures'

const frame = (timestamp: number, players: Record<number, [gold: number, xp: number, cs: number, jungle?: number]>) => ({
  timestamp,
  events: [],
  participantFrames: Object.fromEntries(Object.entries(players).map(([id, [gold, xp, cs, jungle]]) => [id, { totalGold: gold, xp, minionsKilled: cs, jungleMinionsKilled: jungle ?? 0 }])),
})

describe('marksByParticipant', () => {
  it('reads each mark from the frame nearest it, lane and jungle CS together', () => {
    const timeline: RiotTimeline = { info: { frames: [frame(0, { 1: [500, 0, 0] }), frame(300_020, { 1: [1800, 1500, 40, 2] }), frame(600_050, { 1: [3600, 3900, 80] })] } }
    expect(marksByParticipant(timeline).get(1)).toEqual([
      { minute: 5, gold: 1800, cs: 42, xp: 1500 },
      { minute: 10, gold: 3600, cs: 80, xp: 3900 },
    ])
  })

  it('leaves out a mark the game never reached, never zeroing it', () => {
    const timeline: RiotTimeline = { info: { frames: [frame(0, { 1: [500, 0, 0] }), frame(600_000, { 1: [3600, 3900, 80] }), frame(780_000, { 1: [4000, 4300, 95] })] } }
    expect(marksByParticipant(timeline).get(1)?.map(mark => mark.minute)).toEqual([10])
  })

  it('of two frames equally near, keeps the later; farther than half a minute, none', () => {
    const tie: RiotTimeline = { info: { frames: [frame(290_000, { 1: [1, 1, 1] }), frame(310_000, { 1: [2, 2, 2] })] } }
    expect(marksByParticipant(tie).get(1)?.[0]?.gold).toBe(2)
    const far: RiotTimeline = { info: { frames: [frame(260_000, { 1: [1, 1, 1] })] } }
    expect(marksByParticipant(far).size).toBe(0)
    expect(marksByParticipant(null).size).toBe(0)
  })
})

const participant = (id: number, overrides: Partial<Participant> = {}): Participant => ({
  puuid: `p${id}`,
  riotIdGameName: `Player${id}`,
  riotIdTagline: 'EUW',
  championId: 100 + id,
  teamId: id <= 5 ? 100 : 200,
  teamPosition: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'][(id - 1) % 5]!,
  participantId: id,
  win: id <= 5,
  kills: id,
  deaths: 2,
  assists: 3,
  summoner1Id: 4,
  summoner2Id: 14,
  item0: 3020, item1: 6655, item2: 0, item3: 0, item4: 0, item5: 0, item6: 3340,
  champLevel: 16,
  totalDamageDealtToChampions: 10_000 + id,
  visionScore: 20,
  goldEarned: 11_000,
  totalMinionsKilled: 180,
  neutralMinionsKilled: 12,
  damageSelfMitigated: 9000,
  damageDealtToTurrets: 2000,
  largestMultiKill: 2,
  doubleKills: 1,
  firstBloodAssist: id === 3,
  perks: { styles: [{ style: 8100, selections: [{ perk: 8112 }, { perk: 8143 }] }, { style: 8200, selections: [{ perk: 8226 }] }] },
  ...overrides,
})

const answer = (): MatchAnswer => ({
  metadata: { matchId: 'KR_8421752997' },
  info: {
    gameCreation: 1_763_000_000_000,
    gameDuration: 1830,
    gameVersion: '16.22.1',
    queueId: 420,
    mapId: 11,
    platformId: 'KR',
    participants: Array.from({ length: 10 }, (_, i) => participant(i + 1)),
    teams: [
      { teamId: 100, bans: [{ championId: 7, pickTurn: 2 }, { championId: 5, pickTurn: 1 }], objectives: { tower: { kills: 9 }, dragon: { kills: 3 }, baron: { kills: 1 }, riftHerald: { kills: 1 }, horde: { kills: 4 }, inhibitor: { kills: 2 } } },
      { teamId: 200, bans: [], objectives: { tower: { kills: 2 }, dragon: { kills: 1 }, baron: { kills: 0 }, riftHerald: { kills: 0 }, horde: { kills: 2 }, inhibitor: { kills: 0 } } },
    ],
  },
})

describe('a Blitz game in the client\'s shape', () => {
  it('fills the player\'s line, the team totals, the ten players and the sides', () => {
    const read = gameOf(answer(), 'p3')!
    expect(read).toMatchObject({
      gameId: 8421752997,
      participantId: 3,
      playedAt: 1_763_000_000_000,
      durationSeconds: 1830,
      queueId: 420,
      mapId: 11,
      championId: 103,
      championLevel: 16,
      teamId: 100,
      position: 'MIDDLE',
      win: true,
      remake: false,
      kills: 3,
      cs: 192,
      gold: 11_000,
      damageToChampions: 10_003,
      firstBlood: true,
      multiKills: { double: 1, triple: 0, quadra: 0, penta: 0 },
      items: [3020, 6655, 0, 0, 0, 0],
      trinket: 3340,
      spells: [4, 14],
      keystone: 8112,
      primaryStyle: 8100,
      subStyle: 8200,
      teamKills: 1 + 2 + 3 + 4 + 5,
    })
    expect(read.participants).toHaveLength(10)
    expect(read.teams?.[0]).toMatchObject({ bans: [5, 7], towers: 9, grubs: 4 })
    expect(gameOf(answer(), 'someone-else')).toBeNull()
  })

  it('takes the timeline\'s marks, so the lane leads read as from the client', () => {
    const frames = [5, 10, 15].map(minute => frame(minute * MINUTE + 300, Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, [minute * 400 + (i === 2 ? 300 : 0), minute * 380, minute * 7]] as const))))
    const read = withMarks(gameOf(answer(), 'p3')!, { info: { frames } })
    expect(read.participants.find(p => p.participantId === 3)?.marks.map(mark => mark.minute)).toEqual([5, 10, 15])
    const values = gameValues(read)
    expect(values.goldDiff10).toBe(300)
    expect(values.goldDiff15).toBe(300)
    expect(values.teamGoldDiff15).toBe(300)
    // Without a timeline, nothing is made up.
    expect(gameValues(withMarks(gameOf(answer(), 'p3')!, null)).goldDiff15).toBeUndefined()
  })

  it('reads a made-up history written into Riot\'s shape back figure for figure', () => {
    const template = [game({ gameId: 9_000_000_000, participants: [] })]
    for (const made of syntheticHistory(template, 12, 'roundtrip')) {
      // The made-up team total is drawn apart from its players' lines; Riot's is their sum, as Blitz's reads it.
      const original = { ...made, teamDamageToChampions: made.participants.filter(p => p.teamId === made.teamId).reduce((sum, p) => sum + p.damageToChampions, 0) }
      const self = original.participants.find(p => p.participantId === original.participantId)!
      const back = withMarks(gameOf(matchAnswerOf(original, 'EUW1', 'me'), 'me')!, timelineOf(original))
      expect(back.gameId).toBe(original.gameId)
      expect(back.participants.find(p => p.participantId === original.participantId)?.marks).toEqual(self.marks)
      expect(gameValues(back)).toEqual(gameValues(original))
    }
  })
})

describe('merging the history', () => {
  const a = game({ gameId: 3, playedAt: 3 * MINUTE * 60 })
  const b = game({ gameId: 2, playedAt: 2 * MINUTE * 60 })
  const c = game({ gameId: 1, playedAt: 1 * MINUTE * 60 })

  it('keeps one game per id, the first source holding it, newest first, at most the limit', () => {
    const fromBlitz = { ...b, kills: 99 }
    const merged = mergeHistory([['client', [b]], ['blitz', [fromBlitz, a]], ['saved', [c, a]]], 10)
    expect(merged.games.map(entry => entry.gameId)).toEqual([3, 2, 1])
    expect(merged.games[1]!.kills).toBe(b.kills)
    expect(sourceCounts(merged.sourceOf)).toEqual({ client: 1, blitz: 1, saved: 1 })
    expect(mergeHistory([['saved', [c, b, a]]], 2).games.map(entry => entry.gameId)).toEqual([3, 2])
  })

  it('reads the match id\'s game', () => {
    expect(gameIdOfMatch('KR_8421752997')).toBe(8421752997)
    expect(gameIdOfMatch('BR1_123')).toBe(123)
    expect(gameIdOfMatch('nonsense')).toBeNull()
  })

  it('reads only the ids not held nor failed, newest first; once full, only those newer than the oldest kept', () => {
    const ids = ['EUW1_1', 'EUW1_5', 'EUW1_3', 'EUW1_4', 'EUW1_2']
    expect(idsToRead(ids, [a], 10)).toEqual(['EUW1_5', 'EUW1_4', 'EUW1_2', 'EUW1_1'])
    expect(idsToRead(ids, [a], 10, new Set(['EUW1_4']))).toEqual(['EUW1_5', 'EUW1_2', 'EUW1_1'])
    expect(idsToRead(ids, [a, b], 2)).toEqual(['EUW1_5', 'EUW1_4'])
  })

  it('works through every item at most a few at once, in order', async () => {
    let busy = 0
    let most = 0
    const answers = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      most = Math.max(most, ++busy)
      await new Promise(resolve => setTimeout(resolve, 5 + (n % 3) * 3))
      busy--
      return n * 10
    })
    expect(answers).toEqual([10, 20, 30, 40, 50, 60, 70])
    expect(most).toBe(3)
  })
})

describe('the saved history', () => {
  const at = (gameId: number) => game({ gameId, playedAt: gameId * MINUTE })

  it('grows across sessions, one game per id, newest first, up to its limit', async () => {
    const store = createHistoryStore(memoryBackend(), 5)
    expect(await store.save('Me#EUW', [at(10), at(9), at(8)], 'puuid-1')).toBe(3)
    await store.save('Me#EUW', [at(12), at(11), { ...at(10), kills: 42 }])
    const loaded = await store.load('me#euw')
    expect(loaded.games.map(entry => entry.gameId)).toEqual([12, 11, 10, 9, 8])
    expect(loaded.games[2]!.kills).toBe(42)
    expect(loaded.puuid).toBe('puuid-1')
    await store.save('Me#EUW', [at(13)])
    expect((await store.load('Me#EUW')).games.map(entry => entry.gameId)).toEqual([13, 12, 11, 10, 9])
  })

  it('keeps each account apart, and drops what is not a game', async () => {
    const backend = memoryBackend()
    const store = createHistoryStore(backend)
    await store.save('One#EUW', [at(1)])
    expect((await store.load('Two#EUW')).games).toEqual([])
    await backend.put({ account: 'two#euw', puuid: null, savedAt: 0, games: [at(2), { gameId: 'x' } as never, null as never] })
    expect((await store.load('Two#EUW')).games.map(entry => entry.gameId)).toEqual([2])
  })

  it('never throws when the store cannot be read or written', async () => {
    const broken: HistoryBackend = { get: () => Promise.reject(new Error('blocked')), put: () => Promise.reject(new Error('full')) }
    const store = createHistoryStore(broken)
    expect(await store.load('Me#EUW')).toEqual({ games: [], puuid: null })
    expect(await store.save('Me#EUW', [at(1)])).toBe(0)
  })
})
