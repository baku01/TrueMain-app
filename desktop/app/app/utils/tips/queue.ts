import type { Tip, TipCategory } from './catalogue'
import { CATEGORY_COOLDOWNS } from './catalogue'

/** Seconds a tip stays on screen. */
export const SHOW_SECONDS = 6

export interface QueuedTip extends Tip {
  /** In arrival order: first come, first shown within a priority. */
  id: number
  /** Wall-clock milliseconds past which it is stale and dropped. */
  expiresAt: number
}

export interface ShownTip {
  tip: QueuedTip
  /** Wall-clock milliseconds it came on screen and leaves it. */
  from: number
  until: number
}

/**
 * The tips waiting for the screen, which shows one at a time for
 * `SHOW_SECONDS`: the highest priority first, first come first within one,
 * each dropped once its `ttl` ran out, and a category kept quiet for its
 * cooldown (`CATEGORY_COOLDOWNS`) after one of its tips left the screen.
 * The same key is never queued twice. Time is passed in (wall-clock
 * milliseconds), so it is tested without a clock.
 */
export class TipQueue {
  private waiting: QueuedTip[] = []
  private shown: ShownTip | null = null
  private readyAt: Partial<Record<TipCategory, number>> = {}
  private count = 0

  push(tip: Tip, now: number) {
    if (this.shown?.tip.key === tip.key || this.waiting.some(queued => queued.key === tip.key)) return
    this.waiting.push({ ...tip, id: ++this.count, expiresAt: now + tip.ttl * 1000 })
  }

  /** The tip on screen at `now`: the one showing until its time is up, then the next one due. */
  current(now: number): ShownTip | null {
    if (this.shown && now < this.shown.until) return this.shown
    if (this.shown) {
      const { category } = this.shown.tip
      this.readyAt[category] = this.shown.until + CATEGORY_COOLDOWNS[category] * 1000
      this.shown = null
    }
    this.waiting = this.waiting.filter(tip => tip.expiresAt > now)
    let next: QueuedTip | null = null
    for (const tip of this.waiting) {
      if ((this.readyAt[tip.category] ?? 0) > now) continue
      if (!next || tip.priority > next.priority) next = tip
    }
    if (!next) return null
    this.waiting = this.waiting.filter(tip => tip !== next)
    this.shown = { tip: next, from: now, until: now + SHOW_SECONDS * 1000 }
    return this.shown
  }

  /** How many wait, the one on screen apart. */
  get size() {
    return this.waiting.length
  }

  clear() {
    this.waiting = []
    this.shown = null
    this.readyAt = {}
  }
}
