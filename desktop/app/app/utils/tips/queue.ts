import type { Tip, TipCategory } from './catalogue'
import { CATEGORY_COOLDOWNS } from './catalogue'

/** Seconds a tip stays on screen when nothing says otherwise (`TipQueue`'s default). */
export const SHOW_SECONDS = 6

/** What a tip's words take to read mid-game: a glance to find it, then a word every 0.45 s, kept between 4 and 9 s. */
const READ = { glance: 2, perWord: 0.45, min: 4, max: 9 } as const

/** Seconds a tip with this `text` stays on screen: a short line goes sooner, a long one is read to its end. */
export function readingSeconds(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.min(READ.max, Math.max(READ.min, READ.glance + words * READ.perWord))
}

/**
 * Seconds a tip is left alone once it came on screen, before a more urgent
 * one takes its place: long enough not to flicker, short enough that news
 * (the jungler seen, a countdown) is never late behind a tip that can wait.
 */
const MIN_SHOWN = 1

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
 * The tips waiting for the screen, which shows one at a time for as long as
 * `lasts` says (`SHOW_SECONDS` unless given): the highest priority first,
 * first come first within one, each dropped once its `ttl` ran out, and a
 * category kept quiet for its cooldown (`CATEGORY_COOLDOWNS`) after one of its
 * tips left the screen. A tip on screen gives way, after `MIN_SHOWN` seconds,
 * to a more urgent one ready to show; the one put aside is not shown again. The same
 * key is never queued twice. Time is passed in (wall-clock milliseconds), so
 * it is tested without a clock.
 */
export class TipQueue {
  private waiting: QueuedTip[] = []
  private shown: ShownTip | null = null
  private readyAt: Partial<Record<TipCategory, number>> = {}
  private count = 0
  private readonly lasts: (tip: Tip) => number

  constructor(lasts: (tip: Tip) => number = () => SHOW_SECONDS) {
    this.lasts = lasts
  }

  push(tip: Tip, now: number) {
    if (this.shown?.tip.key === tip.key || this.waiting.some(queued => queued.key === tip.key)) return
    this.waiting.push({ ...tip, id: ++this.count, expiresAt: now + tip.ttl * 1000 })
  }

  /** The tip on screen at `now`: the one showing until its time is up, then the next one due. */
  current(now: number): ShownTip | null {
    if (this.shown && now < this.shown.until && !this.crowdedOut(now)) return this.shown
    if (this.shown) {
      const { category } = this.shown.tip
      // The quiet starts when it left, which is before its time when it gave way.
      this.readyAt[category] = Math.min(this.shown.until, now) + CATEGORY_COOLDOWNS[category] * 1000
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
    this.shown = { tip: next, from: now, until: now + this.lasts(next) * 1000 }
    return this.shown
  }

  /** Whether a waiting tip of a higher priority is ready to show, once the one on screen has had `MIN_SHOWN`. */
  private crowdedOut(now: number) {
    const { shown } = this
    if (!shown || now < shown.from + MIN_SHOWN * 1000) return false
    return this.waiting.some(tip => tip.priority > shown.tip.priority && tip.expiresAt > now && (this.readyAt[tip.category] ?? 0) <= now)
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
