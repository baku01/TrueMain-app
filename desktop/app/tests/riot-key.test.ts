import { describe, expect, it } from 'vitest'
import { keyKind, perMinute, sustainedPerMinute, windowLabel } from '~/utils/riot-key'

const personal = [{ seconds: 1, limit: 20, used: 3 }, { seconds: 120, limit: 100, used: 41 }]
const production = [{ seconds: 10, limit: 500, used: null }, { seconds: 600, limit: 30000, used: null }]

describe('rate limits', () => {
  it('puts every window on one scale, per minute', () => {
    expect(personal.map(perMinute)).toEqual([1200, 50])
    expect(production.map(perMinute)).toEqual([3000, 3000])
  })

  it('takes the slowest window as the sustained budget', () => {
    expect(sustainedPerMinute(personal)).toBe(50)
    expect(sustainedPerMinute([])).toBeNull()
  })

  it('reads a window\'s length as a person would', () => {
    expect([1, 120, 600, 3600].map(windowLabel)).toEqual(['1 s', '2 min', '10 min', '1 h'])
  })

  it('says what the numbers suggest about the key', () => {
    expect(keyKind(personal)).toBe('personal')
    expect(keyKind(production)).toBe('production')
    expect(keyKind([])).toBeNull()
  })
})
