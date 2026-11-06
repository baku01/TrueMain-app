import type { BuildItemSet, BuildRunePage, BuildSkillOrder, BuildSummonerSpells } from '#shared/types/champions'
import type { BuildOptions, ItemOption, Measure, RunePageIds } from '~/utils/sources/model'
import type { ItemStat } from '~/utils/blitz/item-stats'
import type { ItemMeasure } from '~/utils/jev-item-stats'
import { isBoots } from '~/utils/blitz/builds'
import { STARTER_LINE, fitsWith } from '~/utils/item-groups'
import { buysBoots } from '~/utils/sources/model'

/**
 * The Jev matchup page's build, its structure: every choice of a build — rune
 * page, summoner spells, starter, skill order, boots and when to buy them,
 * the core item by item and each item after it — as a slot of options, every
 * option one lolalytics and Blitz measured players of the champion building on
 * the lane (their games pooled), with its measures: games, pick rate, win
 * rate, and what Blitz measures each item adds to the win probability.
 *
 * What Jev reads of them (`utils/jev-read`) and how they are ranked
 * (`utils/jev-recommend`) live apart: this file holds no judgment.
 */

/** What Blitz measured of its items (win probability added) is `ItemMeasure`, set by `withItemStats` (`utils/jev-item-stats`). */
export interface JevOption extends Measure, ItemMeasure {
  /** The option's key in its slot (`o0`, `o1`…): `o0` is the most played. */
  key: string
  label: string
  itemIds: number[]
  spellIds?: number[]
  page?: RunePageIds
  order?: string[]
  /** For a skill order: the first three levels, which tell apart orders that max alike. */
  opening?: string[]
  /** For the boots' timing: how many core items come before the boots. */
  after?: number
  /** Not measured in this slot: added from the champion's measured items because it answers the draft. */
  situational?: boolean
}

export type SlotKind = 'runes' | 'spells' | 'starter' | 'skills' | 'boots' | 'timing' | 'item'

export interface JevSlot {
  name: string
  kind: SlotKind
  /** Bought or set while laning: the lane opponent weighs on it as much as the team. */
  lane: boolean
  options: JevOption[]
}

const measured = <T extends Measure>(option: T): Measure => ({ games: option.games, pickRate: option.pickRate, winRate: option.winRate })
const keyed = <T>(list: T[], count: number, shape: (option: T) => Omit<JevOption, 'key'>): JevOption[] =>
  list.slice(0, count).map((option, index) => ({ key: `o${index}`, ...shape(option) }))

/** Under this many games an option is a rumour: a slot keeps it only to have two to compare. */
export const MIN_GAMES = 30

/** The options seen often enough to judge, most played first; the two most played whatever their games. */
export function reliable<T extends Measure>(list: T[]): T[] {
  const sorted = [...list].sort((a, b) => b.games - a.games)
  const kept = sorted.filter(option => option.games >= MIN_GAMES)
  return kept.length >= 2 ? kept : sorted.slice(0, 2)
}

export interface Names {
  item: (id: number) => string
  perk: (id: number) => string
  style: (id: number) => string
  spell: (id: number) => string
}

const plain = (html: string | undefined) => (html ?? '').replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/(, )+/g, ', ').replace(/^, |, $/g, '').trim()
const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** An item's stats and effects as words, out of Data Dragon's description: what Jev reads an item by. */
export function itemEffect(item: { description?: string, plaintext?: string } | undefined, max = 420): string {
  if (!item) return ''
  const description = item.description ?? ''
  const stats = plain(/<stats>([\s\S]*?)<\/stats>/i.exec(description)?.[1])
  const rest = plain(description.replace(/<stats>[\s\S]*?<\/stats>/i, ''))
  return cut([stats && `Stats: ${stats}.`, rest, item.plaintext ? plain(item.plaintext) : ''].filter(Boolean).join(' '), max)
}

/** Plain text of an ability's or a rune's description (Data Dragon writes tags into it), cut to `max` characters. */
export function plainAbility(text: string | undefined, max: number): string {
  return cut((text ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), max)
}

/** The items a build chooses: neither the boots, drawn apart, nor the starting item that grows by itself (`STARTER_LINE`). */
const chosen = (id: number) => !isBoots(id) && !STARTER_LINE.has(id)
const pathOf = (core: ItemOption) => core.itemIds.filter(chosen)

/** Six item slots; the starting item that grows by itself (a support's World Atlas, a jungle pet) keeps one. */
export const INVENTORY = 6
export const roomFor = (starter: number[]) => INVENTORY - (starter.some(id => STARTER_LINE.has(id)) ? 1 : 0)

/**
 * The starting sets as choices: sets that differ only by potions or wards are
 * one start (Doran's Blade, with or without a Health Potion), their games
 * added up, shown as the most played of them. A set of consumables alone is a
 * source leaving the starting item out (Blitz records a support's World Atlas
 * as nothing), not a start, while another set holds an item; and where the
 * most played start holds the item that grows (a support's World Atlas, a
 * jungle pet), a set without one is the same omission (Blitz's Ruby Crystal on
 * a support Tahm Kench), not a start either.
 */
export function startingSets(starters: ItemOption[], consumable: (id: number) => boolean): ItemOption[] {
  const sets = new Map<string, { shown: ItemOption, games: number, wins: number }>()
  for (const starter of starters) {
    const key = starter.itemIds.filter(id => !consumable(id)).sort((a, b) => a - b).join(',')
    const known = sets.get(key)
    if (!known) {
      sets.set(key, { shown: starter, games: starter.games, wins: starter.winRate * starter.games })
      continue
    }
    known.games += starter.games
    known.wins += starter.winRate * starter.games
    if (starter.games > known.shown.games) known.shown = starter
  }
  const starts = [...sets].filter(([key]) => key !== '' || sets.size === 1).map(([, set]) => set)
  const grows = (set: { shown: ItemOption }) => set.shown.itemIds.some(id => STARTER_LINE.has(id))
  const top = [...starts].sort((a, b) => b.games - a.games)[0]
  const kept = top && grows(top) ? starts.filter(grows) : starts
  const total = kept.reduce((sum, set) => sum + set.games, 0)
  return kept.map(set => ({ ...set.shown, games: set.games, winRate: set.games ? set.wins / set.games : 0, pickRate: total ? set.games / total : 0 }))
}

/**
 * The slots set before the items: runes, spells, starter, skills, boots and
 * their timing — no boots for a champion that plays without (`buysBoots`).
 */
export function firstSlots(options: BuildOptions, names: Names, consumable: (id: number) => boolean): JevSlot[] {
  const boots = buysBoots(options)
  const slots: JevSlot[] = [
    {
      name: 'runes',
      kind: 'runes',
      lane: true,
      options: keyed(reliable(options.pages), 4, page => ({
        ...measured(page),
        itemIds: [],
        page: page.page,
        label: `${names.perk(page.page.primaryKeystoneId)} + ${names.style(page.page.secondaryStyleId)}`,
      })),
    },
    {
      name: 'spells',
      kind: 'spells',
      lane: true,
      options: keyed(reliable(options.spells), 3, spell => ({ ...measured(spell), itemIds: [], spellIds: spell.spellIds, label: spell.spellIds.map(names.spell).join(' + ') })),
    },
    {
      name: 'starter',
      kind: 'starter',
      lane: true,
      options: keyed(reliable(startingSets(options.starters, consumable)), 3, starter => ({ ...measured(starter), itemIds: starter.itemIds, label: starter.itemIds.map(names.item).join(' + ') })),
    },
    {
      name: 'skills',
      kind: 'skills',
      lane: true,
      options: keyed(reliable(options.skills), 3, skill => ({ ...measured(skill), itemIds: [], order: skill.order, opening: skill.opening, label: skill.order.join(' > ') })),
    },
    {
      name: 'boots',
      kind: 'boots',
      lane: true,
      options: boots ? keyed(reliable(options.boots), 3, pair => ({ ...measured(pair), itemIds: pair.itemIds.slice(0, 1), label: names.item(pair.itemIds[0]!) })) : [],
    },
    {
      name: 'bootsAfter',
      kind: 'timing',
      lane: true,
      options: boots ? [0, 1, 2].map(after => ({ key: `o${after}`, after, itemIds: [], games: 0, pickRate: 0, winRate: 0, label: String(after) })) : [],
    },
  ]
  return slots.filter(slot => slot.options.length > 0)
}

/** How many completed items the core runs to: each one its own slot. */
export const CORE_ITEMS = 3

/**
 * The champion's measured items, the test of which answer this draft, and of
 * which the build can use (`damageKind`: no ability power item on a build of
 * attack damage).
 */
export interface Situational { pool: ItemOption[], answersDraft: (id: number) => boolean, suits?: (id: number) => boolean }

/**
 * What an item's damage scales with, by Riot's tags: attack damage (critical
 * strike, armour penetration), ability power (magic penetration), or neither —
 * a tank's, an enchanter's — or both alike (Guinsoo's Rageblade): null.
 */
export function damageKind(tags: string[]): 'ad' | 'ap' | null {
  const ad = tags.some(tag => tag === 'Damage' || tag === 'CriticalStrike' || tag === 'ArmorPenetration')
  const ap = tags.some(tag => tag === 'SpellDamage' || tag === 'MagicPenetration')
  return ad === ap ? null : ad ? 'ad' : 'ap'
}

/** How many of the draft's answers a slot may add to what was measured in it. */
const SITUATIONAL = 2

/**
 * A slot's measured options, then up to `SITUATIONAL` items of the champion's
 * measured pool that answer the draft (one when the slot already has such an
 * answer), none already in the build, marked situational.
 */
function withSituational(measuredHere: ItemOption[], held: number[], situational?: Situational): (ItemOption & { situational?: true })[] {
  if (!situational) return measuredHere
  const here = new Set(measuredHere.flatMap(option => option.itemIds))
  const extra = situational.pool
    .filter(option => option.games >= MIN_GAMES && !here.has(option.itemIds[0]!) && fitsWith(option.itemIds[0]!, held) && (situational.suits?.(option.itemIds[0]!) ?? true) && situational.answersDraft(option.itemIds[0]!))
    .sort((a, b) => b.games - a.games)
    .slice(0, measuredHere.some(option => situational.answersDraft(option.itemIds[0]!)) ? 1 : SITUATIONAL)
  return [...measuredHere, ...extra.map(option => ({ ...option, situational: true as const }))]
}

const itemOptions = (open: (ItemOption & { situational?: true })[], names: Names) =>
  open.map((option, index): JevOption => ({ key: `o${index}`, ...measured(option), itemIds: option.itemIds.slice(0, 1), label: names.item(option.itemIds[0]!), situational: option.situational === true }))

/**
 * The core, item by item: the first, second and third completed item are each
 * a slot of the items measured at that place of a core (their games added up
 * over every core that has them there), so a draft can change the second item
 * without a whole measured path that does. Only what was measured there: the
 * core is what the champion's players build first, and the draft's answers
 * from the rest of its items come after it (`laterSlot`) — offered in the
 * core, they took a marksman's second item from the critical strike it needs.
 * Only a place some core measured is a slot: the sources' cores mostly carry
 * the boots (Eclipse, Plated Steelcaps, Sundered Sky), so their third place is
 * the items after them.
 */
export function coreSlots(options: BuildOptions, names: Names): JevSlot[] {
  return Array.from({ length: CORE_ITEMS }, (_, index): JevSlot => {
    const at = new Map<number, { games: number, wins: number }>()
    for (const core of options.cores) {
      const id = pathOf(core)[index]
      if (id === undefined) continue
      const known = at.get(id) ?? { games: 0, wins: 0 }
      at.set(id, { games: known.games + core.games, wins: known.wins + core.winRate * core.games })
    }
    const total = [...at.values()].reduce((sum, entry) => sum + entry.games, 0)
    const measuredHere = reliable([...at].map(([id, entry]) => ({ itemIds: [id], games: entry.games, winRate: entry.games ? entry.wins / entry.games : 0, pickRate: total ? entry.games / total : 0 }))).slice(0, 4)
    return { name: `item${index + 1}`, kind: 'item', lane: index === 0, options: itemOptions(measuredHere, names) }
  }).filter(slot => slot.options.length > 0)
}

/** The measured core whose path shares the most items with `chosen`, the most played on a tie: whose follow-ups come next. */
export function closestCore(cores: ItemOption[], chosen: number[]): ItemOption | null {
  return [...cores]
    .map(core => ({ core, shared: pathOf(core).filter(id => chosen.includes(id)).length }))
    .sort((a, b) => b.shared - a.shared || b.core.games - a.core.games)[0]?.core ?? null
}

/** The most played core path. */
export const standardCore = (cores: ItemOption[]): number[] => {
  const top = [...cores].sort((a, b) => b.games - a.games)[0]
  return top ? pathOf(top).slice(0, CORE_ITEMS) : []
}

/**
 * Every completed item measured for the champion on the lane, whatever core it
 * followed or slot it took, its games added up: where a slot's own options
 * miss what the draft calls for, the answer is looked for here.
 */
export function measuredPool(options: BuildOptions): ItemOption[] {
  const pool = new Map<number, { games: number, wins: number }>()
  const add = (id: number, option: ItemOption) => {
    if (!chosen(id)) return
    const known = pool.get(id) ?? { games: 0, wins: 0 }
    pool.set(id, { games: known.games + option.games, wins: known.wins + option.winRate * option.games })
  }
  for (const core of options.cores) {
    for (const id of core.itemIds) add(id, core)
    for (const group of options.followUps(core)) for (const option of group.options) for (const id of option.itemIds) add(id, option)
  }
  const total = [...pool.values()].reduce((sum, entry) => sum + entry.games, 0)
  return [...pool].map(([id, entry]) => ({ itemIds: [id], games: entry.games, winRate: entry.games ? entry.wins / entry.games : 0, pickRate: total ? entry.games / total : 0 }))
}

/**
 * The champion's items as Blitz's item stats measure them on the lane — every
 * completed item it was seen finishing — joined to the measured pool (the
 * larger sample kept).
 */
export function statsPool(stats: Map<number, ItemStat>, measuredItems: ItemOption[], completed: (id: number) => boolean): ItemOption[] {
  const pool = new Map(measuredItems.map(option => [option.itemIds[0]!, option]))
  for (const [id, stat] of stats) {
    if (!completed(id) || !chosen(id)) continue
    const known = pool.get(id)
    if (!known || known.games < stat.games) pool.set(id, { itemIds: [id], games: stat.games, winRate: stat.winRate, pickRate: known?.pickRate ?? 0 })
  }
  return [...pool.values()]
}

/**
 * One later item slot: what was measured there after `core` that can join the
 * build (`fitsWith`: not held, no limited group full — one Lifeline item, one
 * Last Whisper item), plus the draft's answers.
 */
export function laterSlot(options: BuildOptions, core: ItemOption | null, slot: number, held: number[], names: Names, situational?: Situational): JevSlot | null {
  const group = options.followUps(core).find(entry => entry.slot === slot)
  if (!group) return null
  const measuredHere = reliable(group.options.filter(option => option.itemIds.every(id => chosen(id) && fitsWith(id, held)))).slice(0, 4)
  const open = withSituational(measuredHere, held, situational)
  if (!open.length) return null
  return { name: `item${slot}`, kind: 'item', lane: false, options: itemOptions(open, names) }
}

/** The later slots measured after `core`, in order. */
export const laterSlotNumbers = (options: BuildOptions, core: ItemOption | null) => options.followUps(core).map(group => group.slot).sort((a, b) => a - b)

/** Every item any slot of the build could offer: what Jev has to read before anything is ranked. */
export function candidateItems(options: BuildOptions, pool: ItemOption[]): number[] {
  const ids = new Set<number>()
  for (const starter of options.starters) starter.itemIds.forEach(id => ids.add(id))
  for (const boots of options.boots) boots.itemIds.slice(0, 1).forEach(id => ids.add(id))
  for (const core of options.cores) {
    pathOf(core).forEach(id => ids.add(id))
    for (const group of options.followUps(core)) for (const option of group.options) option.itemIds.forEach(id => ids.add(id))
  }
  for (const option of pool) if (option.games >= MIN_GAMES) ids.add(option.itemIds[0]!)
  return [...ids]
}

/** A build laid out for the core view (`BuildCore`) and its purchase order. */
export interface LaidBuild {
  runePage: BuildRunePage | null
  summonerSpells: BuildSummonerSpells | null
  starterItems: BuildItemSet | null
  /** With the first three levels, when measured: they tell apart orders that max alike. */
  skillOrder: (BuildSkillOrder & { opening?: string[] }) | null
  boots: BuildItemSet | null
  /** Every completed item in the order it is bought, the boots where they fall. */
  order: number[]
}

/** A build from one option per slot: the core and the items after it given apart, in order. */
export function laidBuild(pick: (slot: string) => JevOption | null, core: number[], later: number[]): LaidBuild {
  const page = pick('runes')
  const spells = pick('spells')
  const starter = pick('starter')
  const skills = pick('skills')
  const boots = pick('boots')
  const after = Math.min(pick('bootsAfter')?.after ?? 1, core.length)
  const order = [...core.slice(0, after), ...(boots?.itemIds ?? []), ...core.slice(after), ...later]
  return {
    runePage: page?.page ? { ...page.page, ...measured(page) } : null,
    summonerSpells: spells?.spellIds && spells.spellIds.length >= 2 ? { spell1Id: spells.spellIds[0]!, spell2Id: spells.spellIds[1]!, ...measured(spells) } : null,
    starterItems: starter ? { itemIds: starter.itemIds, ...measured(starter) } : null,
    skillOrder: skills?.order ? { sequence: skills.order, opening: skills.opening, ...measured(skills) } : null,
    boots: boots ? { itemIds: boots.itemIds, ...measured(boots) } : null,
    order,
  }
}
