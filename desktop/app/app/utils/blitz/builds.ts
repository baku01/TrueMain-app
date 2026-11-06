import type { BuildItemSet, BuildRunePage, BuildSkillOrder, BuildSummonerSpells, BuildTreeNode, ChampionBuild, ChampionBuildResponse } from '~/types/build'
import { SOLO_QUEUE, blitzRole, blitzRows } from '~/utils/blitz/client'
import { keepBounded } from '~/utils/bounded'
import { BOOTS } from '~/utils/item-groups'

/**
 * A champion's lane build as Blitz measures it (`champion_builds_tags`), in
 * the shape TrueMain's champion endpoint answers (`ChampionBuildResponse`), so
 * every build view draws it unchanged.
 *
 * Blitz answers one document per lane: every measured choice — core paths,
 * rune by rune, shards, spells, starters, skill orders — each with its own
 * games and wins. TrueMain answers one build per first completed item. The
 * document's most played core paths become the builds; what Blitz measures
 * across the whole lane (runes, spells, starters, skills) is the same on each.
 */

export interface Tally { games: number, wins: number, win_rate: number, pick_rate: number }

export interface BlitzBuildDoc {
  games: number
  win_rate: number
  pick_rate: number
  patch: string
  keystone: (Tally & { keystone_id: number, treeId: number })[]
  runes: (Tally & { runeId: number, treeId: number, index: number })[]
  shards: Record<'offenseShard' | 'flexShard' | 'defenseShard', (Tally & { shard_id: string })[]>
  summonerSpells: (Tally & { summonerSpellIds: number[] })[]
  startingItems: (Tally & { itemIds: (string | number)[] })[]
  coreItems: (Tally & { itemIds: string })[]
  itemsAfterCore: Record<string, Record<string, (Tally & { itemIds: number[] })[]>>
  skillOrders: (Tally & { skillOrder: number[] })[]
  /** Every item bought outside the core paths, boots included: its games and wins over the lane's games (`win_rate` comes as 0; `wins` is right). */
  situationalItems?: { itemId: number, games: number, wins: number, pick_rate: number }[]
  /** Each completed item's components in the order players buy them, most played first. */
  itemOrders?: Record<string, (Tally & { items_order: number[], pick_rate_rank?: number })[]>
  /** The playstyle the document's builds are tagged with (`["Bruiser", "Lethality"]`); Blitz names its build rows by them. */
  name_tags?: string[]
  build_id?: { primary_tags_f3pie?: string } | null
}

/** Builds kept per lane: the most played core paths, as many as TrueMain's page usually shows. */
const MAX_BUILDS = 4

/** Boots and their upgrades (the game's own group, `item-groups.ts`): a core path's boots are drawn apart from its items. */
export const isBoots = (itemId: number) => BOOTS.has(itemId)

export const most = <T extends { games: number }>(list: readonly T[] | undefined): T | undefined =>
  list?.reduce<T | undefined>((best, entry) => (best === undefined || entry.games > best.games ? entry : best), undefined)

const measured = (tally: Tally) => ({ games: tally.games, pickRate: tally.pick_rate, winRate: tally.win_rate })

function runePage(doc: BlitzBuildDoc): BuildRunePage | null {
  const keystone = most(doc.keystone)
  if (!keystone) return null
  const primary = keystone.treeId
  const row = (index: number) => most(doc.runes.filter(rune => rune.treeId === primary && rune.index === index))?.runeId ?? 0
  // Index 3 and 4 are the two secondary slots, any row of any other tree: the tree is the one most played there.
  const secondaryRunes = doc.runes.filter(rune => rune.index >= 3 && rune.treeId !== primary && rune.treeId !== 0)
  const byTree = new Map<number, number>()
  for (const rune of secondaryRunes) byTree.set(rune.treeId, (byTree.get(rune.treeId) ?? 0) + rune.games)
  const secondary = [...byTree].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
  const first = most(secondaryRunes.filter(rune => rune.treeId === secondary && rune.index === 3))
  const second = most(secondaryRunes.filter(rune => rune.treeId === secondary && rune.index === 4 && rune.runeId !== first?.runeId))
  const shard = (key: keyof BlitzBuildDoc['shards']) => Number(most(doc.shards?.[key])?.shard_id ?? 0)
  return {
    ...measured(keystone),
    primaryStyleId: primary,
    primaryKeystoneId: keystone.keystone_id,
    primaryPerk1Id: row(0),
    primaryPerk2Id: row(1),
    primaryPerk3Id: row(2),
    secondaryStyleId: secondary,
    secondaryPerk1Id: first?.runeId ?? 0,
    secondaryPerk2Id: second?.runeId ?? 0,
    statOffense: shard('offenseShard'),
    statFlex: shard('flexShard'),
    statDefense: shard('defenseShard'),
  }
}

/** Blitz's 18 skill points (1 Q … 4 R) as TrueMain's max order: the basic abilities by the level each gets its fifth point. */
export function maxOrder(points: readonly number[]): string[] {
  const letters = ['Q', 'W', 'E']
  const count = [0, 0, 0]
  const maxedAt = [Infinity, Infinity, Infinity]
  points.forEach((slot, level) => {
    const index = slot - 1
    if (index < 0 || index > 2) return
    count[index]! += 1
    if (count[index] === 5) maxedAt[index] = level
  })
  return [0, 1, 2].sort((a, b) => maxedAt[a]! - maxedAt[b]! || count[b]! - count[a]!).map(index => letters[index]!)
}

function skillOrder(doc: BlitzBuildDoc): BuildSkillOrder | null {
  const top = most(doc.skillOrders)
  return top ? { ...measured(top), sequence: maxOrder(top.skillOrder) } : null
}

function spells(doc: BlitzBuildDoc): BuildSummonerSpells | null {
  const top = most(doc.summonerSpells)
  if (!top || top.summonerSpellIds.length < 2) return null
  return { ...measured(top), spell1Id: top.summonerSpellIds[0]!, spell2Id: top.summonerSpellIds[1]! }
}

function starter(doc: BlitzBuildDoc): BuildItemSet | null {
  const top = most(doc.startingItems)
  return top ? { ...measured(top), itemIds: top.itemIds.map(Number) } : null
}

/** The boots the lane buys most, over every core path that carries a pair. */
function laneBoots(doc: BlitzBuildDoc): BuildItemSet | null {
  const byItem = new Map<number, Tally>()
  for (const core of doc.coreItems) {
    for (const id of core.itemIds.split(',').map(Number).filter(isBoots)) {
      const known = byItem.get(id)
      byItem.set(id, known ? { ...known, games: known.games + core.games, wins: known.wins + core.wins } : { ...core })
    }
  }
  const best = [...byItem].sort((a, b) => b[1].games - a[1].games)[0]
  if (!best) return null
  const [id, tally] = best
  return { itemIds: [id], games: tally.games, pickRate: doc.games > 0 ? tally.games / doc.games : 0, winRate: tally.games > 0 ? tally.wins / tally.games : 0 }
}

/**
 * A core path as TrueMain's tree: the nodes *after* the first item — the view draws
 * `firstItemId` as the root itself — chained, the first follow-ups off the last item.
 */
function treeOf(path: number[], core: BlitzBuildDoc['coreItems'][number], after: BlitzBuildDoc['itemsAfterCore'][string] | undefined): BuildTreeNode[] {
  const followUps: BuildTreeNode[] = (after?.['1'] ?? [])
    .slice(0, 4)
    .map(option => ({ itemId: option.itemIds[0]!, games: option.games, wins: option.wins, pickRate: core.games > 0 ? option.games / core.games : 0, children: [] }))
  return path.slice(1).reduceRight<BuildTreeNode[]>((children, itemId) => [{
    itemId,
    games: core.games,
    wins: core.wins,
    pickRate: 1,
    children,
  }], followUps)
}

/**
 * Cores that buy the same items and the same boots, the boots at another
 * point (`6692,3047,6610` and `3047,6692,6610`), are one build once the boots
 * are drawn apart: their games and wins are summed, most played first.
 */
function mergeByPath(cores: BlitzBuildDoc['coreItems']): BlitzBuildDoc['coreItems'] {
  const merged = new Map<string, BlitzBuildDoc['coreItems'][number]>()
  for (const core of cores) {
    const ids = core.itemIds.split(',').map(Number)
    const key = `${ids.filter(id => !isBoots(id)).join(',')}|${ids.filter(isBoots).join(',')}`
    const known = merged.get(key)
    if (!known) {
      merged.set(key, { ...core })
      continue
    }
    const games = known.games + core.games
    const wins = known.wins + core.wins
    // The most played order names the merged core.
    merged.set(key, { ...(core.games > known.games ? core : known), games, wins, win_rate: games > 0 ? wins / games : 0, pick_rate: known.pick_rate + core.pick_rate })
  }
  return [...merged.values()].sort((a, b) => b.games - a.games)
}

export function buildsFromBlitz(championId: number, position: string, doc: BlitzBuildDoc | undefined): ChampionBuildResponse {
  if (!doc) return { championId, patch: null, position, totalGames: 0, builds: [] }
  const page = runePage(doc)
  const shared = { starterItems: starter(doc), summonerSpells: spells(doc), skillOrder: skillOrder(doc), runePage: page }
  const bootsOfLane = laneBoots(doc)
  const builds: ChampionBuild[] = mergeByPath(doc.coreItems)
    .slice(0, MAX_BUILDS)
    .flatMap((core) => {
      const ids = core.itemIds.split(',').map(Number)
      const path = ids.filter(id => !isBoots(id))
      const boots = ids.find(isBoots)
      if (path.length === 0) return []
      const key = [...ids].sort((a, b) => a - b).join(',')
      return [{
        firstItemId: path[0]!,
        buildTree: treeOf(path, core, doc.itemsAfterCore?.[key]),
        primaryKeystoneId: page?.primaryKeystoneId ?? 0,
        ...measured(core),
        core: {
          ...shared,
          itemPath: { itemIds: path, ...measured(core) },
          boots: boots ? { itemIds: [boots], ...measured(core) } : bootsOfLane,
        },
      }]
    })
  return { championId, patch: doc.patch ?? null, position, totalGames: doc.games, builds }
}

/** The lane's rows read this session, by `champion:position:opponent:otp`: the build views and the Blitz panel share one read. */
const rows = new Map<string, Promise<BlitzBuildDoc[]>>()

/**
 * Every document Blitz answers for a champion's lane: one per playstyle its
 * builds are tagged with (`name_tags`: Bruiser, Lethality, AD…), each a whole
 * document of its own. `otp` reads the one-tricks' games instead — Blitz
 * drops the build tier for those (`is_otp=true` with `build_tier` answers no
 * row at all).
 */
export function readBlitzBuildRows(championId: number, position: string, opponentChampionId: number | null = null, otp = false): Promise<BlitzBuildDoc[]> {
  const key = `${championId}:${position}:${opponentChampionId ?? ''}:${otp ? 'otp' : ''}`
  let read = rows.get(key)
  if (!read) {
    read = blitzRows<BlitzBuildDoc>('champion_builds_tags', {
      champion_id: championId,
      queue_id: SOLO_QUEUE,
      build_tier: otp ? undefined : 'Standard',
      is_otp: otp ? 'true' : undefined,
      individual_position: blitzRole(position),
      match_up_champion_id: opponentChampionId,
    })
    // A failed read is not kept: the next view asks again.
    read.catch(() => rows.delete(key))
    keepBounded(rows, key, read)
  }
  return read
}

/** Blitz's whole document for a champion's lane — every option it measured, not just the most played: its most played playstyle's. */
export function readBlitzBuildDoc(championId: number, position: string, opponentChampionId: number | null = null): Promise<BlitzBuildDoc | undefined> {
  return readBlitzBuildRows(championId, position, opponentChampionId).then(list => most(list))
}
