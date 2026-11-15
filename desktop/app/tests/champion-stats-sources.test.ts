import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readCounters } from '~/utils/sources/counters'
import { readDuos, readSynergies } from '~/utils/sources/synergies'
import { changesBetween, readWinRateChanges } from '~/utils/sources/patch-change'

/**
 * Which source answers the counters, the synergies, the duos and the patch's
 * change (`utils/sources/stand-in.ts`): the lead source (lolalytics, the most
 * complete) when it measures them, else Blitz, then the next that does —
 * never TrueMain, which the app does not ask.
 */
const state = vi.hoisted(() => ({ asked: [] as string[], down: new Set<string>(), blank: new Set<string>() }))

/** A source's answer, noted as asked; thrown when it is down, emptied when it is blank. */
function answer<T>(source: string, full: T, none: T): T {
  state.asked.push(source)
  if (state.down.has(source)) throw new Error(`${source} down`)
  return state.blank.has(source) ? none : full
}

vi.mock('~/utils/data-source', () => ({ SOURCE_ELO_BRACKET: 'EMERALD_PLUS', leadSource: { value: 'lolalytics' } }))
vi.mock('~/composables/useApi', () => ({
  apiGet: vi.fn(async (path: string, query: Record<string, unknown>) => {
    if (path.endsWith('/synergies')) return answer('truemain', { patch: '16.22', partners: [{ partnerChampionId: 412, partnerPosition: 'UTILITY', games: 300, winRate: 0.55, synergy: 0.02 }] }, { patch: '16.22', partners: [] })
    return answer('truemain', { patchVersion: query.patch ?? '16.22', tiers: [{ tier: 'S', entries: [{ championId: 1, position: 'TOP', winRate: query.patch ? 0.5 : 0.53 }] }] }, { patchVersion: '16.22', tiers: [] })
  }),
}))
vi.mock('~/utils/blitz/stats', () => ({
  matchupsFromBlitz: vi.fn(async () => answer('blitz', { patch: '16.22', matchups: [{ opponentChampionId: 86, games: 500, winRate: 0.53, matchupScore: 0.025, laneWinRate: 0.6, laneMatchupScore: 0.05 }] }, { patch: '16.22', matchups: [] })),
}))
vi.mock('~/utils/blitz/synergies', () => ({
  synergiesFromBlitz: vi.fn(async () => answer('blitz', { patch: '16.22', rows: [{ championId: 222, allyChampionId: 412, position: 'BOTTOM', allyPosition: 'UTILITY', games: 500, winRate: 0.54, delta: 0.01, tier: 'A' }] }, { patch: '16.22', rows: [] })),
  duosFromBlitz: vi.fn(async () => answer('blitz', { patch: '16.22', rows: [{ championId: 222, allyChampionId: 412, position: 'BOTTOM', allyPosition: 'UTILITY', games: 5000, winRate: 0.53, delta: 0.01, tier: 'S' }] }, { patch: '16.22', rows: [] })),
}))
vi.mock('~/utils/blitz/client', async importOriginal => ({
  ...await importOriginal<typeof import('~/utils/blitz/client')>(),
  blitzRows: vi.fn(async () => answer('blitz', [{ champion_id: 1, individual_position: 'TOP', win_rate: 0.52, previous_patch_stats: { patch: '16.21', win_rate: 0.5 } }], [])),
}))
vi.mock('~/utils/sources/lolalytics', () => ({
  lolalyticsLane: (position: string) => ({ TOP: 'top', BOTTOM: 'bottom', UTILITY: 'support' } as Record<string, string>)[position] ?? 'middle',
  readLolalyticsBuild: vi.fn(async () => answer('lolalytics', { header: { patch: '16.22' }, enemy: { top: [[86, 52, 1.2, 2.5, 4, 900]] } }, { header: { patch: '16.22' }, enemy: {} })),
  readLolalyticsTeam: vi.fn(async () => answer('lolalytics', { team: { support: [[412, 54, 1, 1.5, 6, 800]] } }, { team: {} })),
  lolalyticsRows: vi.fn(async (query: Record<string, unknown>) => answer('lolalytics', [{ championId: 1, position: 'TOP', winRate: query.patch ? 0.49 : 0.5, patchVersion: '16.22' }], [])),
}))
vi.mock('~/utils/sources/opgg', () => ({
  POSITION: { top: 'TOP', jungle: 'JUNGLE', mid: 'MIDDLE', adc: 'BOTTOM', support: 'UTILITY' },
  asList: (value: unknown) => (Array.isArray(value) ? value : []),
  num: (value: unknown) => (typeof value === 'number' ? value : 0),
  analysis: vi.fn(async () => answer('opgg', { synergies: { support: [{ synergy_champion_id: 412, win_rate: 0.52, play: 70 }] } }, { synergies: {} })),
}))

beforeEach(() => {
  state.asked = []
  state.down.clear()
  state.blank.clear()
})

describe('readCounters', () => {
  it('reads the lead source when it scores matchups', async () => {
    const read = await readCounters(266, 'TOP')
    expect(read.source).toBe('lolalytics')
    expect(read.rows[0]).toMatchObject({ championId: 86, winRate: 0.52, score: 0.025, laneScore: null })
    expect(state.asked).toEqual(['lolalytics'])
  })

  it('has Blitz stand in when the lead source is down, and never asks TrueMain', async () => {
    state.down.add('lolalytics')
    const read = await readCounters(266, 'TOP')
    expect(read).toMatchObject({ source: 'blitz', rows: [{ score: 0.025, laneScore: 0.05 }] })
    expect(state.asked).toEqual(['lolalytics', 'blitz'])
  })
})

describe('readSynergies', () => {
  it('reads lolalytics\' delta 2 as the delta', async () => {
    expect((await readSynergies(222, 'BOTTOM', 'UTILITY')).rows[0]).toMatchObject({ winRate: 0.54, delta: 0.015, tier: 'S' })
    expect(state.asked).toEqual(['lolalytics'])
  })

  it('has Blitz, then op.gg stand in — never TrueMain, though it measures synergies', async () => {
    state.blank.add('lolalytics')
    state.down.add('blitz')
    const read = await readSynergies(222, 'BOTTOM', 'UTILITY')
    expect(read).toMatchObject({ source: 'opgg', rows: [{ allyChampionId: 412, games: 70, delta: null, tier: '' }] })
    expect(state.asked).toEqual(['lolalytics', 'blitz', 'opgg'])
  })
})

describe('readDuos', () => {
  it('reads Blitz: no other source lists duos', async () => {
    expect((await readDuos('BOTTOM', 'UTILITY')).source).toBe('blitz')
    expect(state.asked).toEqual(['blitz'])
  })
})

describe('readWinRateChanges', () => {
  it('measures one source\'s two patches: the lead source, Blitz when it has none — never TrueMain', async () => {
    const lolalytics = await readWinRateChanges()
    expect(lolalytics).toMatchObject({ source: 'lolalytics', since: '16.21' })
    expect(lolalytics.changes.get('1:TOP')).toBeCloseTo(0.01)
    state.asked = []
    state.blank.add('lolalytics')
    const blitz = await readWinRateChanges('MASTER_PLUS')
    expect(blitz.source).toBe('blitz')
    expect(blitz.since).toBe('16.21')
    expect(blitz.changes.get('1:TOP')).toBeCloseTo(0.02)
    expect(state.asked).not.toContain('truemain')
  })
})

describe('changesBetween', () => {
  it('measures each lane on both patches, and only those', () => {
    const changes = changesBetween(
      [{ championId: 1, position: 'TOP', winRate: 0.52 }, { championId: 2, position: 'MIDDLE', winRate: 0.5 }],
      [{ championId: 1, position: 'TOP', winRate: 0.5 }, { championId: 1, position: 'JUNGLE', winRate: 0.4 }],
    )
    expect([...changes.keys()]).toEqual(['1:TOP'])
    expect(changes.get('1:TOP')).toBeCloseTo(0.02)
  })
})
