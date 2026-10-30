import { describe, expect, it } from 'vitest'
import { skillGrid } from '~/utils/skill-grid'

describe('skillGrid', () => {
  it('learns the three skills in priority order, then maxes them first to last', () => {
    const grid = skillGrid(['Q', 'E', 'W'])!
    const levelsOf = (key: string) => Object.entries(grid).filter(([, k]) => k === key).map(([level]) => Number(level))
    expect(levelsOf('Q')).toEqual([1, 4, 5, 7, 9])
    expect(levelsOf('E')).toEqual([2, 8, 10, 12, 13])
    expect(levelsOf('W')).toEqual([3, 14, 15, 17, 18])
    expect(levelsOf('R')).toEqual([6, 11, 16])
  })

  it('gives every level one skill', () => {
    expect(Object.keys(skillGrid(['W', 'Q', 'E'])!)).toHaveLength(18)
  })

  it('gives nothing for a priority that is not three distinct basic skills', () => {
    expect(skillGrid(['Q', 'W'])).toBeNull()
    expect(skillGrid(['Q', 'Q', 'E'])).toBeNull()
    expect(skillGrid(['Q', 'W', 'R'])).toBeNull()
    expect(skillGrid([])).toBeNull()
  })
})
