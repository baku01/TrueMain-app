import type { EnemyLane } from '~/types/draft'
import { POSITIONS } from '#common/utils/positions'

/**
 * Where the enemies play, read from the source's lane shares — the client's
 * twin of the API's `LaneAssignmentSolver` (decisions, product-matchups):
 * every way of giving the enemies one lane each is enumerated (five lanes,
 * 120 placements at most), each scored by the product of its shares, and the
 * scores normalized into probabilities. The board draws the most probable
 * placement; the chance an enemy plays a lane is the summed probability of
 * every placement that puts it there — what the lane matchup is weighted by,
 * never the champion's raw share of that lane.
 */

/**
 * A share the source never saw still leaves a placement possible — a lane
 * nobody else can take must stay reachable — but a hundred times less likely
 * than a 10% one: an off-role enemy only lands on our lane when nothing else can.
 */
export const SHARE_FLOOR = 1e-3

/** Below this, two placements' scores are the same one, and the tie-breaks decide. */
const TIE = 1e-9

/** A champion's share of its games on a lane, 0–1. */
export type ShareOf = (championId: number, position: string) => number

/** Each enemy's chance of playing each lane. */
export type Occupancy = Map<number, Record<string, number>>

export interface LaneSolution {
  lanes: EnemyLane[]
  occupancy: Occupancy
}

/** Shares by pick rate, each champion's over its lanes, from the source's tier-list rows. */
export function sharesOf(rows: { championId: number, position: string, pickRate: number }[]): ShareOf {
  const totals = new Map<number, number>()
  const rates = new Map<string, number>()
  for (const row of rows) {
    totals.set(row.championId, (totals.get(row.championId) ?? 0) + row.pickRate)
    rates.set(`${row.championId}:${row.position}`, row.pickRate)
  }
  return (championId, position) => {
    const total = totals.get(championId) ?? 0
    return total > 0 ? (rates.get(`${championId}:${position}`) ?? 0) / total : 0
  }
}

/**
 * Every enemy on its own lane: pinned by the player, else the most probable
 * placement of the lanes left. One lane each, as in the game — two enemies the
 * source both sees mid cannot share it, or the board, which draws one enemy per
 * lane, would lose one of them. Equally probable placements keep the one on
 * screen (`previous`), then the first enumerated, so the same draft always
 * reads the same way: a board that reshuffles under the timer is worse than one
 * slightly wrong.
 */
export function solveEnemyLanes(enemies: number[], pinned: Record<string, string>, share: ShareOf, previous: Record<string, string> = {}): LaneSolution {
  const placed = new Map<number, EnemyLane>()
  const occupancy: Occupancy = new Map()
  for (const championId of enemies) {
    const position = pinned[championId]
    if (position && ![...placed.values()].some(lane => lane.position === position)) {
      placed.set(championId, { championId, position, confidence: 1, pinned: true })
      occupancy.set(championId, { [position]: 1 })
    }
  }
  const free = enemies.filter(championId => !placed.has(championId))
  const open = POSITIONS.filter(position => ![...placed.values()].some(lane => lane.position === position))

  const placements: { lanes: string[], score: number, kept: number }[] = []
  const walk = (index: number, taken: string[], score: number) => {
    if (index === free.length || taken.length === open.length) {
      placements.push({ lanes: taken, score, kept: taken.filter((lane, at) => previous[free[at]!] === lane).length })
      return
    }
    for (const position of open) {
      if (!taken.includes(position)) walk(index + 1, [...taken, position], score + Math.log(Math.max(share(free[index]!, position), SHARE_FLOOR)))
    }
  }
  walk(0, [], 0)

  const top = Math.max(...placements.map(placement => placement.score))
  const weights = placements.map(placement => Math.exp(placement.score - top))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  free.forEach(championId => occupancy.set(championId, {}))
  placements.forEach((placement, at) => placement.lanes.forEach((lane, index) => {
    const odds = occupancy.get(free[index]!)!
    odds[lane] = (odds[lane] ?? 0) + weights[at]! / total
  }))

  let best = placements[0]
  for (const placement of placements) {
    if (placement.score > best!.score + TIE || (placement.score > best!.score - TIE && placement.kept > best!.kept)) best = placement
  }
  free.forEach((championId, index) => {
    const position = best?.lanes[index] ?? 'MIDDLE'
    placed.set(championId, { championId, position, confidence: occupancy.get(championId)?.[position] ?? 0, pinned: false })
  })
  return { lanes: enemies.map(championId => placed.get(championId)!), occupancy }
}

/**
 * Our lane opponent: the enemy most likely on our lane, and that chance — the
 * lane matchup's weight. Only an enemy the source sees on our lane at all (or
 * the player pinned there) can be it: a support forced onto the last lane open
 * is not a lane matchup to read. Equal chances keep the one on screen.
 */
export function laneOpponent(solution: LaneSolution, position: string, share: ShareOf, previous: Record<string, string> = {}): { championId: number, confidence: number } | null {
  let best: { championId: number, confidence: number } | null = null
  for (const lane of solution.lanes) {
    const confidence = solution.occupancy.get(lane.championId)?.[position] ?? 0
    const eligible = lane.pinned ? lane.position === position : share(lane.championId, position) > SHARE_FLOOR
    if (!eligible || !(confidence > 0)) continue
    const kept = previous[lane.championId] === position
    if (!best || confidence > best.confidence + TIE || (confidence > best.confidence - TIE && kept)) best = { championId: lane.championId, confidence }
  }
  return best
}
