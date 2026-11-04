import { describe, expect, it } from 'vitest'
import { enemyLanes } from '~/utils/sources/draft'

const row = (championId: number, position: string, pickRate: number) => ({ championId, position, games: 1000, winRate: 0.5, pickRate, banRate: null })

describe('enemyLanes from a source', () => {
  it('gives two enemies the source both sees mid a lane each', () => {
    const rows = [row(1, 'MIDDLE', 0.9), row(1, 'TOP', 0.1), row(2, 'MIDDLE', 0.6), row(2, 'BOTTOM', 0.4)]
    const lanes = enemyLanes([1, 2], {}, rows)
    expect(lanes.map(lane => lane.position)).toEqual(['MIDDLE', 'BOTTOM'])
  })

  it('keeps five enemies on five different lanes, unknown champions included', () => {
    const rows = [1, 2, 3].map(id => row(id, 'MIDDLE', 1))
    const positions = enemyLanes([1, 2, 3, 4, 5], {}, rows).map(lane => lane.position)
    expect(new Set(positions).size).toBe(5)
  })

  it('places a pinned enemy first and splits the others around it', () => {
    const rows = [row(1, 'MIDDLE', 1), row(2, 'MIDDLE', 0.7), row(2, 'TOP', 0.3)]
    const lanes = enemyLanes([1, 2], { 2: 'MIDDLE' }, rows)
    expect(lanes).toEqual([
      { championId: 1, position: expect.not.stringMatching('MIDDLE'), confidence: 0, pinned: false },
      { championId: 2, position: 'MIDDLE', confidence: 1, pinned: true },
    ])
  })
})
