import { describe, expect, it } from 'vitest'
import type { GameParticipant } from '~/types/record'
import { matchBadges } from '~/utils/match-badges'
import { game } from './fixtures'

function player(participantId: number, teamId: number, line: Partial<GameParticipant> = {}): GameParticipant {
  return {
    participantId, championId: participantId, teamId, position: null, gameName: null, tagLine: null, win: teamId === 100,
    kills: 1, deaths: 1, assists: 0, cs: 0, goldEarned: 1, damageToChampions: 1, visionScore: 0, marks: [], ...line,
  }
}

const kinds = (...args: Parameters<typeof matchBadges>) => matchBadges(...args).map(b => b.kind)

describe('matchBadges', () => {
  it('tags an ordinary game with nothing', () => {
    expect(kinds(game())).toEqual([])
  })

  it('ranks gold, damage, mitigation and tower damage over the ten, first or second', () => {
    const participants = [
      player(3, 100, { goldEarned: 12_000, damageToChampions: 20_000, damageSelfMitigated: 9_000, damageToTurrets: 3_000 }),
      player(1, 100, { goldEarned: 13_000, damageToChampions: 9_000, damageSelfMitigated: 30_000, damageToTurrets: 100 }),
      player(7, 200, { goldEarned: 11_000, damageToChampions: 25_000, damageSelfMitigated: 1_000, damageToTurrets: 10 }),
    ]
    expect(matchBadges(game({ participants }))).toEqual([
      { kind: 'cashMoney', value: 12_000 },
      { kind: 'goodDamage', value: 667 },
      { kind: 'wreckingBall', value: 3_000 },
      { kind: 'beefy', value: 300 },
    ])
  })

  it('reads the score, multi-kills, farm, deaths, vision and first blood, heaviest first', () => {
    const score = { performanceScore: 80, placement: 1, isMvp: true, isAce: false }
    expect(kinds(game({ cs: 255, deaths: 0, visionScore: 76, largestMultiKill: 5, multiKills: { double: 2, triple: 1, quadra: 1, penta: 1 }, firstBlood: true }), score))
      .toEqual(['mvp', 'pentaKill', 'allSeeing', 'unkillable', 'firstBlood', 'csLegend'])
    expect(matchBadges(game({ visionScore: 66 }))).toEqual([{ kind: 'goodEye', value: 66, target: 60 }])
  })

  it('names a support by its assists and KDA', () => {
    expect(matchBadges(game({ kills: 1, deaths: 2, assists: 14 }))).toEqual([{ kind: 'trueSupport', value: 14, target: 7.5 }])
  })

  it('crowns a perfect game: nothing given to the enemy, something taken', () => {
    const participants = [player(3, 100, { kills: 9, deaths: 0 }), player(7, 200, { kills: 0, deaths: 9 })]
    const team = (teamId: number, towers: number) => ({ teamId, bans: [], towers, inhibitors: 0, dragons: 0, barons: 0, heralds: 0, grubs: null })
    expect(kinds(game({ participants, teams: [team(100, 9), team(200, 0)] }))).toContain('perfectGame')
    expect(kinds(game({ participants, teams: [team(100, 9), team(200, 1)] }))).not.toContain('perfectGame')
  })

  it('tags a remake or a short game with nothing', () => {
    expect(kinds(game({ remake: true, deaths: 0 }))).toEqual([])
    expect(kinds(game({ durationSeconds: 800, deaths: 0 }))).toEqual([])
  })
})
