import { describe, expect, it } from 'vitest'
import type { GameParticipant } from '~/types/record'
import { matchBadges } from '~/utils/match-badges'
import { game } from './fixtures'

function player(participantId: number, teamId: number, damageToChampions: number, goldEarned: number): GameParticipant {
  return {
    participantId, championId: participantId, teamId, position: null, gameName: null, tagLine: null, win: teamId === 100,
    kills: 0, deaths: 0, assists: 0, cs: 0, goldEarned, damageToChampions, visionScore: 0, marks: [],
  }
}

const kinds = (...args: Parameters<typeof game>) => matchBadges(game(...args)).map(b => b.kind)

describe('matchBadges', () => {
  it('tags an ordinary game with nothing', () => {
    expect(kinds()).toEqual([])
  })

  it('ranks damage and gold over the whole scoreboard', () => {
    const participants = [player(3, 100, 20_000, 12_000), player(1, 100, 9_000, 9_000), player(7, 200, 15_000, 11_000)]
    expect(matchBadges(game({ participants }))).toEqual([
      { kind: 'topDamage', value: 667 },
      { kind: 'topGold', value: 12_000 },
    ])
  })

  it('falls back to the team carry when an enemy dealt more', () => {
    const participants = [player(3, 100, 20_000, 1), player(1, 100, 9_000, 1), player(7, 200, 30_000, 20_000)]
    expect(kinds({ participants })).toEqual(['teamDamage'])
  })

  it('grades farm, deaths, vision and multi-kills from the player line', () => {
    expect(matchBadges(game({ visionScore: 76 }))).toEqual([{ kind: 'allSeeing', value: 76, target: 75 }])
    expect(kinds({ cs: 255, deaths: 0, visionScore: 76, largestMultiKill: 5 }))
      .toEqual(['pentaKill', 'unkillable', 'csMaster', 'allSeeing'])
    expect(kinds({ cs: 300, visionScore: 60 })).toEqual(['csGod', 'goodEye'])
  })

  it('tags a remake with nothing', () => {
    expect(kinds({ remake: true, deaths: 0, cs: 400 })).toEqual([])
  })
})
