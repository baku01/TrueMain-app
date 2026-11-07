import { describe, expect, it } from 'vitest'
import type { TipKey } from '../app/utils/tips/catalogue'
import { CATEGORY_COOLDOWNS, makeTip } from '../app/utils/tips/catalogue'
import { SHOW_SECONDS, TipQueue } from '../app/utils/tips/queue'

const SHOW = SHOW_SECONDS * 1000

/** The keys on screen at each moment asked, in milliseconds. */
function screen(queue: TipQueue, moments: number[]) {
  return moments.map(now => queue.current(now)?.tip.key ?? null)
}

describe('TipQueue', () => {
  it('shows one tip at a time, each for SHOW_SECONDS', () => {
    const queue = new TipQueue()
    queue.push(makeTip('objective.dragon.60s'), 0)
    queue.push(makeTip('jungle.firstClear'), 0)
    expect(screen(queue, [0, SHOW - 1])).toEqual(['objective.dragon.60s', 'objective.dragon.60s'])
    expect(screen(queue, [SHOW])).toEqual(['jungle.firstClear'])
    expect(screen(queue, [2 * SHOW])).toEqual([null])
  })

  it('puts the higher priority first, and the first come first within one', () => {
    const queue = new TipQueue()
    queue.push(makeTip('farm.ok'), 0)
    queue.push(makeTip('ward.redLens'), 0)
    queue.push(makeTip('level.sixFirst'), 0)
    queue.push(makeTip('objective.baron.30s'), 0)
    // Baron (5), the level (3), then the farm and the trinket (2), in the order they came.
    expect(screen(queue, [0, SHOW, 2 * SHOW, 3 * SHOW])).toEqual(['objective.baron.30s', 'level.sixFirst', 'farm.ok', 'ward.redLens'])
  })

  it('drops a tip that waited past its ttl', () => {
    const queue = new TipQueue()
    queue.push(makeTip('objective.dragon.30s'), 0)
    // An objective's warning keeps 8 s: still due after the first tip's 6 and the category's 1 s
    // of quiet, gone after a second one's.
    queue.push(makeTip('objective.dragon.60s'), 0)
    queue.push(makeTip('objective.grubs.30s'), 0)
    expect(screen(queue, [0, SHOW + 1000, 2 * SHOW + 2000])).toEqual(['objective.dragon.30s', 'objective.grubs.30s', null])
    expect(queue.size).toBe(0)
  })

  it('keeps a category quiet for its cooldown once one of its tips left the screen', () => {
    expect([CATEGORY_COOLDOWNS.kill, CATEGORY_COOLDOWNS.ward, CATEGORY_COOLDOWNS.mental]).toEqual([1, 5, 5])
    const queue = new TipQueue()
    queue.push(makeTip('ward.redLens'), 0)
    queue.push(makeTip('ward.blueLens'), 0)
    queue.push(makeTip('farm.great'), 0)
    // The ward category waits 5 s after the red lens: the farm, of another one, goes first.
    expect(screen(queue, [0, SHOW])).toEqual(['ward.redLens', 'farm.great'])
    expect(screen(queue, [2 * SHOW])).toEqual(['ward.blueLens'])

    const kills = new TipQueue()
    kills.push(makeTip('kill.levelTwo'), 0)
    kills.push(makeTip('kill.shutdown'), 0)
    expect(screen(kills, [0, SHOW, SHOW + 999, SHOW + 1000])).toEqual(['kill.levelTwo', null, null, 'kill.shutdown'])
  })

  it('never queues a key twice, whether it waits or shows', () => {
    const queue = new TipQueue()
    const key: TipKey = 'map.minimap'
    queue.push(makeTip(key), 0)
    queue.push(makeTip(key), 0)
    expect(queue.size).toBe(1)
    queue.current(0)
    queue.push(makeTip(key), 100)
    expect(queue.size).toBe(0)
  })

  it('forgets everything on clear', () => {
    const queue = new TipQueue()
    queue.push(makeTip('gold.ahead'), 0)
    queue.current(0)
    queue.push(makeTip('gold.behind'), 0)
    queue.clear()
    expect(screen(queue, [1])).toEqual([null])
  })
})
