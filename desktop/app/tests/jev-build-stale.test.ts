import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/utils/jev', () => ({ askJev: vi.fn(), jevKeyStatus: vi.fn(async () => ({ set: false })) }))

beforeEach(() => {
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('shallowRef', shallowRef)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('useChampionStatics', () => ({ patch: ref('16.22') }))
  vi.stubGlobal('useStaticData', () => ({ items: ref({}), summoners: ref({}), runeTree: ref(null) }))
  vi.stubGlobal('useChampionTexts', () => ({ textOf: () => null, loadAll: async () => {} }))
  vi.stubGlobal('useJevTexts', () => ({}))
  vi.stubGlobal('useJevEnemies', () => ({}))
})
afterEach(() => vi.unstubAllGlobals())

const board = (championId: number, enemies: { championId: number, position: string }[]) =>
  ({ championId, request: { position: 'MIDDLE', enemies, allies: [] } })

describe('Jev\'s answer as the draft moves on', () => {
  it('stays until asked again when an enemy locks in, marked as asked before; goes with another champion of ours', async () => {
    const { useJevBuild } = await import('~/composables/useJevBuild')
    const subject = ref(board(103, [{ championId: 61, position: 'MIDDLE' }]))
    const jev = useJevBuild(subject as never)
    await jev.ask()
    // No key in the test: the answer settles at once, as one would.
    expect(jev.status.value).toBe('noKey')
    expect(jev.stale.value).toBe(false)

    subject.value = board(103, [{ championId: 61, position: 'MIDDLE' }, { championId: 64, position: 'JUNGLE' }])
    await nextTick()
    expect(jev.status.value).toBe('noKey')
    expect(jev.stale.value).toBe(true)

    // Asked again on the new board: current again.
    await jev.ask()
    expect(jev.stale.value).toBe(false)

    subject.value = board(1, [{ championId: 61, position: 'MIDDLE' }, { championId: 64, position: 'JUNGLE' }])
    await nextTick()
    expect(jev.status.value).toBe('idle')
    expect(jev.stale.value).toBe(false)
  })
})
