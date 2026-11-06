import { describe, expect, it } from 'vitest'
import type { BlitzBuildDoc } from '../app/utils/blitz/builds'
import { buildsFromPlaystyles, playstyleName } from '../app/utils/blitz/playstyles'

/**
 * Blitz's lane answer is one document per playstyle (Aatrox top on 16.22:
 * Bruiser, Lethality, Bruiser + Lethality, AD), each whole; the builds list
 * names one build per playstyle, as Blitz does.
 */
const tally = (games: number, wins = games / 2) => ({ games, wins, win_rate: wins / games, pick_rate: games / 30000 })

function doc(games: number, tags: string[], cores: [string, number][], keystone: number): BlitzBuildDoc {
  return {
    games, win_rate: 0.5, pick_rate: 0.2, patch: '16.22',
    keystone: [{ ...tally(games), keystone_id: keystone, treeId: 8000 }],
    runes: [], shards: { offenseShard: [], flexShard: [], defenseShard: [] },
    summonerSpells: [{ ...tally(games), summonerSpellIds: [4, 12] }],
    startingItems: [], skillOrders: [], itemsAfterCore: {},
    coreItems: cores.map(([itemIds, count]) => ({ ...tally(count), itemIds })),
    name_tags: tags,
    build_id: { primary_tags_f3pie: ['AD', ...tags.filter(tag => tag !== 'AD')].join(', ') },
  }
}

const bruiser = doc(17031, ['Bruiser'], [['6610,3047,6333', 6000], ['3071,3047,6333', 2000]], 8010)
const lethality = doc(3257, ['Lethality'], [['6692,3047,6694', 1200]], 8010)
const both = doc(1430, ['Bruiser', 'Lethality'], [['6692,3047,6333', 500]], 8010)
const ad = doc(969, ['AD'], [['3078,3047,6333', 300]], 8005)

describe('playstyleName', () => {
  it('joins the tags Blitz names a document by', () => {
    expect(playstyleName(both)).toBe('Bruiser · Lethality')
    expect(playstyleName(ad)).toBe('AD')
  })

  it('falls back on the build label, and names nothing without either', () => {
    expect(playstyleName({ ...bruiser, name_tags: [] })).toBe('AD · Bruiser')
    expect(playstyleName({ ...bruiser, name_tags: undefined, build_id: null })).toBeNull()
  })
})

describe('buildsFromPlaystyles', () => {
  it('makes one named build per playstyle, most played first, each from its own document', () => {
    const answer = buildsFromPlaystyles(266, 'TOP', [ad, lethality, bruiser, both])
    expect(answer.builds.map(build => [build.name, build.firstItemId, build.games])).toEqual([
      ['Bruiser', 6610, 6000],
      ['Lethality', 6692, 1200],
      ['Bruiser · Lethality', 6692, 500],
      ['AD', 3078, 300],
    ])
    // Each its own rune page: AD's document runs another keystone.
    expect(answer.builds[3]!.primaryKeystoneId).toBe(8005)
    expect(answer.totalGames).toBe(17031 + 3257 + 1430 + 969)
    expect(answer.patch).toBe('16.22')
  })

  it('keeps a single document\'s core paths, unnamed, as before', () => {
    const answer = buildsFromPlaystyles(266, 'TOP', [bruiser])
    expect(answer.builds.map(build => [build.firstItemId, build.name ?? null])).toEqual([[6610, null], [3071, null]])
  })

  it('names a single document\'s builds when asked — the one-tricks\' group', () => {
    const answer = buildsFromPlaystyles(266, 'TOP', [lethality], true)
    expect(answer.builds.map(build => build.name)).toEqual(['Lethality'])
    // Two paths of one playstyle: the most played carries the name, the other does not repeat it.
    expect(buildsFromPlaystyles(266, 'TOP', [bruiser], true).builds.map(build => build.name ?? null)).toEqual(['Bruiser', null])
  })

  it('answers no build for no document', () => {
    expect(buildsFromPlaystyles(266, 'TOP', []).builds).toEqual([])
  })
})
