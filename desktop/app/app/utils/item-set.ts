import type { ChampionItemContextItem } from '#shared/types/item-context'
import type { Kit } from '#shared/types/kit'
import type { BuildCoreView, BuildTreeNode } from '~/types/build'
import type { Needs } from '~/utils/jev-needs'
import { tr } from '#common/utils/i18n'
import { isBoots } from '~/utils/blitz/builds'
import { MIN_GAMES, PLACE_SHARE } from '~/utils/jev-build'
import { kitPaths } from '~/utils/kit-tree'

/**
 * One need of the enemy team as a block of the set (`utils/jev-optionals`
 * `draftBlocks`): the champion's items that answer it, the enemies behind it
 * named. Its title is written at import time, in the app's language
 * (`utils/recommended-item-set` `blockTitles`).
 */
export interface DraftItemBlock {
  need: keyof Needs
  names: string[]
  items: number[]
}

/**
 * One place of the buying order as a block of the set: the item the build
 * takes there, then up to `PLACE_ALTERNATIVES` others its players buy there
 * instead — at the third item, Phantom Dancer and three more to choose from.
 * Place 0 is the boots, whose options join the boots block; 1 the first
 * completed item.
 */
export interface PlaceItemBlock {
  place: number
  items: number[]
}

/** How many items a place's block offers besides the build's own. */
export const PLACE_ALTERNATIVES = 3

/**
 * What players buy at each place of a lane's builds, each item's games there
 * (`placeGames`: lolalytics' item1 to item5 and Blitz's item slots pooled),
 * and the boots they buy.
 */
export interface PlaceMeasures {
  boots: Map<number, number>
  places: Map<number, number>[]
}

/**
 * A measured build's place blocks (`PlaceItemBlock`) from what the lane's
 * players buy at each place (`PlaceMeasures`), with the board's bars: an
 * alternative seen in `MIN_GAMES` games and `PLACE_SHARE` of the place's
 * games, most played first, none the build bought at an earlier place. A
 * place with no alternative is left out.
 */
export function measuredPlaces(path: number[], boots: number[], measures: PlaceMeasures): PlaceItemBlock[] {
  const items = path.filter(id => !isBoots(id))
  const optionsAt = (taken: number, games: Map<number, number> | undefined, held: number[]) => {
    const total = [...(games ?? new Map<number, number>()).values()].reduce((sum, count) => sum + count, 0)
    const others = [...(games ?? [])]
      .filter(([id, count]) => id !== taken && !held.includes(id) && count >= MIN_GAMES && count >= total * PLACE_SHARE)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
    return [taken, ...others.slice(0, PLACE_ALTERNATIVES)]
  }
  return [
    ...(boots[0] !== undefined ? [{ place: 0, items: optionsAt(boots[0], measures.boots, []) }] : []),
    ...items.map((id, index) => ({ place: index + 1, items: optionsAt(id, measures.places[index], items.slice(0, index)) })),
  ].filter(entry => entry.items.length > 1)
}

/**
 * What the item set import lays out (`utils/recommended-item-set`): the
 * build's items by block, in the order the shop shows them. A block left
 * empty is not written — nothing here pads one.
 */
export interface ItemSetBuild {
  starter: number[]
  boots: number[]
  core: number[]
  situational: number[]
  /** How many core items come before the boots, as the build buys them; second by default. */
  bootsAt?: number
  /** "Optional by the draft": a block per need of the enemy team (Jev's builds). */
  draft?: DraftItemBlock[]
  /** Each place of the buying order with the items to choose from there (`PlaceItemBlock`). */
  places?: PlaceItemBlock[]
}

/**
 * The build's situational items from the item context (#1450): the completed
 * items whose verdict is `Situational`, most picked first, the core path left
 * out. An item judged on several branches appears once, at its best rate.
 */
export function situationalFromContext(items: ChampionItemContextItem[], core: number[]): number[] {
  const best = new Map<number, number>()
  for (const item of items) {
    if (item.slot !== 'Build' || item.class !== 'Situational' || core.includes(item.itemId)) continue
    best.set(item.itemId, Math.max(best.get(item.itemId) ?? 0, item.pickRate))
  }
  return [...best.entries()].sort((a, b) => b[1] - a[1]).map(([itemId]) => itemId)
}

/**
 * The fallback when the slice has no verdicts: what else the build tree went
 * to at each step of the core path — the path's siblings — most played first.
 * `tree` holds what followed the first item, which `path` starts with.
 */
export function situationalFromTree(tree: BuildTreeNode[], path: number[]): number[] {
  const games = new Map<number, number>()
  let level = tree
  for (const step of path.slice(1)) {
    for (const node of level) {
      if (node.itemId !== step && !path.includes(node.itemId)) {
        games.set(node.itemId, (games.get(node.itemId) ?? 0) + node.games)
      }
    }
    const next = level.find(node => node.itemId === step)
    if (!next) break
    level = next.children
  }
  return [...games.entries()].sort((a, b) => b[1] - a[1]).map(([itemId]) => itemId)
}

/**
 * The set's blocks from the build on screen, every id checked against the
 * patch's items: one the game no longer has would sit in the shop as an empty
 * slot.
 */
export function itemSetBuild(core: BuildCoreView, situational: number[], known: (itemId: number) => boolean): ItemSetBuild {
  const keep = (ids: number[] | undefined) => (ids ?? []).filter(known)
  return {
    starter: keep(core.starterItems?.itemIds),
    boots: keep(core.boots?.itemIds),
    core: keep(core.itemPath?.itemIds),
    situational: keep(situational),
  }
}

/** Whether the set would have anything in it. */
export function hasItems(build: ItemSetBuild): boolean {
  return build.starter.length + build.boots.length + build.core.length + build.situational.length + (build.draft ?? []).reduce((sum, block) => sum + block.items.length, 0) > 0
}

/** One titled block of a kit's set (`lcu::item_sets::NamedBlock`). */
export interface NamedItemBlock {
  title: string
  items: number[]
}

/**
 * A kit's set (#2185): the starter and the boots first, then one block per
 * path of its tree, the default path first and titled "Core" when it is the
 * only one; with branches each block is named by the item it ends on. Ids
 * the patch does not know are dropped, as for a build's set.
 */
export function kitItemSetBlocks(kit: Kit, name: (itemId: number) => string, known: (itemId: number) => boolean): NamedItemBlock[] {
  const keep = (ids: number[]) => ids.filter(known)
  const paths = kitPaths(kit.tree).map(keep).filter(path => path.length > 0)
  const titleOf = (path: number[], index: number) => {
    if (paths.length === 1) return tr('kit.itemSet.core')
    const label = index === 0 ? tr('kit.itemSet.core') : tr('kit.itemSet.path', { n: index + 1 })
    return `${label} · ${name(path.at(-1)!)}`
  }
  return [
    { title: tr('kit.itemSet.starter'), items: keep(kit.starter) },
    { title: tr('kit.itemSet.boots'), items: keep(kit.boots) },
    ...paths.map((path, index) => ({ title: titleOf(path, index), items: path })),
  ].filter(block => block.items.length > 0)
}
