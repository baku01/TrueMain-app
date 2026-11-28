import type { JevCoverage, JevFailure } from '~/utils/jev-ask'

/**
 * Jev's answers as the draft moves under them — its calls are paid, so an
 * answer is never thrown away by a move that does not change what was asked:
 *
 * - each answer is kept by its subject (`id`: whose build or pick it is, as
 *   `championId:position`), so peeking at another champion's build and coming
 *   back finds ours again;
 * - with the board it was asked on (`key`: only what Jev read), so a later
 *   board shows it `stale` — asked before the draft moved on — until the player
 *   asks again, instead of dropping it;
 * - one ask at a time per subject: a second click while the first is out pays
 *   nothing (`start`).
 */

export type JevAnswerStatus = 'idle' | 'loading' | 'ready' | 'noKey' | 'noOptions' | 'noCandidates' | 'nothing' | 'error'

/** How an ask ended: its status, its answer where it has one, and what failed or only partly came back. */
export interface Outcome<T> {
  status: JevAnswerStatus
  answer?: T | null
  failure?: JevFailure | null
  /** Set where only part of the questions came back: the answer stands on what did. */
  partial?: JevCoverage | null
}

/** What the page shows for a subject on the current board. */
export interface Shown<T> {
  status: JevAnswerStatus
  answer: T | null
  failure: JevFailure | null
  partial: JevCoverage | null
  /** Asked on another board than this one: kept until the player asks again. */
  stale: boolean
}

export const IDLE: Shown<never> = { status: 'idle', answer: null, failure: null, partial: null, stale: false }

export function answerMemory<T>() {
  const outcomes = new Map<string, Outcome<T> & { key: string }>()
  const asking = new Set<string>()

  return {
    /** Starts the subject's ask; false while one is already out for it. */
    start(id: string): boolean {
      if (asking.has(id)) return false
      asking.add(id)
      return true
    },
    /** Ends the subject's ask, its outcome kept for the board it was asked on. */
    settle(id: string, key: string, outcome: Outcome<T>) {
      asking.delete(id)
      outcomes.set(id, { ...outcome, key })
    },
    shown(id: string, key: string): Shown<T> {
      if (asking.has(id)) return { ...IDLE, status: 'loading' }
      const outcome = outcomes.get(id)
      if (!outcome) return IDLE
      return { status: outcome.status, answer: outcome.answer ?? null, failure: outcome.failure ?? null, partial: outcome.partial ?? null, stale: outcome.key !== key }
    },
  }
}
