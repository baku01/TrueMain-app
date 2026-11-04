import type { StaticItemData } from '#shared/types/static-data'
import { isBoots } from '~/utils/blitz/builds'

/**
 * The automatic import's item sets, laid out block for block the way Blitz
 * writes its own into the game's `Config/Global/Recommended` (read from
 * Blitz's client): starting items, the core build's buying order — each of
 * the first three items' components in the order players buy them, then the
 * item —, the final build, the situational items, the boots options. One set
 * per build the draft offers, the selected one first (`write_recommended_item_sets`).
 */

/** One build as the draft offers it, in the item set's terms. */
export interface ImportBuild {
  /** The build's row in the list (`draft`, `lane-…`, `pro`, a kit's id): a new one is a new import. */
  key: string
  /** What the set is called in the shop, after "TrueMain: ". */
  title: string
  starter: number[]
  /** The completed items in buying order, boots apart. */
  path: number[]
  boots: number[]
  situational: number[]
}

/** How a component path is measured: Blitz's `itemOrders`, per completed item, most played first. */
export type ItemOrders = Record<string, { items_order: number[], pick_rate_rank?: number, games: number }[]>

export interface RecommendedBlock {
  recMath: false
  minSummonerLevel: -1
  maxSummonerLevel: -1
  showIfSummonerSpell: ''
  hideIfSummonerSpell: ''
  type: string
  items: { id: string, count: 1 }[]
}

export interface RecommendedSet {
  title: string
  championKey: string
  map: 'any'
  mode: 'any'
  type: 'custom'
  blocks: RecommendedBlock[]
}

export interface BlockTitles { starting: string, order: string, final: string, situational: string, boots: string }

/** The basic boots, left out of the buying order when the starter already holds boots. */
const BASIC_BOOTS = 1001
/** The support quest's upgraded stage, never bought. */
const SUPPORT_UPGRADE = 3867
/** How many items the final build lists, boots included. */
const FINAL = 6
const SITUATIONAL = 7

/** An item's components when no order is measured: its recipe, the dearer first (Blitz's own fallback). */
export function componentsOf(itemId: number, items: Record<number, StaticItemData>): number[] {
  return (items[itemId]?.from ?? [])
    .map(id => items[id])
    .filter((item): item is StaticItemData => Boolean(item))
    .sort((a, b) => b.totalGold - a.totalGold)
    .map(item => item.id)
}

/** The final build: the path with the boots second, filled up to six from the situational items. */
export function finalBuild(build: ImportBuild): number[] {
  const path = build.path.filter(id => !isBoots(id))
  const list = [...path]
  if (build.boots[0] !== undefined) list.splice(Math.min(1, list.length), 0, build.boots[0])
  for (const id of build.situational) {
    if (list.length >= FINAL) break
    if (!list.includes(id) && !isBoots(id)) list.push(id)
  }
  return list.slice(0, FINAL)
}

/**
 * The buying order of the first three items of the final build: each one's
 * components as players buy them (the measured order, else the recipe), then
 * the item. What the starter already holds is not bought again at the start.
 */
export function buyingOrder(final: number[], starter: number[], items: Record<number, StaticItemData>, orders: ItemOrders | null): number[] {
  const sequence: number[] = []
  for (const itemId of final.slice(0, 3)) {
    if (!items[itemId]) continue
    const measured = orders?.[String(itemId)]?.slice().sort((a, b) => (a.pick_rate_rank ?? 99) - (b.pick_rate_rank ?? 99) || b.games - a.games)[0]
    sequence.push(...(measured?.items_order.map(Number) ?? componentsOf(itemId, items)), itemId)
  }
  const held = new Set(starter)
  const starterBoots = starter.some(isBoots)
  return sequence.filter((itemId, index) => {
    if (starterBoots && itemId === BASIC_BOOTS) return false
    if (itemId === SUPPORT_UPGRADE) return false
    return !(index < 2 && held.has(itemId))
  })
}

const block = (type: string, ids: number[]): RecommendedBlock => ({
  recMath: false,
  minSummonerLevel: -1,
  maxSummonerLevel: -1,
  showIfSummonerSpell: '',
  hideIfSummonerSpell: '',
  type,
  items: ids.map(id => ({ id: String(id), count: 1 })),
})

/** One build's set; a block with nothing in it is left out. */
export function recommendedSet(build: ImportBuild, championKey: string, titles: BlockTitles, items: Record<number, StaticItemData>, orders: ItemOrders | null): RecommendedSet {
  const known = (ids: number[]) => ids.filter(id => id in items)
  const starter = [...new Set(known(build.starter))]
  const final = known(finalBuild(build))
  const situational = known(build.situational).filter(id => !final.includes(id) && !isBoots(id)).slice(0, SITUATIONAL)
  const blocks = [
    block(titles.starting, starter),
    block(titles.order, known(buyingOrder(final, starter, items, orders))),
    block(titles.final, final),
    block(titles.situational, situational),
    block(titles.boots, [...new Set(known(build.boots))]),
  ].filter(entry => entry.items.length > 0)
  return { title: `TrueMain: ${build.title}`, championKey, map: 'any', mode: 'any', type: 'custom', blocks }
}

/** Every build's set, the selected first; two builds whose blocks read the same are written once. */
export function recommendedSets(selected: ImportBuild, others: ImportBuild[], championKey: string, titles: BlockTitles, items: Record<number, StaticItemData>, orders: ItemOrders | null): RecommendedSet[] {
  const seen = new Set<string>()
  return [selected, ...others.filter(build => build.key !== selected.key)]
    .map(build => recommendedSet(build, championKey, titles, items, orders))
    .filter((set) => {
      const key = JSON.stringify(set.blocks)
      if (set.blocks.length === 0 || seen.has(key)) return false
      seen.add(key)
      return true
    })
}
