import type { JevAnswer, JevState, JevQuestion } from '~/utils/jev'
import type { Request } from '~/utils/jev-read'
import { askJev } from '~/utils/jev'

/**
 * Jev's batches asked so that one failing does not lose the others: each is
 * asked on its own, what came back is kept whatever the rest did, and the
 * failure is told by kind — a missing or refused key is the player's to fix in
 * Settings, not a call to retry.
 */

export type JevFailureKind = 'noKey' | 'badKey' | 'rateLimited' | 'http' | 'unreachable' | 'other'

export interface JevFailure {
  kind: JevFailureKind
  /** The HTTP status Jev answered, where it answered one. */
  status: number | null
  message: string
}

/** How many of the questions asked came back: what the page tells when only part of them did. */
export interface JevCoverage { asked: number, answered: number }

export interface Asked {
  answers: Record<string, JevAnswer>
  /** Questions asked and questions back, those a memo (`askBatches`) served counted as back. */
  coverage: JevCoverage
  /** The first batch's failure, where one failed. */
  failure: JevFailure | null
}

/** The pause before a batch Jev refused for too many requests (429) is asked once more. */
export const RATE_LIMIT_BACKOFF_MS = 2000

/** The HTTP status of a failed call: the dev proxy's fetch error carries it, the shell's message spells it (`jev.rs`). */
function statusOf(error: unknown, message: string): number | null {
  const own = (error as { statusCode?: unknown, status?: unknown } | null)
  const status = typeof own === 'object' && own ? own.statusCode ?? own.status : undefined
  if (typeof status === 'number') return status
  const spelled = /Jev answered (\d{3})/.exec(message)
  return spelled ? Number(spelled[1]) : null
}

export function failureOf(error: unknown): JevFailure {
  const message = error instanceof Error ? error.message : String(error)
  const status = statusOf(error, message)
  if (/no Jev API key/i.test(message)) return { kind: 'noKey', status, message }
  if (status === 401 || status === 403) return { kind: 'badKey', status, message }
  if (status === 429) return { kind: 'rateLimited', status, message }
  if (status !== null) return { kind: 'http', status, message }
  if (/unreachable|timed? ?out|network|fetch/i.test(message)) return { kind: 'unreachable', status, message }
  return { kind: 'other', status, message }
}

/** A missing or refused key: asking again pays nothing and changes nothing until the key does. */
export const keyFailure = (failure: JevFailure | null) => failure?.kind === 'noKey' || failure?.kind === 'badKey'

type Ask = (state: JevState, questions: Record<string, JevQuestion>) => Promise<Record<string, JevAnswer>>

export interface AskOptions {
  ask?: Ask
  wait?: (ms: number) => Promise<void>
  /**
   * The batches that came back of an ask that did not wholly answer, by their
   * content: the next ask takes them from here, and pays only for those that
   * failed. Its owner clears it once an ask answers in full.
   */
  memo?: Map<string, Record<string, JevAnswer>>
}

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/** One batch, asked once more after a pause when Jev says too many requests. */
async function askOne(part: Request, ask: Ask, wait: (ms: number) => Promise<void>) {
  try {
    return await ask(part.state, part.questions)
  }
  catch (error) {
    if (failureOf(error).kind !== 'rateLimited') throw error
    await wait(RATE_LIMIT_BACKOFF_MS)
    return await ask(part.state, part.questions)
  }
}

/** Every batch asked at once, each settled on its own (`Promise.allSettled`): the answers that came back, merged, and how many did. */
export async function askBatches(parts: Request[], options: AskOptions = {}): Promise<Asked> {
  const { ask = askJev, wait = pause, memo } = options
  const settled = await Promise.allSettled(parts.map(async (part) => {
    const key = memo ? JSON.stringify(part) : ''
    const known = memo?.get(key)
    if (known) return known
    const answers = await askOne(part, ask, wait)
    memo?.set(key, answers)
    return answers
  }))
  const answers: Record<string, JevAnswer> = {}
  const coverage: JevCoverage = { asked: 0, answered: 0 }
  let failure: JevFailure | null = null
  settled.forEach((result, index) => {
    const count = Object.keys(parts[index]!.questions).length
    coverage.asked += count
    if (result.status === 'fulfilled') {
      Object.assign(answers, result.value)
      coverage.answered += count
    }
    else failure ??= failureOf(result.reason)
  })
  return { answers, coverage, failure }
}

/** Several asks as one: their answers merged, their questions counted together, the first failure told. */
export const mergeAsked = (...all: Asked[]): Asked => ({
  answers: Object.assign({}, ...all.map(one => one.answers)),
  coverage: all.reduce((sum, one) => ({ asked: sum.asked + one.coverage.asked, answered: sum.answered + one.coverage.answered }), { asked: 0, answered: 0 }),
  failure: all.find(one => one.failure)?.failure ?? null,
})

/**
 * What an ask leaves: its first failure, and — where only part of the
 * questions came back — that coverage, the answer standing on the rest.
 * A failure without a coverage is total: nothing came back of what was asked.
 */
export function outcomeOf(asked: Asked): { failure: JevFailure | null, partial: JevCoverage | null } {
  const { coverage, failure } = asked
  if (coverage.asked && !coverage.answered) return { failure: failure ?? failureOf('Jev did not answer'), partial: null }
  return { failure, partial: coverage.answered < coverage.asked ? coverage : null }
}
