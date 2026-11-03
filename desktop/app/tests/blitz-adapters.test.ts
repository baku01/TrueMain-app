import { describe, expect, it, vi } from 'vitest'
import { blitzRole, blitzTier, truemainPosition } from '~/utils/blitz/client'
import { buildsFromBlitz, maxOrder } from '~/utils/blitz/builds'

/**
 * Blitz's answers turned into TrueMain's shapes (`utils/blitz/*`), on documents
 * cut down from real answers: the elo and lane words each side uses, the max
 * order read off 18 skill points, a rune page assembled from runes Blitz counts
 * one by one, and the tier list's 1–5 grades as S–D.
 */

vi.mock('~/utils/blitz/client', async importOriginal => ({
  ...await importOriginal<typeof import('~/utils/blitz/client')>(),
  blitzRows: vi.fn(async () => [
    { champion_id: 103, individual_position: 'MIDDLE', patch: '16.21', games: 9000, win_rate: 0.53, pick_rate: 0.08, champion_ban_rate: 0.02, champion_role_tier: 1 },
    { champion_id: 103, individual_position: 'BOTTOM', patch: '16.21', games: 400, win_rate: 0.47, pick_rate: 0.01, champion_ban_rate: 0.02, champion_role_tier: 5 },
    { champion_id: 103, individual_position: 'ALL', patch: '16.21', games: 9400, win_rate: 0.52, pick_rate: 0.09, champion_ban_rate: 0.02, champion_role_tier: 2 },
    { champion_id: 64, individual_position: 'JUNGLE', patch: '16.21', games: 12000, win_rate: 0.5, pick_rate: 0.1, champion_ban_rate: 0.1, champion_role_tier: 3 },
  ]),
}))

const tally = (games: number, winRate = 0.5) => ({ games, wins: Math.round(games * winRate), win_rate: winRate, pick_rate: games / 1000 })

describe('Blitz words', () => {
  it('reads TrueMain\'s elo brackets as Blitz tiers', () => {
    expect(blitzTier('MASTER_PLUS')).toBe('MASTER+')
    expect(blitzTier('GOLD')).toBe('GOLD')
    expect(blitzTier('ALL')).toBe('IRON+')
    expect(blitzTier(undefined)).toBe('MASTER+')
  })

  it('names the lanes each side\'s way', () => {
    expect(blitzRole('MIDDLE')).toBe('MID')
    expect(blitzRole('UTILITY')).toBe('SUPPORT')
    expect(blitzRole('TOP')).toBe('TOP')
    expect(truemainPosition('BOT')).toBe('BOTTOM')
  })
})

describe('maxOrder', () => {
  it('orders the basic abilities by the level each gets its fifth point', () => {
    expect(maxOrder([2, 1, 3, 1, 1, 4, 1, 2, 1, 2, 4, 2, 2, 3, 3, 4, 3, 3])).toEqual(['Q', 'W', 'E'])
    expect(maxOrder([1, 3, 2, 3, 3, 4, 3, 1, 3, 1, 4, 1, 1, 2, 2, 4, 2, 2])).toEqual(['E', 'Q', 'W'])
  })
})

describe('buildsFromBlitz', () => {
  const doc = {
    games: 1000,
    win_rate: 0.55,
    pick_rate: 0.6,
    patch: '16.21',
    keystone: [{ ...tally(700, 0.56), keystone_id: 8112, treeId: 8100 }, { ...tally(200), keystone_id: 8214, treeId: 8200 }],
    runes: [
      { ...tally(650), runeId: 8139, treeId: 8100, index: 0 },
      { ...tally(20), runeId: 8143, treeId: 8100, index: 0 },
      { ...tally(640), runeId: 8140, treeId: 8100, index: 1 },
      { ...tally(660), runeId: 8106, treeId: 8100, index: 2 },
      // Secondary slots: the tree with the most games there wins, its two best runes fill the slots.
      { ...tally(500), runeId: 8226, treeId: 8200, index: 3 },
      { ...tally(450), runeId: 8210, treeId: 8200, index: 4 },
      { ...tally(80), runeId: 8304, treeId: 8300, index: 3 },
      { ...tally(30), runeId: 8139, treeId: 8100, index: 3 },
    ],
    shards: {
      offenseShard: [{ ...tally(900), shard_id: '5005' }, { ...tally(100), shard_id: '5008' }],
      flexShard: [{ ...tally(950), shard_id: '5008' }],
      defenseShard: [{ ...tally(800), shard_id: '5001' }],
    },
    summonerSpells: [{ ...tally(700), summonerSpellIds: [4, 14] }, { ...tally(250), summonerSpellIds: [4, 12] }],
    startingItems: [{ ...tally(800), itemIds: ['1056', '2003'] }],
    coreItems: [
      { ...tally(300, 0.54), itemIds: '3118,4645,3157' },
      { ...tally(200, 0.57), itemIds: '3118,3020,4645' },
    ],
    itemsAfterCore: {
      '3118,3157,4645': { 1: [{ ...tally(120), itemIds: [3089] }] },
    },
    skillOrders: [{ ...tally(600), skillOrder: [2, 1, 3, 1, 1, 4, 1, 2, 1, 2, 4, 2, 2, 3, 3, 4, 3, 3] }],
  }

  const answer = buildsFromBlitz(103, 'MIDDLE', doc)

  it('makes one build per core path, most played first', () => {
    expect(answer.totalGames).toBe(1000)
    expect(answer.patch).toBe('16.21')
    expect(answer.builds.map(build => build.firstItemId)).toEqual([3118, 3118])
    expect(answer.builds[0]!.games).toBe(300)
  })

  it('assembles the most played rune page from runes counted one by one', () => {
    expect(answer.builds[0]!.core.runePage).toMatchObject({
      primaryStyleId: 8100,
      primaryKeystoneId: 8112,
      primaryPerk1Id: 8139,
      primaryPerk2Id: 8140,
      primaryPerk3Id: 8106,
      secondaryStyleId: 8200,
      secondaryPerk1Id: 8226,
      secondaryPerk2Id: 8210,
      statOffense: 5005,
      statFlex: 5008,
      statDefense: 5001,
    })
  })

  it('draws a core path\'s boots apart from its items, the lane\'s boots when it has none', () => {
    const [first, second] = answer.builds
    expect(first!.core.itemPath!.itemIds).toEqual([3118, 4645, 3157])
    expect(first!.core.boots!.itemIds).toEqual([3020])
    expect(second!.core.itemPath!.itemIds).toEqual([3118, 4645])
    expect(second!.core.boots!.itemIds).toEqual([3020])
  })

  it('chains the core path after its first item — the view draws that one as the root — its follow-ups under the last', () => {
    const build = answer.builds[0]!
    expect(build.firstItemId).toBe(3118)
    const [second] = build.buildTree
    expect(build.buildTree).toHaveLength(1)
    expect(second!.itemId).toBe(4645)
    expect(second!.children[0]!.itemId).toBe(3157)
    expect(second!.children[0]!.children.map(node => node.itemId)).toEqual([3089])
  })

  it('carries the lane\'s spells, starter and skill order', () => {
    const { core } = answer.builds[0]!
    expect(core.summonerSpells).toMatchObject({ spell1Id: 4, spell2Id: 14 })
    expect(core.starterItems!.itemIds).toEqual([1056, 2003])
    expect(core.skillOrder!.sequence).toEqual(['Q', 'W', 'E'])
  })

  it('answers an empty lane when Blitz has no document', () => {
    expect(buildsFromBlitz(103, 'TOP', undefined)).toEqual({ championId: 103, patch: null, position: 'TOP', totalGames: 0, builds: [] })
  })
})

describe('tierListFromBlitz', () => {
  it('groups the lanes by grade, S to D, and leaves Blitz\'s all-lanes rows out', async () => {
    const { tierListFromBlitz } = await import('~/utils/blitz/stats')
    const list = await tierListFromBlitz({})
    expect(list.patchVersion).toBe('16.21')
    expect(list.tiers.map(group => [group.tier, group.entries.map(entry => `${entry.championId}:${entry.position}`)])).toEqual([
      ['S', ['103:MIDDLE']],
      ['B', ['64:JUNGLE']],
      ['D', ['103:BOTTOM']],
    ])
  })

  it('keeps one lane when the page asks for it', async () => {
    const { tierListFromBlitz } = await import('~/utils/blitz/stats')
    const list = await tierListFromBlitz({ position: 'JUNGLE' })
    expect(list.tiers.flatMap(group => group.entries).map(entry => entry.championId)).toEqual([64])
  })
})

describe('followUpOptions', () => {
  it('reads the slots as a path: Blitz\'s later slots are sets of the items after the core, ids ascending', async () => {
    const { followUpOptions } = await import('~/utils/blitz/options')
    // Aatrox's answer: 6333 is the fourth item, [3053, 6333] means 3053 came fifth.
    const doc = {
      itemsAfterCore: {
        '3047,6610,6692': {
          1: [{ ...tally(9109), itemIds: [6333] }, { ...tally(1359), itemIds: [3161] }],
          2: [{ ...tally(1493), itemIds: [3053, 6333] }, { ...tally(708), itemIds: [3156, 6333] }, { ...tally(300), itemIds: [3053, 3161] }],
          3: [{ ...tally(65), itemIds: [3053, 3065, 6333] }, { ...tally(59), itemIds: [2517, 3053, 6333] }, { ...tally(40), itemIds: [3065, 3156, 6333] }],
        },
      },
    } as never
    const core = { itemIds: [6692, 3047, 6610], games: 100000, pickRate: 0.1, winRate: 0.5 }
    const [fourth, fifth, sixth] = followUpOptions(doc, core)
    expect(fourth!.options.map(option => option.itemIds[0])).toEqual([6333, 3161])
    expect(fifth!.options.map(option => option.itemIds[0])).toEqual([3053, 3156])
    expect(sixth!.options.map(option => option.itemIds[0])).toEqual([3065, 2517])
  })
})

describe('buildsFromBlitz merging', () => {
  it('makes one build of the cores that differ only in when the boots were bought', () => {
    const tallyOf = (games: number, wins: number) => ({ games, wins, win_rate: wins / games, pick_rate: games / 100000 })
    const doc = {
      games: 100000, win_rate: 0.5, pick_rate: 1, patch: '16.21', keystone: [], runes: [], shards: { offenseShard: [], flexShard: [], defenseShard: [] },
      summonerSpells: [], startingItems: [], skillOrders: [], itemsAfterCore: {},
      coreItems: [
        { ...tallyOf(10792, 6000), itemIds: '6692,3047,6610' },
        { ...tallyOf(6439, 3600), itemIds: '3047,6692,6610' },
        { ...tallyOf(5231, 3000), itemIds: '6692,3111,6610' },
      ],
    }
    const { builds } = buildsFromBlitz(266, 'TOP', doc)
    expect(builds.map(build => [build.core.itemPath!.itemIds, build.core.boots!.itemIds[0], build.games])).toEqual([
      [[6692, 6610], 3047, 17231],
      [[6692, 6610], 3111, 5231],
    ])
    expect(builds[0]!.winRate).toBeCloseTo(9600 / 17231)
  })
})
