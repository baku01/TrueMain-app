import type { PickSubject } from '~/composables/useJevPick'
import type { JevQuestion } from '~/utils/jev'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { answerMemory } from '~/utils/jev-answers'
import { judgeable, pickBoardKey } from '~/utils/jev-read-pick'

const jevMock = vi.hoisted(() => ({
  askJev: vi.fn(async (_state: unknown, questions: Record<string, JevQuestion>) =>
    Object.fromEntries(Object.keys(questions).map(name => [name, { type: 'score', score: 2, confidence: 1, probabilities: {} }]))),
  jevKeyStatus: vi.fn(async () => ({ set: true, hint: '1234' })),
}))
vi.mock('~/utils/jev', () => jevMock)

beforeEach(async () => {
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('shallowRef', shallowRef)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('useJevAnswer', (await import('~/composables/useJevAnswer')).useJevAnswer)
  vi.stubGlobal('useChampionStatics', () => ({ patch: ref('16.22') }))
  vi.stubGlobal('useChampionTexts', () => ({ textOf: (id: number) => ({ id, name: `C${id}`, classes: [], kit: [] }), loadAll: async () => {} }))
  vi.stubGlobal('useJevEnemies', () => ({
    load: async () => {},
    read: async () => ({ answers: {}, coverage: { asked: 0, answered: 0 }, failure: null }),
    assess: () => ({ team: {}, lane: {}, readings: [], dues: [] }),
  }))
  jevMock.askJev.mockClear()
  jevMock.jevKeyStatus.mockClear()
})
afterEach(() => vi.unstubAllGlobals())

describe('answerMemory', () => {
  it('marks an answer stale on another board instead of dropping it, and keeps each subject\'s own', () => {
    const memory = answerMemory<string>()
    expect(memory.start('103:MIDDLE')).toBe(true)
    // A second click while the first ask is out pays nothing.
    expect(memory.start('103:MIDDLE')).toBe(false)
    expect(memory.shown('103:MIDDLE', 'board-1').status).toBe('loading')
    memory.settle('103:MIDDLE', 'board-1', { status: 'ready', answer: 'ahri build' })
    expect(memory.shown('103:MIDDLE', 'board-1')).toMatchObject({ status: 'ready', answer: 'ahri build', stale: false })
    expect(memory.shown('103:MIDDLE', 'board-2')).toMatchObject({ status: 'ready', answer: 'ahri build', stale: true })
    // Another champion has nothing of its own; ours is still there.
    expect(memory.shown('61:MIDDLE', 'board-2')).toMatchObject({ status: 'idle', answer: null })
    expect(memory.shown('103:MIDDLE', 'board-1').answer).toBe('ahri build')
  })
})

describe('useJevAnswer', () => {
  it('restores the answer of the subject that comes back, stale if the board moved, and asks once per double click', async () => {
    const { useJevAnswer } = await import('~/composables/useJevAnswer')
    const subject = ref({ id: '103:MIDDLE', key: 'a' })
    const jev = useJevAnswer<string>(() => subject.value)
    let release = () => {}
    const work = vi.fn(() => new Promise<{ status: 'ready', answer: string }>((resolve) => {
      release = () => resolve({ status: 'ready', answer: 'ours' })
    }))
    const first = jev.run(work)
    const second = jev.run(work)
    expect(jev.status.value).toBe('loading')
    release()
    await Promise.all([first, second])
    expect(work).toHaveBeenCalledTimes(1)
    expect(jev.answer.value).toBe('ours')

    // Peeking at another champion's build: its own (none yet), then ours again.
    subject.value = { id: '61:MIDDLE', key: 'a' }
    await nextTick()
    expect(jev.status.value).toBe('idle')
    subject.value = { id: '103:MIDDLE', key: 'a' }
    await nextTick()
    expect(jev.status.value).toBe('ready')
    expect(jev.stale.value).toBe(false)
    subject.value = { id: '103:MIDDLE', key: 'b' }
    await nextTick()
    expect(jev.answer.value).toBe('ours')
    expect(jev.stale.value).toBe(true)
  })

  it('keeps a failure by its kind', async () => {
    const { useJevAnswer } = await import('~/composables/useJevAnswer')
    const jev = useJevAnswer<string>(() => ({ id: 'x', key: 'k' }))
    await jev.run(async () => { throw 'Jev answered 401 Unauthorized: ' })
    expect(jev.status.value).toBe('error')
    expect(jev.failure.value).toMatchObject({ kind: 'badKey', status: 401 })
  })
})

const pickOn = (fields: Partial<PickSubject> = {}): PickSubject => ({
  position: 'MIDDLE',
  opponentId: 61,
  allies: [],
  enemies: [{ championId: 61, position: 'MIDDLE' }],
  candidates: [{ championId: 1, score: 2 }, { championId: 2, score: 1 }],
  ...fields,
})

describe('the pick\'s board', () => {
  it('is what Jev read, in any order, and a first pick has nothing to judge', async () => {
    const { pickKey } = await import('~/composables/useJevPick')
    expect(pickBoardKey({ position: 'TOP', opponentId: null, allies: [3, 1], enemyIds: [9, 4] })).toBe(pickBoardKey({ position: 'TOP', opponentId: null, allies: [1, 3], enemyIds: [4, 9] }))
    // The source's scores move with every hover: not part of what was asked.
    expect(pickKey(pickOn())).toBe(pickKey(pickOn({ candidates: [{ championId: 2, score: 9 }, { championId: 1, score: 0 }] })))
    expect(pickKey(pickOn())).not.toBe(pickKey(pickOn({ opponentId: 7 })))
    expect(judgeable({ position: 'MIDDLE', opponentId: null, allies: [], enemyIds: [] })).toBe(false)
    expect(judgeable({ position: 'MIDDLE', opponentId: null, allies: [5], enemyIds: [] })).toBe(true)
  })
})

describe('useJevPick', () => {
  it('does not ask, nor say Jev ordered anything, on a first pick', async () => {
    const { useJevPick } = await import('~/composables/useJevPick')
    const pick = useJevPick(ref(pickOn({ opponentId: null, enemies: [] })))
    expect(pick.canAsk.value).toBe(false)
    await pick.ask()
    expect(pick.status.value).toBe('nothing')
    expect(pick.ranked.value).toEqual([])
    expect(jevMock.jevKeyStatus).not.toHaveBeenCalled()
    expect(jevMock.askJev).not.toHaveBeenCalled()
  })

  it('ranks again on fresh scores without dropping the answer, goes stale on a new opponent, and reuses the candidates already read', async () => {
    const { useJevPick } = await import('~/composables/useJevPick')
    const subject = ref(pickOn({ candidates: [{ championId: 11, score: 2 }, { championId: 12, score: 1 }] }))
    const pick = useJevPick(subject)
    await pick.ask()
    expect(pick.status.value).toBe('ready')
    expect(jevMock.askJev).toHaveBeenCalledTimes(1)
    const before = pick.ranked.value.map(entry => entry.championId)

    // An ally's hover moves the source's scores: re-ranked under the same reads, current.
    subject.value = pickOn({ candidates: [{ championId: 11, score: 0 }, { championId: 12, score: 5 }] })
    await nextTick()
    expect(pick.status.value).toBe('ready')
    expect(pick.stale.value).toBe(false)
    expect(pick.ranked.value.map(entry => entry.championId)).toEqual([...before].reverse())

    // Another opponent on our lane: what Jev read is kept, marked as asked before.
    subject.value = pickOn({ opponentId: 7, enemies: [{ championId: 7, position: 'MIDDLE' }], candidates: [{ championId: 11, score: 0 }, { championId: 12, score: 5 }] })
    await nextTick()
    expect(pick.status.value).toBe('ready')
    expect(pick.stale.value).toBe(true)
    expect(pick.ranked.value).toHaveLength(2)

    // Back on the board it read: asked again, nothing is paid for twice.
    subject.value = pickOn({ candidates: [{ championId: 11, score: 0 }, { championId: 12, score: 5 }] })
    await nextTick()
    await pick.ask()
    expect(jevMock.askJev).toHaveBeenCalledTimes(1)
    expect(pick.stale.value).toBe(false)
  })
})
