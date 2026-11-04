import { describe, expect, it } from 'vitest'
import { prioritiesOf, skillOpenings } from '~/utils/sources/model'

describe('skill sequences', () => {
  it('labels sequences by the levels where they part', () => {
    expect(skillOpenings([{ points: [1, 2, 3, 1, 1] }, { points: [1, 2, 3, 2, 1] }])).toEqual([['Q', 'W', 'E', 'Q'], ['Q', 'W', 'E', 'W']])
    expect(skillOpenings([{ points: [2, 1, 3] }, { points: [1, 2, 3] }])).toEqual([['W', 'Q', 'E'], ['Q', 'W', 'E']])
  })

  it('adds sequences up by max order when the source measures no priority', () => {
    const skills = [
      { points: [], order: ['Q', 'W', 'E'], opening: [], games: 100, pickRate: 0.4, winRate: 0.6 },
      { points: [], order: ['Q', 'W', 'E'], opening: [], games: 100, pickRate: 0.2, winRate: 0.5 },
      { points: [], order: ['Q', 'E', 'W'], opening: [], games: 50, pickRate: 0.1, winRate: 0.5 },
    ]
    const [first, second] = prioritiesOf({ skills })
    expect(first!.order).toEqual(['Q', 'W', 'E'])
    expect(first!.games).toBe(200)
    expect(first!.winRate).toBeCloseTo(0.55)
    expect(first!.pickRate).toBeCloseTo(0.6)
    expect(second!.order).toEqual(['Q', 'E', 'W'])
  })

  it('takes the source\'s own priorities first', () => {
    const own = [{ order: ['Q', 'W', 'E'], games: 1000, pickRate: 0.9, winRate: 0.53 }]
    expect(prioritiesOf({ skills: [], priorities: own })).toBe(own)
  })
})
