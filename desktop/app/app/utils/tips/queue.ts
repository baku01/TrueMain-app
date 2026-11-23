import type { Tip, TipKey } from './catalogue'
import { CATEGORY_COOLDOWNS, FILLER_PRIORITY, URGENT_PRIORITY } from './catalogue'

/** Seconds a tip stays on screen when nothing says otherwise (`TipQueue`'s default). */
export const SHOW_SECONDS = 5

/** What a tip's words take to read mid-game: a glance to find it, then a word every 0.35 s, kept between 3.5 and 6.5 s. */
const READ = { glance: 1.5, perWord: 0.35, min: 3.5, max: 6.5 } as const

/** Maximum tips kept waiting at once so bursts never spill stale lines seconds later. */
const MAX_WAITING = 3

/** Seconds a tip with this `text` stays on screen: a short line goes sooner, a long one is read to its end. */
export function readingSeconds(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.min(READ.max, Math.max(READ.min, READ.glance + words * READ.perWord))
}

/**
 * Seconds a tip is left alone once it came on screen, before an urgent one
 * takes its place: long enough to be read in a glance, never a flicker.
 */
const MIN_SHOWN = 2

/**
 * Seconds a tip keeps the screen at least once others are waiting for it:
 * its words without the glance to find it, floored at 3 s so bursts stay snappy.
 */
const busyShown = (seconds: number) => Math.max(3, seconds - READ.glance)

/**
 * A tip's place in line: its priority, a tip said now or not at all
 * (`immediate`) ahead of the others of its priority and of any lower — never
 * of an urgent countdown's.
 */
const rank = (tip: Tip) => (tip.immediate ? Math.min(tip.priority + 0.5, URGENT_PRIORITY - 0.25) : tip.priority)

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
 * `lasts` says (`SHOW_SECONDS` unless given) — less the glance to find it
 * once others wait (`busyShown`) —: the highest priority first, first come first within one,
 * each dropped once its `ttl` ran out, and the same line kept quiet for its
 * category's cooldown (`CATEGORY_COOLDOWNS`) once it left the screen — another
 * line of the same kind is other news, and goes on. A tip on screen gives
 * way to a more urgent one ready to show: at once when it is only a filler;
 * after `MIN_SHOWN` seconds when the newcomer is a countdown about to run out
 * (`URGENT_PRIORITY`), is said now or not at all (`immediate`: our health,
 * which waited a whole tip's reading before and came too late) or would go
 * stale waiting. The one put aside waits again
 * for its turn while it is fresh, a filler apart. The same key is never
 * queued twice. Time is passed in (wall-clock milliseconds), so it is tested
 * without a clock.
 */
export class TipQueue {
  private waiting: QueuedTip[] = []
  private shown: ShownTip | null = null
  private readyAt: Partial<Record<TipKey, number>> = {}
  private count = 0
  private readonly lasts: (tip: Tip) => number

  constructor(lasts: (tip: Tip) => number = () => SHOW_SECONDS) {
    this.lasts = lasts
  }

  push(tip: Tip, now: number) {
    if (this.shown?.tip.key === tip.key || this.waiting.some(queued => queued.key === tip.key)) return
    this.waiting.push({ ...tip, id: ++this.count, expiresAt: now + tip.ttl * 1000 })
    if (this.waiting.length > MAX_WAITING) {
      // Drop the lowest-priority (and oldest within that priority) tip so bursts never lag behind the game.
      let drop = 0
      for (let i = 1; i < this.waiting.length; i++) {
        const a = this.waiting[i]!
        const b = this.waiting[drop]!
        if (rank(a) < rank(b) || (rank(a) === rank(b) && a.id < b.id)) drop = i
      }
      this.waiting.splice(drop, 1)
    }
  }

  /** The tip on screen at `now`: the one showing until its time is up, then the next one due. */
  current(now: number): ShownTip | null {
    this.waiting = this.waiting.filter(tip => tip.expiresAt > now)
    if (this.shown && now < this.leavesAt(now) && !this.crowdedOut(now)) return this.shown
    if (this.shown) {
      // Once a tip has been shown — even if crowded out by a more urgent one — never replay it out of order later.
      const { tip } = this.shown
      this.readyAt[tip.key] = now + CATEGORY_COOLDOWNS[tip.category] * 1000
      this.shown = null
    }
    let next: QueuedTip | null = null
    for (const tip of this.waiting) {
      if (!this.ready(tip, now)) continue
      if (!next || rank(tip) > rank(next) || (rank(tip) === rank(next) && tip.id < next.id)) next = tip
    }
    if (!next) return null
    this.waiting = this.waiting.filter(tip => tip !== next)
    this.shown = { tip: next, from: now, until: now + this.lasts(next) * 1000 }
    return this.shown
  }

  private ready(tip: QueuedTip, now: number) {
    return (this.readyAt[tip.key] ?? 0) <= now
  }

  /** When the tip on screen leaves: its own time, or sooner (`busyShown`) once another — not a filler — is ready to show. */
  private leavesAt(now: number) {
    const shown = this.shown!
    const busy = this.waiting.some(tip => tip.priority > FILLER_PRIORITY && this.ready(tip, now))
    return busy ? Math.min(shown.until, shown.from + busyShown((shown.until - shown.from) / 1000) * 1000) : shown.until
  }

  /**
   * Whether a waiting tip of a higher priority, ready to show, takes the
   * screen now: from a filler at once; from another tip once it has had
   * `MIN_SHOWN`, when the newcomer is an urgent countdown or would go stale
   * waiting for it to leave.
   */
  private crowdedOut(now: number) {
    const { shown } = this
    if (!shown) return false
    const filler = shown.tip.priority <= FILLER_PRIORITY
    if (!filler && now < shown.from + MIN_SHOWN * 1000) return false
    const leaves = this.leavesAt(now)
    return this.waiting.some(tip =>
      rank(tip) > rank(shown.tip) && this.ready(tip, now)
      && (filler || tip.priority >= URGENT_PRIORITY || tip.immediate || tip.expiresAt <= leaves),
    )
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
