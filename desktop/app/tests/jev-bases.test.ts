import { describe, expect, it, vi } from 'vitest'
import type { BlitzBuildDoc } from '~/utils/blitz/builds'
import type { BuildOptions } from '~/utils/sources/model'
import type { LaidBuild } from '~/utils/jev-build'
import type { BaseCandidate } from '~/utils/jev-bases'

const rows = vi.hoisted(() => ({ list: [] as unknown[] }))
vi.mock('~/utils/blitz/builds', async (original) => {
  const actual = await original<typeof import('~/utils/blitz/builds')>()
  return { ...actual, readBlitzBuildRows: vi.fn(async () => rows.list) }
})

const { LANE_BASE, baseCandidates, baseTag, jevImportSelection, jevImportTitles, playstyleNames, resolveBases } = await import('~/utils/jev-bases')

const doc = (games: number, tags: string[]) => ({ games, name_tags: tags }) as unknown as BlitzBuildDoc
const options = (cores: number): BuildOptions => ({
  patch: '16.22', games: 100, pages: [], shares: null, spells: [], starters: [], boots: [], skills: [],
  cores: Array.from({ length: cores }, (_, index) => ({ itemIds: [3000 + index], games: 10, pickRate: 0.1, winRate: 0.5 })),
  followUps: () => [],
})
const style = (name: string) => ({ key: `style:${name}`, kind: 'playstyle' as const, name })

describe('the playstyles a lane offers as bases', () => {
  it('are Blitz\'s documents\' names, most played first, each once', () => {
    expect(playstyleNames([doc(969, ['AD']), doc(17031, ['Bruiser']), doc(3257, ['Lethality']), doc(10, ['Bruiser'])])).toEqual(['Bruiser', 'Lethality', 'AD'])
  })

  it('are none when Blitz answers one document: it is the lane itself', () => {
    expect(playstyleNames([doc(5000, ['Bruiser'])])).toEqual([])
  })
})

describe('the bases offered', () => {
  it('are the lane, the matchup with an opponent, each playstyle, then the one-tricks', async () => {
    rows.list = [doc(17031, ['Bruiser']), doc(3257, ['Lethality'])]
    const keys = (await baseCandidates(266, 'TOP', 84)).map(candidate => candidate.base.key)
    expect(keys).toEqual(['lane', 'matchup:84', 'style:Bruiser', 'style:Lethality', 'otp'])
    expect((await baseCandidates(266, 'TOP', null)).map(candidate => candidate.base.key)).not.toContain('matchup:84')
  })

  it('keep only the families that answered a core, in order, a failure or an empty answer hidden', async () => {
    const asked: string[] = []
    const candidate = (base: BaseCandidate['base'], answer: () => Promise<BuildOptions | null>): BaseCandidate => ({ base, read: () => (asked.push(base.key), answer()) })
    const loaded = await resolveBases([
      candidate(LANE_BASE, async () => options(3)),
      candidate({ key: 'matchup:84', kind: 'matchup', name: null }, async () => null),
      candidate(style('Bruiser'), async () => options(0)),
      candidate(style('Lethality'), async () => { throw new Error('down') }),
      candidate({ key: 'otp', kind: 'otp', name: null }, async () => options(1)),
    ])
    expect(asked).toEqual(['lane', 'matchup:84', 'style:Bruiser', 'style:Lethality', 'otp'])
    expect(loaded.map(entry => entry.base.key)).toEqual(['lane', 'otp'])
  })
})

describe('a Jev answer\'s names', () => {
  const words = { matchup: 'Matchup', otp: 'OTP' }

  it('tag the base: nothing for the lane, the playstyle, the matchup, the one-tricks', () => {
    expect(baseTag(LANE_BASE, words)).toBe('')
    expect(baseTag(null, words)).toBe('')
    expect(baseTag(style('Lethality'), words)).toBe('Lethality')
    expect(baseTag({ key: 'matchup:84', kind: 'matchup', name: null }, words)).toBe('Matchup')
    expect(baseTag({ key: 'otp', kind: 'otp', name: null }, words)).toBe('OTP')
  })

  it('title the imports after the base', () => {
    expect(jevImportTitles('Aatrox vs Akali', 'Lethality')).toEqual({ jev: 'Aatrox vs Akali · Jev Lethality', standard: 'Aatrox vs Akali · Lethality' })
    expect(jevImportTitles('Aatrox vs Akali', '')).toEqual({ jev: 'Aatrox vs Akali · Jev', standard: 'Aatrox vs Akali' })
  })

  it('make the automatic import follow the base: Jev\'s build selected, the base\'s most played beside it', () => {
    const laid = (items: number[]): LaidBuild => ({
      runePage: null,
      summonerSpells: { spell1Id: 4, spell2Id: 12, games: 1, pickRate: 1, winRate: 0.5 },
      starterItems: { itemIds: [1055], games: 1, pickRate: 1, winRate: 0.5 },
      skillOrder: null,
      boots: { itemIds: [3047], games: 1, pickRate: 1, winRate: 0.5 },
      order: [items[0]!, 3047, ...items.slice(1)],
    })
    const titles = jevImportTitles('Aatrox vs Akali', 'Lethality')
    const selection = jevImportSelection(266, style('Lethality'), [], laid([6692, 6694]), laid([6610, 3071]), titles)!
    expect(selection.selected).toMatchObject({ key: 'jev:style:Lethality', title: 'Aatrox vs Akali · Jev Lethality', path: [6692, 6694], boots: [3047], starter: [1055], spells: [4, 12], bootsAt: 1 })
    expect(selection.others.map(other => [other.key, other.title, other.path])).toEqual([['jev-standard:style:Lethality', 'Aatrox vs Akali · Lethality', [6610, 3071]]])
    expect(jevImportSelection(266, LANE_BASE, [], null, laid([6610]), titles)).toBeNull()
  })
})
