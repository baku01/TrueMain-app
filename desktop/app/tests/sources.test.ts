import { describe, expect, it, vi } from 'vitest'
import type { RuneTreeResponse } from '#shared/types/static-data'
import type { LolalyticsBuild } from '~/utils/sources/lolalytics'
import { parseOpgg } from '~/utils/sources/opgg-format'
import { assemblePage, buildsFromOptions, measure } from '~/utils/sources/model'
import type { RuneShares } from '~/utils/sources/model'

/**
 * The other sources read into one shape (`utils/sources`): op.gg's text
 * answers back into objects, a full rune page assembled from runes counted one
 * by one, lolalytics' build read into the panel's options, and any source's
 * options into TrueMain's champion endpoint shape.
 */

// Two trees, enough for a page: Domination primary, Sorcery secondary.
const tree = {
  styles: [
    { styleId: 8100, name: 'Domination', iconUrl: '', keystones: [8112, 8128], subRows: [[8126, 8139], [8137, 8140], [8106, 8135]] },
    { styleId: 8200, name: 'Sorcery', iconUrl: '', keystones: [8214], subRows: [[8224, 8226], [8210, 8234], [8237, 8236]] },
  ],
  perks: {},
  perkStyles: {},
  shardSlots: [[5005, 5008], [5008, 5010], [5001, 5011]],
} as unknown as RuneTreeResponse

vi.mock('~/utils/static-data', () => ({ fetchRuneTree: vi.fn(async () => tree) }))
vi.mock('~/utils/sources/champions', () => ({ championSlug: vi.fn(async () => 'ahri'), championIdOf: vi.fn(async () => 103) }))

describe('parseOpgg', () => {
  it('names each call\'s arguments by its class\'s fields, and keeps an undeclared class a list', () => {
    const text = [
      'class Analysis: champion,data',
      'class CoreItems: ids,ids_names,play,win,pick_rate',
      '',
      'Analysis("AHRI",[CoreItems([3118,4645],["Malignance","Shadowflame"],17974,9471,0.13),Pair(1,-2.5e1)])',
    ].join('\n')
    expect(parseOpgg(text)).toEqual({
      champion: 'AHRI',
      data: [{ ids: [3118, 4645], ids_names: ['Malignance', 'Shadowflame'], play: 17974, win: 9471, pick_rate: 0.13 }, [1, -25]],
    })
  })

  it('reads escapes, booleans and nulls', () => {
    expect(parseOpgg('class X: a,b,c\nX("Kog\\"Maw",true,null)')).toEqual({ a: 'Kog"Maw', b: true, c: null })
  })
})

describe('assemblePage', () => {
  const m = (games: number) => measure(games, 0.5, games / 1000)
  const shares: RuneShares = {
    primary: new Map([[8139, m(800)], [8126, m(100)], [8140, m(700)], [8106, m(900)]]),
    secondary: new Map([[8226, m(500)], [8210, m(400)], [8237, m(300)]]),
    shards: [new Map([[5005, m(900)]]), new Map([[5008, m(950)]]), new Map([[5001, m(700)], [5011, m(200)]])],
  }

  it('takes the keystone\'s tree, its most taken rune per row, and two secondary runes from different rows', () => {
    expect(assemblePage(8112, () => shares, tree)).toEqual({
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

  it('has no page for a keystone the tree does not know', () => {
    expect(assemblePage(9999, () => shares, tree)).toBeNull()
  })
})

describe('lolalytics', () => {
  const build: LolalyticsBuild = {
    header: { patch: '16.21', n: 1000, wr: 53, pr: 10, br: 3, tier: 'S+', rank: 2, rankTotal: 94, avgWr: 51.5 },
    runes: {
      stats: {
        8112: [[86, 53, 860]],
        8128: [[10, 51, 100]],
        8139: [[81, 53, 810], [1, 50, 10]],
        8140: [[78, 53, 780]],
        8106: [[85, 53, 850]],
        8226: [[0, 0, 0], [12, 54, 120]],
        8210: [[0, 0, 0], [11, 54, 110]],
        5005: [[93, 53, 930]],
        '5008f': [[97, 53, 970]],
        5001: [[77, 53, 770]],
      },
    },
    spells: [['4_14', 53.5, 70, 700], ['4_12', 52, 25, 250]],
    startSet: [['1056_2003_2003', 53, 99, 990]],
    boots: [[3020, 53.8, 57.7, 577], [0, 40, 1, 10]],
    item4: [[3089, 60.7, 7.7, 77]],
    item5: [[3135, 62, 1.5, 15]],
    builtBootSet3: [['3118_3020_4645', 53.5, 17.4, 174], ['3118_4645_3157', 54, 10, 100]],
    skill15: [[213114121242233, 59.8, 58.5, 585]],
  }

  it('reads the build into the panel\'s options, rates as fractions', async () => {
    const { lolalyticsOptionsOf } = await import('~/utils/sources/lolalytics')
    const options = await lolalyticsOptionsOf(build)
    expect(options.games).toBe(1000)
    expect(options.pages[0]!.page).toMatchObject({ primaryKeystoneId: 8112, primaryPerk1Id: 8139, secondaryStyleId: 8200, secondaryPerk1Id: 8226, statFlex: 5008 })
    expect(options.pages[0]!.winRate).toBeCloseTo(0.53)
    expect(options.spells[0]).toMatchObject({ spellIds: [4, 14], games: 700 })
    expect(options.starters[0]!.itemIds).toEqual([1056, 2003, 2003])
    // A slot with no item (id 0, "no boots") is not an option.
    expect(options.boots.map(option => option.itemIds)).toEqual([[3020]])
    expect(options.cores[0]!.itemIds).toEqual([3118, 3020, 4645])
    expect(options.followUps(null).map(group => group.slot)).toEqual([4, 5])
    expect(options.skills[0]).toMatchObject({ order: ['Q', 'W', 'E'], opening: ['W', 'Q', 'E'] })
  })

  it('reads TrueMain\'s brackets as lolalytics tiers', async () => {
    const { lolalyticsTier } = await import('~/utils/sources/lolalytics')
    expect(lolalyticsTier('MASTER_PLUS')).toBe('master_plus')
    expect(lolalyticsTier('ALL')).toBe('all')
    expect(lolalyticsTier(undefined)).toBe('emerald_plus')
  })

  it('makes TrueMain\'s lane builds from the options: one per core, boots apart, the first item the tree\'s root', async () => {
    const { lolalyticsOptionsOf } = await import('~/utils/sources/lolalytics')
    const answer = buildsFromOptions(103, 'MIDDLE', await lolalyticsOptionsOf(build))
    expect(answer.totalGames).toBe(1000)
    const [first] = answer.builds
    expect(first!.firstItemId).toBe(3118)
    expect(first!.core.itemPath!.itemIds).toEqual([3118, 4645])
    expect(first!.core.boots!.itemIds).toEqual([3020])
    expect(first!.buildTree[0]!.itemId).toBe(4645)
    expect(first!.buildTree[0]!.children.map(node => node.itemId)).toEqual([3089])
    expect(first!.core.runePage!.primaryKeystoneId).toBe(8112)
  })
})

describe('weighedWinRate', () => {
  it('weighs a win rate by its games: a lucky handful never outranks a large sample', async () => {
    const { weighedWinRate } = await import('~/utils/sources/model')
    const few = weighedWinRate({ winRate: 0.7, games: 30 })
    const many = weighedWinRate({ winRate: 0.56, games: 30000 })
    expect(few).toBeLessThan(many)
    expect(many).toBeCloseTo(0.554, 2)
    expect(weighedWinRate({ winRate: 0.6, games: 0 })).toBe(0)
  })
})

describe('tencent', () => {
  const ranked = (entries: object[]) => JSON.stringify(Object.fromEntries(entries.map((entry, index) => [String(index + 1), entry])))
  const counted = (games: number, winrate: number, showrate: number) => ({ igamecnt: games, wincnt: Math.round(games * winrate / 10000), winrate, showrate })

  it('unwraps the object a guide script assigns, whatever follows it', async () => {
    const { scriptObject } = await import('~/utils/sources/tencent')
    expect(scriptObject('var X={"a":"}{","b":[1]};/* |xGv00|f */')).toEqual({ a: '}{', b: [1] })
    expect(() => scriptObject('nothing')).toThrow()
  })

  it('reads a lane\'s guide into the panel\'s options: whole pages, rates from ten-thousandths, boots out of the cores', async () => {
    const { tencentOptionsOf } = await import('~/utils/sources/tencent')
    const options = await tencentOptionsOf({
      gameversion: '16.21',
      igamecnt: '1000',
      wincnt: '520',
      lanewinrate: '5200',
      lanshowrate: '500',
      champlanorder: '3',
      perkdetail: ranked([{ 1: { perk: '8112&8139&8140&8106&8226&8210&5005&5008&5001', ...counted(600, 5300, 6000) } }]),
      spellidjson: ranked([{ spellid: '4&14', ...counted(700, 5100, 7000) }]),
      itemoutjson: ranked([{ itemid: '1056&2003&2003', ...counted(900, 5000, 9000) }]),
      core3itemjson: ranked([{ itemid: '3118&3020&4645', ...counted(300, 5400, 3000) }]),
      shoesjson: ranked([{ itemid: '3020', ...counted(500, 5200, 5000) }]),
      skilljson: ranked([{ sks: { 1: { sk: '1&3&2&1&1&4&1&3&1&3&4&3&3&2&2', sk_s: '1200', sk_w: '5100' } } }]),
      kills: 0,
      deaths: 0,
      assists: 0,
      goldearnedpergame: 0,
      minionskilled: 0,
    })
    expect(options.games).toBe(1000)
    expect(options.pages[0]!.page).toMatchObject({ primaryStyleId: 8100, primaryKeystoneId: 8112, secondaryStyleId: 8200, secondaryPerk1Id: 8226, statDefense: 5001 })
    expect(options.pages[0]!.winRate).toBeCloseTo(0.53)
    expect(options.spells[0]).toMatchObject({ spellIds: [4, 14], games: 700 })
    expect(options.cores[0]!.itemIds).toEqual([3118, 4645])
    expect(options.skills[0]).toMatchObject({ order: ['Q', 'E', 'W'], games: 120 })
  })
})
