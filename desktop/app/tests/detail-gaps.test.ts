import { describe, expect, it } from 'vitest'
import type { MatchDetailParticipant, MatchDetailResponse } from '#shared/types/match-detail'
import { fillGaps } from '~/composables/useSiteShims'
import { winTimelineOf } from '~/utils/blitz/match-detail'

const player = (participantId: number, fields: Partial<MatchDetailParticipant> = {}) =>
  ({ participantId, teamId: participantId <= 5 ? 100 : 200, teamPosition: 'TOP', runes: [{ styleId: 8100, selectionIndex: 0, perkId: 8112 }], rank: null, ...fields }) as MatchDetailParticipant

const detail = (fields: Partial<MatchDetailResponse>): MatchDetailResponse =>
  ({ matchId: '1', queueId: 420, gameMode: 'CLASSIC', gameStartTimeUtc: '', gameDurationSeconds: 1800, gameVersion: '', participants: [player(1), player(6)], ...fields })

describe('fillGaps', () => {
  it('takes what the source lacks from the other copy and keeps what it has', () => {
    const team = { teamId: 100, bans: [238], towers: 9, inhibitors: 1, dragons: 2, barons: 1, heralds: 0, grubs: 3 }
    const rune = { styleId: 8100, selectionIndex: 0, perkId: 8112, vars: [1200, 0, 0] }
    const truemain = detail({ participants: [player(1, { rank: { tier: 'GOLD', division: 'II', leaguePoints: 40 } }), player(6)] })
    const blitz = detail({ teams: [team], participants: [player(1, { runes: [rune] }), player(6, { rank: { tier: 'SILVER', division: 'I', leaguePoints: 3 } })] })

    const filled = fillGaps(truemain, blitz)
    expect(filled.teams).toEqual([team])
    expect(filled.participants[0]!.runes).toEqual([rune])
    expect(filled.participants[0]!.rank?.tier).toBe('GOLD')
    expect(filled.participants[1]!.rank?.tier).toBe('SILVER')
  })
})

describe('winTimelineOf', () => {
  it('reads Riot\'s timeline into the frames and the kills and objectives the tabs draw', () => {
    const timeline = winTimelineOf({
      info: {
        frames: [
          { timestamp: 0, events: [], participantFrames: { 1: { totalGold: 500, xp: 0, level: 1, minionsKilled: 0, jungleMinionsKilled: 0 } } },
          { timestamp: 60_000, events: [
            { type: 'CHAMPION_KILL', timestamp: 55_000, killerId: 1, victimId: 6, assistingParticipantIds: [2] },
            { type: 'ITEM_PURCHASED', timestamp: 56_000, participantId: 1, itemId: 1055 },
            { type: 'ELITE_MONSTER_KILL', timestamp: 58_000, killerTeamId: 100, monsterType: 'DRAGON', monsterSubType: 'FIRE_DRAGON' },
          ], participantFrames: { 1: { totalGold: 900, xp: 300, level: 2, minionsKilled: 6, jungleMinionsKilled: 1 } } },
        ],
      },
    }, [player(1), player(6)], 1800)

    expect(timeline?.durationMs).toBe(1_800_000)
    expect(timeline?.frames[1]?.players[0]).toEqual({ participantId: 1, cs: 7, level: 2, gold: 900, xp: 300 })
    expect(timeline?.events.map(event => event.type)).toEqual(['CHAMPION_KILL', 'ELITE_MONSTER_KILL'])
    expect(timeline?.events[0]?.assistIds).toEqual([2])
  })

  it('has nothing to say without frames', () => {
    expect(winTimelineOf({}, [], 1800)).toBeNull()
  })
})
