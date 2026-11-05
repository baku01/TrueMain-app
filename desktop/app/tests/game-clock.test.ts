import { describe, expect, it } from 'vitest'
import { clockAt } from '~/composables/useGameClock'

/** The game clock between two readings (`useGameClock`). */
describe('the game clock', () => {
  it('runs on from the last reading on the page\'s own clock', () => {
    expect(clockAt({ gameTime: 600, at: 10_000 }, 11_500)).toBeCloseTo(601.5)
  })

  it('waits for the next reading rather than run ahead of a game that stands still', () => {
    expect(clockAt({ gameTime: 600, at: 10_000 }, 70_000)).toBe(603)
  })

  it('never runs back before its reading', () => {
    expect(clockAt({ gameTime: 600, at: 10_000 }, 9_000)).toBe(600)
  })
})
