import type { JevAnswer, JevQuestion } from '~/utils/jev'
import type { Request } from '~/utils/jev-read'
import { describe, expect, it, vi } from 'vitest'
import { RATE_LIMIT_BACKOFF_MS, askBatches, failureOf, keyFailure, mergeAsked, outcomeOf } from '~/utils/jev-ask'

vi.mock('~/utils/jev', () => ({ askJev: vi.fn() }))

const score: JevAnswer = { type: 'score', score: 2, confidence: 1, probabilities: {} }
const question: JevQuestion = { type: 'score', instructions: 'q', criteria: ['a', 'b', 'c'] }
const part = (...names: string[]): Request => ({ state: { part: names.join() }, questions: Object.fromEntries(names.map(name => [name, question])) })
/** Jev as a fake: every question answered, but the batches holding `failing` refused with `error`. */
const jev = (failing: string[] = [], error: unknown = 'Jev answered 500 Internal Server Error: boom') =>
  vi.fn(async (_state: unknown, questions: Record<string, JevQuestion>) => {
    if (Object.keys(questions).some(name => failing.includes(name))) throw error
    return Object.fromEntries(Object.keys(questions).map(name => [name, score]))
  })
const wait = vi.fn(async () => {})

describe('failureOf', () => {
  it('tells a missing key, a refused one, too many requests and another status apart, from the shell\'s message or the fetch error', () => {
    expect(failureOf('no Jev API key is set')).toMatchObject({ kind: 'noKey' })
    expect(failureOf('Jev answered 401 Unauthorized: bad key')).toMatchObject({ kind: 'badKey', status: 401 })
    expect(failureOf(Object.assign(new Error('Forbidden'), { statusCode: 403 }))).toMatchObject({ kind: 'badKey', status: 403 })
    expect(failureOf('Jev answered 429 Too Many Requests: slow down')).toMatchObject({ kind: 'rateLimited', status: 429 })
    expect(failureOf('Jev answered 502 Bad Gateway: ')).toMatchObject({ kind: 'http', status: 502 })
    expect(failureOf('Jev unreachable: error sending request')).toMatchObject({ kind: 'unreachable', status: null })
    expect(failureOf(new Error('our champion is not known yet'))).toMatchObject({ kind: 'other' })
  })

  it('offers no retry for a key to fix', () => {
    expect(keyFailure(failureOf('no Jev API key is set'))).toBe(true)
    expect(keyFailure(failureOf('Jev answered 401 Unauthorized: '))).toBe(true)
    expect(keyFailure(failureOf('Jev answered 500 Internal Server Error: '))).toBe(false)
    expect(keyFailure(null)).toBe(false)
  })
})

describe('askBatches', () => {
  it('keeps what came back when a batch fails, and tells how much did', async () => {
    const asked = await askBatches([part('a', 'b'), part('c')], { ask: jev(['c']), wait })
    expect(Object.keys(asked.answers)).toEqual(['a', 'b'])
    expect(asked.coverage).toEqual({ asked: 3, answered: 2 })
    expect(asked.failure).toMatchObject({ kind: 'http', status: 500 })
    expect(outcomeOf(asked)).toMatchObject({ partial: { asked: 3, answered: 2 } })
  })

  it('asks again only the batches that failed, the others served by the memo', async () => {
    const memo = new Map<string, Record<string, JevAnswer>>()
    const parts = [part('a'), part('b')]
    await askBatches(parts, { ask: jev(['b']), wait, memo })
    const again = jev()
    const asked = await askBatches(parts, { ask: again, wait, memo })
    expect(again).toHaveBeenCalledTimes(1)
    expect(Object.keys(again.mock.calls[0]![1])).toEqual(['b'])
    expect(asked.coverage).toEqual({ asked: 2, answered: 2 })
    expect(outcomeOf(asked)).toEqual({ failure: null, partial: null })
  })

  it('waits once on too many requests before asking again, and fails if Jev still refuses', async () => {
    let calls = 0
    const once = vi.fn(async () => {
      if (calls++ === 0) throw 'Jev answered 429 Too Many Requests: slow down'
      return { a: score }
    })
    const pause = vi.fn(async () => {})
    expect((await askBatches([part('a')], { ask: once, wait: pause })).coverage.answered).toBe(1)
    expect(pause).toHaveBeenCalledWith(RATE_LIMIT_BACKOFF_MS)

    const always = jev(['a'], 'Jev answered 429 Too Many Requests: slow down')
    const asked = await askBatches([part('a')], { ask: always, wait: pause })
    expect(always).toHaveBeenCalledTimes(2)
    expect(outcomeOf(asked)).toMatchObject({ failure: { kind: 'rateLimited' }, partial: null })
  })

  it('does not wait on any other failure', async () => {
    const pause = vi.fn(async () => {})
    const refused = jev(['a'], 'Jev answered 401 Unauthorized: ')
    const asked = await askBatches([part('a')], { ask: refused, wait: pause })
    expect(refused).toHaveBeenCalledTimes(1)
    expect(pause).not.toHaveBeenCalled()
    expect(outcomeOf(asked).failure).toMatchObject({ kind: 'badKey' })
  })

  it('counts nothing to ask as a whole answer, and merges several asks', async () => {
    const none = await askBatches([], { ask: jev(), wait })
    expect(outcomeOf(none)).toEqual({ failure: null, partial: null })
    const merged = mergeAsked(none, await askBatches([part('a')], { ask: jev(['a']), wait }), await askBatches([part('b')], { ask: jev(), wait }))
    expect(merged.coverage).toEqual({ asked: 2, answered: 1 })
    expect(Object.keys(merged.answers)).toEqual(['b'])
    expect(merged.failure).toMatchObject({ kind: 'http' })
  })
})
