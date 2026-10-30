import { describe, expect, it } from 'vitest'
import { estimate, maxCalls, winRate } from '~/utils/high-elo'

describe('high-elo plan', () => {
  it('counts the most calls a plan can spend', () => {
    expect(maxCalls({ players: 300, gamesPerPlayer: 10 })).toBe(3300)
  })

  it('turns calls and the key\'s gap into a time', () => {
    expect(estimate(3300, 1400)).toEqual({ hours: 1, minutes: 17 })
    expect(estimate(10, 1400)).toEqual({ hours: 0, minutes: 1 })
  })

  it('reads a win rate, and none from no games', () => {
    expect(winRate({ games: 4, wins: 3 })).toBe(0.75)
    expect(winRate({ games: 0, wins: 0 })).toBe(0)
  })
})
