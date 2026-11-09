import { describe, expect, it } from 'vitest'
import type { TipKey } from '../app/utils/tips/catalogue'
import { CATEGORY_COOLDOWNS, makeTip } from '../app/utils/tips/catalogue'
import { SHOW_SECONDS, TipQueue, readingSeconds } from '../app/utils/tips/queue'

const SHOW = SHOW_SECONDS * 1000
/** A tip's time on screen while another waits. */
const BUSY = 4000

/** The keys on screen at each moment asked, in milliseconds. */
function screen(queue: TipQueue, moments: number[]) {
  return moments.map(now => queue.current(now)?.tip.key ?? null)
}

describe('TipQueue', () => {
  it('shows one tip at a time: for SHOW_SECONDS alone, four seconds while another waits', () => {
    const queue = new TipQueue()
    queue.push(makeTip('objective.dragon.60s'), 0)
    queue.push(makeTip('jungle.firstClear'), 0)
    expect(screen(queue, [0, BUSY - 1])).toEqual(['objective.dragon.60s', 'objective.dragon.60s'])
    expect(screen(queue, [BUSY, BUSY + SHOW - 1])).toEqual(['jungle.firstClear', 'jungle.firstClear'])
    expect(screen(queue, [BUSY + SHOW])).toEqual([null])
  })

  it('puts the higher priority first, and the first come first within one', () => {
    const queue = new TipQueue()
    queue.push(makeTip('farm.ok'), 0)
    queue.push(makeTip('ward.redLens'), 0)
    queue.push(makeTip('level.sixFirst'), 0)
    queue.push(makeTip('objective.baron.30s'), 0)
    // Baron (5), the level (3), then the farm and the trinket (2), in the order they came.
    expect(screen(queue, [0, BUSY, 2 * BUSY, 3 * BUSY])).toEqual(['objective.baron.30s', 'level.sixFirst', 'farm.ok', 'ward.redLens'])
  })

  it('drops a tip that waited past its ttl', () => {
    const queue = new TipQueue()
    queue.push(makeTip('objective.dragon.30s'), 0)
    // An objective's warning keeps 8 s: still due after the first tip's 4, gone after a second one's.
    queue.push(makeTip('objective.dragon.60s'), 0)
    queue.push(makeTip('objective.grubs.30s'), 0)
    expect(screen(queue, [0, BUSY, 3 * BUSY])).toEqual(['objective.dragon.30s', 'objective.grubs.30s', null])
    expect(queue.size).toBe(0)
  })

  it('keeps the same line quiet for its category\'s cooldown once it left the screen, never another line of the kind', () => {
    expect([CATEGORY_COOLDOWNS.kill, CATEGORY_COOLDOWNS.ward, CATEGORY_COOLDOWNS.mental]).toEqual([1, 5, 5])
    const kills = new TipQueue()
    kills.push(makeTip('kill.levelTwo'), 0)
    kills.push(makeTip('kill.shutdown'), 0)
    // Two kills of news: one after the other, no quiet between.
    expect(screen(kills, [0, BUSY])).toEqual(['kill.levelTwo', 'kill.shutdown'])
    const again = new TipQueue()
    again.push(makeTip('ward.redLens'), 0)
    expect(screen(again, [0, SHOW])).toEqual(['ward.redLens', null])
    again.push(makeTip('ward.redLens'), SHOW + 1000)
    // The same line waits out the ward's 5 s.
    expect(screen(again, [SHOW + 4999, SHOW + 5000])).toEqual([null, 'ward.redLens'])
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

  it('keeps a short line up for a short while and a long one to its end, within bounds', () => {
    expect(readingSeconds('Glance at the minimap.')).toBe(4)
    expect(readingSeconds('Drake in 30 seconds, get vision on the pit.')).toBeCloseTo(2 + 9 * 0.45)
    expect(readingSeconds(Array.from({ length: 40 }, () => 'word').join(' '))).toBe(9)
    expect(readingSeconds('')).toBe(4)
  })

  it('holds each tip for the time its queue was told, and a category\'s quiet runs from there', () => {
    const queue = new TipQueue(tip => (tip.key === 'gold.ahead' ? 4 : 8))
    queue.push(makeTip('gold.ahead'), 0)
    queue.push(makeTip('map.minimap'), 0)
    expect(screen(queue, [0, 3999])).toEqual(['gold.ahead', 'gold.ahead'])
    expect(screen(queue, [4000])).toEqual(['map.minimap'])
    expect(screen(queue, [11999])).toEqual(['map.minimap'])
    expect(screen(queue, [12000])).toEqual([null])
  })

  it('lets a filler give way at once to any other tip, and never shows it again', () => {
    const queue = new TipQueue(() => 9)
    queue.push(makeTip('map.minimap'), 0)
    expect(screen(queue, [0])).toEqual(['map.minimap'])
    queue.push(makeTip('jungle.spotted'), 200)
    expect(screen(queue, [200])).toEqual(['jungle.spotted'])
    expect(screen(queue, [10_000, 20_000])).toEqual([null, null])
  })

  it('lets a tip give way after 2 s to a more urgent one that would go stale waiting, then shows it again', () => {
    const queue = new TipQueue(() => 9)
    queue.push(makeTip('farm.ok'), 0)
    expect(screen(queue, [0])).toEqual(['farm.ok'])
    // The warning keeps 8 s; the farm would stay until 9 s.
    queue.push(makeTip('objective.baron.30s'), 1000)
    expect(screen(queue, [1999])).toEqual(['farm.ok'])
    expect(screen(queue, [2000])).toEqual(['objective.baron.30s'])
    // The farm, put aside while fresh, comes back once the warning is done.
    expect(screen(queue, [11_000])).toEqual(['farm.ok'])
  })

  it('does not give way to a tip that can wait, or of the same priority or a lower one', () => {
    const queue = new TipQueue(() => 9)
    queue.push(makeTip('objective.baron.60s'), 0)
    queue.current(0)
    queue.push(makeTip('jungle.gankWindow'), 0)
    queue.push(makeTip('farm.ok'), 0)
    // A 9 s tip with others waiting keeps its words' 7 s, the glance to find it apart.
    expect(screen(queue, [6999])).toEqual(['objective.baron.60s'])
    expect(screen(queue, [7000])).toEqual(['jungle.gankWindow'])
    // More urgent, but neither a countdown nor stale by the time the farm leaves: it waits.
    const calm = new TipQueue(() => 3)
    calm.push(makeTip('farm.ok'), 0)
    calm.current(0)
    calm.push(makeTip('jungle.spotted'), 0)
    expect(screen(calm, [2999])).toEqual(['farm.ok'])
    expect(screen(calm, [3000])).toEqual(['jungle.spotted'])
  })
})
