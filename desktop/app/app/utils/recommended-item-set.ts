import type { StaticItemData } from '#shared/types/static-data'
import type { DraftItemBlock, PlaceItemBlock, PlaceMeasures } from '~/utils/item-set'
import { tr } from '#common/utils/i18n'
import { isBoots } from '~/utils/blitz/builds'
import { measuredPlaces } from '~/utils/item-set'
import { isQuestReward } from '~/utils/support-quest'

/**
 * The automatic import's item sets, laid out block for block the way Blitz
 * writes its own into the game's `Config/Global/Recommended` (read from
 * Blitz's client): starting items, the core build's buying order — each of
 * the first three items' components in the order players buy them, then the
 * item —, the final build, for a Jev build the items that answer each need of
 * the enemy team (Blitz's and ABSOL's sets carry such blocks), the situational
 * items, the boots options, then each place of the buying order with the
 * items to choose from there (the boots' join the boots options). One set
 * per build the draft offers, the selected one first (`write_recommended_item_sets`).
 */

/** One build as the draft offers it, in the item set's terms. */
export interface ImportBuild {
  /** The build's row in the list (`draft`, `lane-…`, `pro`, a kit's id): a new one is a new import. */
  key: string
  /** What the set is called in the shop, after "TrueMain " (`Aatrox vs Akali`). */
  title: string
  starter: number[]
  /** The completed items in buying order, boots apart. */
  path: number[]
  boots: number[]
  situational: number[]
  /** How many of the path's items come before the boots, as the build buys them; second by default. */
  bootsAt?: number
  /** A support's quest reward to pick (`utils/support-quest`): its own block after the starting items, never in the buying order. */
  questReward?: number[]
  /** A block per need of the enemy team, after the final build (`utils/jev-optionals` `draftBlocks`). */
  draft?: DraftItemBlock[]
  /**
   * Each place of the buying order with the items to choose from there, a
   * block each after the others (`PlaceItemBlock`); none asked for when an
   * empty list — a kit's set, its author's own.
   */
  places?: PlaceItemBlock[]
}

/**
 * A build with its place blocks: its own (a Jev build's, from its slots; none
 * for a kit's), else the lane's measures at each place of its path
 * (`measuredPlaces`) — a build of the sources, a pro's.
 */
export function withMeasuredPlaces<T extends ImportBuild>(build: T, measures: PlaceMeasures | null): T {
  if (build.places || !measures) return build
  return { ...build, places: measuredPlaces(build.path, build.boots, measures) }
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

export interface BlockTitles {
  starting: string
  order: string
  final: string
  situational: string
  boots: string
  /** The support quest's reward block. */
  quest?: string
  /** A need's block: what it answers, the enemies behind it. */
  against?: (block: DraftItemBlock) => string
  /** A place's block: the completed item's place, 1 the first. */
  place?: (place: number) => string
}

/** The longest block title the shop shows whole (`lcu::item_sets` `MAX_BLOCK_TITLE`). */
const TITLE = 40

/**
 * A need's block title within `TITLE` characters: what it answers, then as
 * many of the enemies behind it as fit, the rest counted (`Contra dano mágico
 * — Ekko, Anivia +2`); the need alone where none fits.
 */
export function againstTitle(head: string, names: string[]): string {
  for (let shown = names.length; shown > 0; shown--) {
    const more = names.length - shown
    const title = `${head} — ${names.slice(0, shown).join(', ')}${more ? ` +${more}` : ''}`
    if (title.length <= TITLE) return title
  }
  return head
}

/** The blocks' titles in the app's language, Blitz's own words. */
export const blockTitles = (): BlockTitles => ({
  starting: tr('autoImport.block.starting'),
  order: tr('autoImport.block.order'),
  final: tr('autoImport.block.final'),
  situational: tr('autoImport.block.situational'),
  boots: tr('autoImport.block.boots'),
  quest: tr('autoImport.block.quest'),
  against: block => againstTitle(tr(`autoImport.block.against.${block.need}`), block.names),
  place: place => tr('autoImport.block.place', { n: place }),
})

/** The basic boots, left out of the buying order when the starter already holds boots. */
const BASIC_BOOTS = 1001
/** The support quest's upgraded stage, never bought. */
const SUPPORT_UPGRADE = 3867
/** How many items the final build lists, boots included. */
const FINAL = 6
const SITUATIONAL = 7
/** The most blocks a set carries, as a kit's (`lcu::item_sets` `MAX_BLOCKS`): the last places give way. */
const MAX_BLOCKS = 16

/** An item's components when no order is measured: its recipe, the dearer first (Blitz's own fallback). */
export function componentsOf(itemId: number, items: Record<number, StaticItemData>): number[] {
  return (items[itemId]?.from ?? [])
    .map(id => items[id])
    .filter((item): item is StaticItemData => Boolean(item))
    .sort((a, b) => b.totalGold - a.totalGold)
    .map(item => item.id)
}

/** The final build: the path with the boots where it buys them (second by default), filled up to six from the situational items. */
export function finalBuild(build: ImportBuild): number[] {
  const path = build.path.filter(id => !isBoots(id))
  const list = [...path]
  if (build.boots[0] !== undefined) list.splice(Math.min(build.bootsAt ?? 1, list.length), 0, build.boots[0])
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
  // A quest's reward, wherever the build wrote it, is picked, not bought: its own block, out of the starting items.
  const reward = [...new Set(known([...(build.questReward ?? []), ...build.starter.filter(isQuestReward)]))].slice(0, 1)
  const starter = [...new Set(known(build.starter.filter(id => !isQuestReward(id))))]
  const final = known(finalBuild(build))
  const draft = (build.draft ?? []).map(entry => block(titles.against?.(entry) ?? entry.need, [...new Set(known(entry.items))]))
  const answering = new Set((build.draft ?? []).flatMap(entry => entry.items))
  const situational = known(build.situational).filter(id => !final.includes(id) && !answering.has(id) && !isBoots(id)).slice(0, SITUATIONAL)
  const places = build.places ?? []
  // The boots to choose from, the basic pair apart: a step on the way, not a choice (Ashe's 1.4 % of boots bought).
  const bootsOptions = (places.find(entry => entry.place === 0)?.items ?? []).filter(id => id !== BASIC_BOOTS)
  const choices = places
    .filter(entry => entry.place > 0)
    .map(entry => block(titles.place?.(entry.place) ?? String(entry.place), [...new Set(known(entry.items))]))
    .filter(entry => entry.items.length > 1)
  const blocks = [
    block(titles.starting, starter),
    block(titles.quest ?? 'Quest reward', reward),
    block(titles.order, known(buyingOrder(final, starter, items, orders))),
    block(titles.final, final),
    ...draft,
    block(titles.situational, situational),
    block(titles.boots, [...new Set(known([...build.boots, ...bootsOptions]))]),
    ...choices,
  ].filter(entry => entry.items.length > 0).slice(0, MAX_BLOCKS)
  return { title: `TrueMain ${build.title}`, championKey, map: 'any', mode: 'any', type: 'custom', blocks }
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
