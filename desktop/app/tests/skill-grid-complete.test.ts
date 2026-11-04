import { describe, expect, it } from 'vitest'
import { completeSkillGrid } from '~/utils/skill-grid'
import type { SkillKey } from '~/utils/skill-grid'

describe('completeSkillGrid', () => {
  it('completes a fifteen-level order to 18: the ultimate at 16, then the skill not yet maxed', () => {
    // Yasuo's measured fifteen: Q maxed, E maxed, W at three, R at two.
    const fifteen = 'QEWQQRQEQEREEWW'.split('') as SkillKey[]
    const grid = completeSkillGrid(Object.fromEntries(fifteen.map((key, index) => [index + 1, key])), ['Q', 'E', 'W'])
    expect([16, 17, 18].map(level => grid[level])).toEqual(['R', 'W', 'W'])
    expect(Object.keys(grid)).toHaveLength(18)
  })

  it('reads the priority from the measured levels when none is given', () => {
    const grid = completeSkillGrid({ 1: 'Q', 2: 'W', 3: 'E', 4: 'Q', 5: 'Q', 6: 'R' })
    expect(grid[7]).toBe('Q')
    expect(grid[11]).toBe('R')
    expect(grid[16]).toBe('R')
  })
})
