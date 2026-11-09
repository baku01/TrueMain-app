import type { BlitzBuildDoc, Tally } from '~/utils/blitz/builds'
import { isBoots, maxOrder } from '~/utils/blitz/builds'
import { STARTER_LINE } from '~/utils/item-groups'
import { questRewardsOf } from '~/utils/support-quest'

/**
 * Every choice Blitz measured on a lane, ranked, for the Blitz build panel
 * (`BuildSourcePanel`): what the reference client shows as several rune pages,
 * spell pairs, starters, cores, boots and skill orders, each with its share of
 * the lane's games and its win rate. Shares are of the lane's games
 * (`doc.games`) throughout, except a follow-up item's, which is of the games of
 * the core it follows.
 */
export interface Measure { games: number, pickRate: number, winRate: number }

export interface ItemOption extends Measure { itemIds: number[] }
export interface SpellOption extends Measure { spellIds: number[] }
export interface SkillOption extends Measure { points: number[], order: string[], opening: string[] }
export interface KeystoneOption extends Measure { keystoneId: number, styleId: number }

const share = (tally: Tally, total: number): Measure => ({
  games: tally.games,
  pickRate: total > 0 ? tally.games / total : 0,
  winRate: tally.games > 0 ? tally.wins / tally.games : tally.win_rate,
})

const top = <T extends { games: number }>(list: readonly T[] | undefined, count: number) =>
  [...(list ?? [])].sort((a, b) => b.games - a.games).slice(0, count)

export const keystoneOptions = (doc: BlitzBuildDoc, count = 3): KeystoneOption[] =>
  top(doc.keystone, count).map(entry => ({ ...share(entry, doc.games), keystoneId: entry.keystone_id, styleId: entry.treeId }))

export const spellOptions = (doc: BlitzBuildDoc, count = 3): SpellOption[] =>
  top(doc.summonerSpells, count).map(entry => ({ ...share(entry, doc.games), spellIds: entry.summonerSpellIds }))

export const starterOptions = (doc: BlitzBuildDoc, count = 3): ItemOption[] =>
  top(doc.startingItems, count).map(entry => ({ ...share(entry, doc.games), itemIds: entry.itemIds.map(Number) }))

export const coreOptions = (doc: BlitzBuildDoc, count = 5): ItemOption[] =>
  top(doc.coreItems, count).map(entry => ({ ...share(entry, doc.games), itemIds: entry.itemIds.split(',').map(Number) }))

/**
 * The boots players buy, most bought first, each one's share of the games
 * that bought boots and its win rate there. Read from Blitz's items outside
 * the cores, where every game's boots are counted (its own client reads them
 * there); the core paths alone hold boots in the few games whose first items
 * included them, which gave each pair a share of a few per cent.
 */
export function bootsOptions(doc: BlitzBuildDoc, count = 3): ItemOption[] {
  const bought = (doc.situationalItems ?? []).filter(entry => isBoots(entry.itemId) && entry.itemId !== 1001 && entry.games > 0)
  const total = bought.reduce((sum, entry) => sum + entry.games, 0)
  if (total > 0) {
    return [...bought].sort((a, b) => b.games - a.games).slice(0, count)
      .map(entry => ({ itemIds: [entry.itemId], games: entry.games, pickRate: entry.games / total, winRate: entry.wins / entry.games }))
  }
  return bootsFromCores(doc, count)
}

/**
 * Every item bought outside the core paths, boots included, each with its
 * share of the lane's games and its win rate: Blitz sends `win_rate` as 0, so
 * the rate is read from the wins.
 */
const outsideCores = (doc: BlitzBuildDoc): ItemOption[] =>
  (doc.situationalItems ?? []).filter(entry => entry.games > 0)
    .map(entry => ({ itemIds: [entry.itemId], games: entry.games, pickRate: doc.games ? entry.games / doc.games : 0, winRate: entry.wins / entry.games }))

/** The support quest's line and the jungle pets apart (`STARTER_LINE`): bought at the start or picked, never a choice later. */
export const situationalOptions = (doc: BlitzBuildDoc): ItemOption[] =>
  outsideCores(doc).filter(option => !STARTER_LINE.has(option.itemIds[0]!))

/** The support quest's rewards picked (`utils/support-quest`), which Blitz counts among the items outside the cores. */
export const questRewardOptions = (doc: BlitzBuildDoc): ItemOption[] => questRewardsOf(outsideCores(doc), doc.individual_position === 'SUPPORT')

/** Boots over every core path that carries a pair and every follow-up that is one: the reading when Blitz lists no items outside the cores. */
function bootsFromCores(doc: BlitzBuildDoc, count: number): ItemOption[] {
  const byItem = new Map<number, Tally>()
  const add = (id: number, tally: Tally) => {
    const known = byItem.get(id)
    byItem.set(id, known ? { ...known, games: known.games + tally.games, wins: known.wins + tally.wins } : { ...tally })
  }
  for (const core of doc.coreItems) {
    for (const id of core.itemIds.split(',').map(Number).filter(isBoots)) add(id, core)
  }
  for (const slots of Object.values(doc.itemsAfterCore ?? {})) {
    for (const options of Object.values(slots)) {
      for (const option of options) {
        const id = option.itemIds.at(-1)
        if (id !== undefined && isBoots(id)) add(id, option)
      }
    }
  }
  return [...byItem].sort((a, b) => b[1].games - a[1].games).slice(0, count).map(([id, tally]) => ({ ...share(tally, doc.games), itemIds: [id] }))
}

/**
 * What follows a core path, slot by slot — the fourth, fifth and sixth item —
 * each option's share of that core's games. Blitz keys the follow-ups by the
 * core's items in ascending order, and measures the fifth and sixth item as
 * sets of the items bought after the core, ids ascending (`[3053, 6333]`: the
 * fourth and the fifth, in no order). So the slots are read as a path: the
 * fifth item's options are the pairs holding the fourth item most bought,
 * each named by the item it adds; the sixth's, the trios holding both. No
 * item repeats along the path.
 */
export function followUpOptions(doc: BlitzBuildDoc, core: ItemOption, count = 4): { slot: number, options: ItemOption[] }[] {
  const after = doc.itemsAfterCore?.[[...core.itemIds].sort((a, b) => a - b).join(',')]
  if (!after) return []
  const groups: { slot: number, options: ItemOption[] }[] = []
  const path: number[] = []
  for (const slot of ['1', '2', '3']) {
    const sets = (after[slot] ?? []).filter(entry =>
      entry.itemIds.length === path.length + 1 && path.every(id => entry.itemIds.includes(id)))
    const options = top(sets, count).map(entry => ({ ...share(entry, core.games), itemIds: [entry.itemIds.find(id => !path.includes(id))!] }))
    if (!options.length) break
    groups.push({ slot: Number(slot) + 3, options })
    path.push(options[0]!.itemIds[0]!)
  }
  return groups
}

export const skillOptions = (doc: BlitzBuildDoc, count = 3): SkillOption[] =>
  top(doc.skillOrders, count).map(entry => ({
    ...share(entry, doc.games),
    points: entry.skillOrder,
    order: maxOrder(entry.skillOrder),
    // Orders that max alike differ in their first levels: the first three points tell them apart.
    opening: entry.skillOrder.slice(0, 3).map(slot => 'QWER'[slot - 1] ?? '?'),
  }))

/**
 * Each rune's share on the lane, by rune id: the primary rows (index 0–2) of
 * the keystone's tree, and the two secondary slots (index 3–4) of every other
 * tree, summed — a rune can sit in either slot. The secondary tree is the one
 * those slots were spent in most.
 */
export function runeShares(doc: BlitzBuildDoc, primaryStyleId: number) {
  const primary = new Map<number, Measure>()
  const secondaryByRune = new Map<number, Tally>()
  const secondaryByTree = new Map<number, number>()
  for (const rune of doc.runes) {
    if (rune.treeId === primaryStyleId && rune.index <= 2) {
      primary.set(rune.runeId, share(rune, doc.games))
    }
    else if (rune.index >= 3 && rune.treeId !== primaryStyleId && rune.treeId !== 0) {
      const known = secondaryByRune.get(rune.runeId)
      secondaryByRune.set(rune.runeId, known ? { ...known, games: known.games + rune.games, wins: known.wins + rune.wins } : { ...rune })
      secondaryByTree.set(rune.treeId, (secondaryByTree.get(rune.treeId) ?? 0) + rune.games)
    }
  }
  const secondaryStyleId = [...secondaryByTree].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
  // Each secondary pick fills one of two slots: a rune's share is of the lane's games, so a slot pair sums to two.
  const secondary = new Map([...secondaryByRune].map(([id, tally]) => [id, share(tally, doc.games)]))
  const shards = (['offenseShard', 'flexShard', 'defenseShard'] as const).map(row =>
    new Map((doc.shards?.[row] ?? []).map((entry: Tally & { shard_id: string }) => [Number(entry.shard_id), share(entry, doc.games)])))
  return { primary, secondary, secondaryStyleId, shards }
}
