import { computed, ref, shallowRef, watch } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THIN_LANE_GAMES, useBuildOptions } from '~/composables/useBuildOptions'

const build = (firstItemId: number, games: number) => ({ firstItemId, primaryKeystoneId: 8112, core: { runePage: null }, buildTree: [], games, winRate: 0.5 })
const answers: Record<string, unknown> = {
  UTILITY: { championId: 157, totalGames: 120, builds: [build(3078, 80)] },
  MIDDLE: { championId: 157, totalGames: 90000, builds: [build(6673, 60000)] },
}

beforeEach(() => {
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('shallowRef', shallowRef)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('useChampionBuilds', (_champion: unknown, position: { value: string | null }) => ({ response: computed(() => (position.value ? answers[position.value] ?? null : null)), pending: ref(false) }))
  vi.stubGlobal('useTierList', () => ({ mainEntryOf: () => ({ position: 'MIDDLE' }) }))
})
afterEach(() => vi.unstubAllGlobals())

describe('a lane with too few games', () => {
  it('offers the main lane\'s builds beside it and opens them first (Yasuo support)', () => {
    const { options, defaultKey, thinLane } = useBuildOptions(ref(157), ref('UTILITY'), ref(null))
    expect(thinLane.value).toEqual({ games: 120, main: 'MIDDLE' })
    expect(options.value.map(option => option.key.split('-')[0])).toEqual(['lane', 'main'])
    expect(defaultKey.value?.startsWith('main-')).toBe(true)
  })

  it('leaves a lane with enough games alone', () => {
    const { options, thinLane } = useBuildOptions(ref(157), ref('MIDDLE'), ref(null))
    expect(thinLane.value).toBeNull()
    expect(options.value.every(option => option.key.startsWith('lane-'))).toBe(true)
    expect(THIN_LANE_GAMES).toBeGreaterThan(120)
  })
})
