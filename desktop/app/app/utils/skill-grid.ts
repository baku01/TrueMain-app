/**
 * A level-by-level skill order, derived from the max priority.
 *
 * TrueMain's aggregate carries only which of Q/W/E is maxed first, second and
 * third (`BuildSkillOrder.sequence`), not what was learned at each level — that
 * is in the match timeline, which the app does not read. So the grid is the
 * order players follow when they go by that priority: the first three levels
 * take the three basic skills in priority order, the ultimate comes at 6, 11
 * and 16, and the rest max the first, then the second, then the third. It is
 * what the priority implies, not a measurement; the page says so.
 */
export type SkillKey = 'Q' | 'W' | 'E' | 'R'

export const SKILL_ROWS: SkillKey[] = ['Q', 'W', 'E', 'R']
export const ULTIMATE_LEVELS = [6, 11, 16]

/** The skill learned at each level 1–18, or null when the priority is not three distinct basic skills. */
export function skillGrid(priority: string[]): Record<number, SkillKey> | null {
  const keys = priority.map(key => key.toUpperCase())
  const [first, second, third] = keys
  if (keys.length !== 3 || new Set(keys).size !== 3 || !keys.every(key => ['Q', 'W', 'E'].includes(key))) return null
  const order: Record<number, SkillKey> = {}
  for (const level of ULTIMATE_LEVELS) order[level] = 'R'
  const plan: [string, number[]][] = [
    [first!, [1, 4, 5, 7, 9]],
    [second!, [2, 8, 10, 12, 13]],
    [third!, [3, 14, 15, 17, 18]],
  ]
  for (const [key, levels] of plan) for (const level of levels) order[level] = key as SkillKey
  return order
}
