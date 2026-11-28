import type { JevOption, JevSlot } from '~/utils/jev-build'
import type { Needs } from '~/utils/jev-recommend'
import type { JevQuestion } from '~/utils/jev'
import type { Request } from '~/utils/jev-read'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PICK_WEIGHTS, rankPicks, rankSlot } from '~/utils/jev-recommend'
import { askBatches } from '~/utils/jev-ask'
import { championReadKey, knownChampionRead } from '~/utils/jev-read'

vi.mock('~/utils/jev', () => ({ askJev: vi.fn() }))

describe('a part Jev read for the others but not this one', () => {
  it('counts as neutral for a pick, so an unread candidate does not rank on the source alone', () => {
    const read = (value: number) => ({ lane: value, team: value, enemy: value, confidence: 1 })
    const ranked = rankPicks(
      [{ championId: 1, score: 3 }, { championId: 2, score: 2 }, { championId: 3, score: 1 }],
      new Map([[2, read(0.9)], [3, read(0.5)]]),
    )
    const unread = ranked.find(pick => pick.championId === 1)!
    expect(unread.parts.lane).toBeUndefined()
    expect(unread.confidence).toBeNull()
    expect(unread.total).toBeCloseTo(PICK_WEIGHTS.stats * unread.parts.stats + (1 - PICK_WEIGHTS.stats) * 0.5)
    // On its statistics alone it would have been first (0.4·stats over 0.4).
    expect(ranked[0]!.championId).toBe(2)
  })

  it('counts as neutral for a lane choice whose fit did not come back', () => {
    const option = (key: string): JevOption => ({ key, label: key, itemIds: [], games: 900, pickRate: 0.3, winRate: 0.5 })
    const slot: JevSlot = { name: 'runes', kind: 'runes', lane: false, options: [option('o0'), option('o1'), option('o2')] }
    const needs: Needs = { physical: 0.5, magic: 0.5, cc: 0, heal: 0, burst: 0, autos: 0, tanks: 0 }
    const ranked = rankSlot(slot, { team: needs, lane: needs, itemReads: new Map(), tags: () => [], urgency: null, fits: { r_o0: { fit: 0.9, confidence: 1 }, r_o1: { fit: 0.5, confidence: 1 } } })
    expect(ranked.scored.o2!.parts.lane).toBeUndefined()
    expect(ranked.scored.o2!.total).toBeCloseTo(ranked.scored.o1!.total)
  })
})

describe('the enemy kits the pick and the build ask at once', () => {
  beforeEach(() => {
    vi.stubGlobal('useChampionStatics', () => ({ champions: ref(new Map()), patch: ref('dedupe') }))
    vi.stubGlobal('useChampionTexts', () => ({ textOf: (id: number) => ({ id, name: `C${id}`, classes: [], kit: [] }) }))
    vi.stubGlobal('useDamageProfiles', () => ({ profileOf: () => null, load: async () => {} }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('are asked once, the second ask awaiting the first', async () => {
    const { useJevEnemies } = await import('~/composables/useJevEnemies')
    let release = () => {}
    const gate = new Promise<void>(resolve => (release = resolve))
    const jev = vi.fn(async (_state: unknown, questions: Record<string, JevQuestion>) => {
      await gate
      return Object.fromEntries(Object.keys(questions).map(name => [name, { type: 'score' as const, score: 1, confidence: 1, probabilities: {} }]))
    })
    const ask = (parts: Request[]) => askBatches(parts, { ask: jev })
    const pick = useJevEnemies().read([61], ask)
    const build = useJevEnemies().read([61], ask)
    release()
    await Promise.all([pick, build])
    expect(jev).toHaveBeenCalledTimes(1)
    expect(knownChampionRead(championReadKey('dedupe', 61))).toBeTruthy()
  })
})
