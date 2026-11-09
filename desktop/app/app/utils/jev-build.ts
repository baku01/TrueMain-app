import type { BuildItemSet, BuildRunePage, BuildSkillOrder, BuildSummonerSpells } from '#shared/types/champions'
import type { BuildOptions, ItemOption, Measure, RunePageIds } from '~/utils/sources/model'
import type { ItemStat } from '~/utils/blitz/item-stats'
import type { ItemMeasure } from '~/utils/jev-item-stats'
import type { Answer, Needs } from '~/utils/jev-needs'
import { isBoots } from '~/utils/blitz/builds'
import { STARTER_LINE, fitsWith } from '~/utils/item-groups'
import { STANDS_OUT, answerTo } from '~/utils/jev-needs'
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
  /** For an item: its place in the buying order, boots apart — 1 the first completed item. */
  place?: number
  options: JevOption[]
}

const measured = <T extends Measure>(option: T): Measure => ({ games: option.games, pickRate: option.pickRate, winRate: option.winRate })
const keyed = <T>(list: T[], count: number, shape: (option: T) => Omit<JevOption, 'key'>): JevOption[] =>
  list.slice(0, count).map((option, index) => ({ key: `o${index}`, ...shape(option) }))

/** Under this many games an option is a rumour: a slot keeps it only to have two to compare. */
export const MIN_GAMES = 30

/**
 * The options seen often enough to judge, most played first: in `MIN_GAMES`
 * games and `PLACE_SHARE` of the slot's games or more — LoLDraftAI lists rune
 * pages from 1 %, and 30 of Ashe's 130,000 games are no option — the two most
 * played whatever their games.
 */
export function reliable<T extends Measure>(list: T[]): T[] {
  const sorted = [...list].sort((a, b) => b.games - a.games)
  const floor = Math.max(MIN_GAMES, PLACE_SHARE * sorted.reduce((sum, option) => sum + option.games, 0))
  const kept = sorted.filter(option => option.games >= floor)
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

/** The support item: World Atlas, which every support starts with (`STARTER_LINE`). */
export const WORLD_ATLAS = 3865

/**
 * The starting sets as choices: sets that differ only by potions or wards are
 * one start (Doran's Blade, with or without a Health Potion), their games
 * added up, shown as the most played of them. A set of consumables alone is a
 * source leaving the starting item out (Blitz records a support's World Atlas
 * as nothing), not a start, while another set holds an item; and where the
 * most played start holds the item that grows (a support's World Atlas, a
 * jungle pet), a set without one is the same omission (Blitz's Ruby Crystal on
 * a support Tahm Kench), not a start either. On a support's lane (`omitted`,
 * its World Atlas) the set of consumables alone is that item left out, and
 * reads as it: Blitz's Seraphine support (Heal & Shield, 16.22) starts with a
 * Health Potion alone in 28,800 games, Tear of the Goddess in 206 — the Tear
 * was shown as the start.
 */
export function startingSets(starters: ItemOption[], consumable: (id: number) => boolean, omitted?: number): ItemOption[] {
  const sets = new Map<string, { shown: ItemOption, games: number, wins: number }>()
  for (const recorded of starters) {
    const starter = omitted !== undefined && recorded.itemIds.every(consumable) ? { ...recorded, itemIds: [omitted, ...recorded.itemIds] } : recorded
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
 * their timing — no boots for a champion that plays without (`buysBoots`);
 * `omitted`, the starting item a source leaves out of a set of consumables
 * alone (`startingSets`).
 */
export function firstSlots(options: BuildOptions, names: Names, consumable: (id: number) => boolean, omitted?: number): JevSlot[] {
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
      options: keyed(reliable(startingSets(options.starters, consumable, omitted)), 3, starter => ({ ...measured(starter), itemIds: starter.itemIds, label: starter.itemIds.map(names.item).join(' + ') })),
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
 * attack damage); what each answers of the draft need by need, and the needs
 * whose answers a slot adds, in order.
 */
export interface Situational {
  pool: ItemOption[]
  answersDraft: (id: number) => boolean
  suits?: (id: number) => boolean
  /** What an item answers of the draft, need by need (`fitOf`'s answers, the slot's due resistances counted). */
  answers: (id: number) => Answer[]
  /** The needs whose answers are added, in order (`draftNeeds`: a due resistance first, then the strongest). */
  needs: (keyof Needs)[]
}

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
 * The share of a place's games an item must be bought at to be one of the
 * draft's answers there (`placeShare`): the place of the build players buy it
 * at, not only how often — Guardian Angel is Ashe's fifth item (3.8 % of
 * them, 1.2 % of her fourth), her second in 10 games of 67,000, and was taken
 * there for the armor a rule made due.
 */
export const PLACE_SHARE = 0.01

/**
 * Each item's share of the games at one place of the build (`place`, 1 the
 * first completed item), the source's measures of that place (lolalytics'
 * `places`) and Blitz's (its item stats at that slot) added up; null where
 * neither measured the place, which then sets no bar.
 */
export function placeShare(places: ItemOption[] | undefined, slot: Map<number, ItemStat> | undefined): ((id: number) => number) | null {
  const games = new Map<number, number>()
  for (const option of places ?? []) games.set(option.itemIds[0]!, (games.get(option.itemIds[0]!) ?? 0) + option.games)
  for (const [id, stat] of slot ?? []) games.set(id, (games.get(id) ?? 0) + stat.games)
  const total = [...games.values()].reduce((sum, count) => sum + count, 0)
  return total > 0 ? id => (games.get(id) ?? 0) / total : null
}

/**
 * The share of the champion's games an item must be bought in to be one of
 * the draft's answers: what one game in two hundred sees is a build; below
 * it, a handful of games — Death's Dance on Ashe (84 games, 0.1 %) and
 * Randuin's Omen (418, 0.3 %) took her fourth and third items. Between
 * LoLDraftAI's 1 % for rune pages and iTero's 0.25 %, and under Locket of the
 * Iron Solari on an enchanter (0.99 %, +4.3 points of win probability).
 */
export const ANSWER_SHARE = 0.005

/**
 * The draft's answers a slot adds to what was measured in it, none already in
 * the build: each need of `needs` that no option measured here answers
 * (`STANDS_OUT`) takes its best answer from the champion's items — the one that
 * answers that need most, the most played on a tie — then its next, round by
 * round, the needs in their order, up to `limit`. An answer to one need does
 * not close the slot to another: a measured shield answers burst, not the
 * magic resist a rule makes due — sorted by games and cut to one, Eclipse
 * (15,656 games) took Maw of Malmortius's place into an all-magic team. Where
 * the slot answers every need already, the item that answers the draft most,
 * alone — none where `unmetOnly` (a core place: only what is due).
 */
function draftAnswers(measuredHere: ItemOption[], held: number[], situational: Situational, limit: number, unmetOnly = false): ItemOption[] {
  const idOf = (option: ItemOption) => option.itemIds[0]!
  const here = new Set(measuredHere.flatMap(option => option.itemIds))
  const open = situational.pool.filter(option => option.games >= MIN_GAMES && option.pickRate >= ANSWER_SHARE && !here.has(idOf(option)) && fitsWith(idOf(option), held) && (situational.suits?.(idOf(option)) ?? true) && situational.answersDraft(idOf(option)))
  const value = (option: ItemOption, need: keyof Needs) => answerTo(situational.answers(idOf(option)), need)
  const unmet = situational.needs.filter(need => !measuredHere.some(option => value(option, need) >= STANDS_OUT))
  const queued = unmet.flatMap((need, rank) => open
    .filter(option => value(option, need) >= STANDS_OUT)
    .sort((a, b) => value(b, need) - value(a, need) || b.games - a.games)
    .map((option, nth) => ({ option, nth, rank })))
  const added = [...new Set(queued.sort((a, b) => a.nth - b.nth || a.rank - b.rank).map(entry => entry.option))].slice(0, limit)
  if (added.length || unmetOnly) return added
  const fit = (option: ItemOption) => situational.answers(idOf(option)).reduce((sum, answer) => sum + answer.value, 0)
  return [...open].sort((a, b) => fit(b) - fit(a) || b.games - a.games).slice(0, 1)
}

/** A slot's measured options, then the draft's answers it adds (`draftAnswers`, up to `SITUATIONAL`), marked situational. */
function withSituational(measuredHere: ItemOption[], held: number[], situational?: Situational): (ItemOption & { situational?: true })[] {
  if (!situational) return measuredHere
  return [...measuredHere, ...draftAnswers(measuredHere, held, situational, SITUATIONAL).map(option => ({ ...option, situational: true as const }))]
}

const itemOptions = (open: (ItemOption & { situational?: true })[], names: Names) =>
  open.map((option, index): JevOption => ({ key: `o${index}`, ...measured(option), itemIds: option.itemIds.slice(0, 1), label: names.item(option.itemIds[0]!), situational: option.situational === true }))

/**
 * The measured cores that follow the items `chosen`, as Hexgate's path pool
 * and LoLDraftAI's purchase-by-purchase build read the next item: those whose
 * path starts with them in their order; else those that hold them first in any
 * order; else every core — a narrower set seen in fewer than `MIN_GAMES` games
 * is a rumour, and the broader one speaks instead.
 */
function coresAfter(cores: ItemOption[], chosen: number[]): ItemOption[] {
  if (!chosen.length) return cores
  const games = (list: ItemOption[]) => list.reduce((sum, core) => sum + core.games, 0)
  const ordered = cores.filter(core => chosen.every((id, at) => pathOf(core)[at] === id))
  if (games(ordered) >= MIN_GAMES) return ordered
  const anyOrder = cores.filter((core) => {
    const head = pathOf(core).slice(0, chosen.length)
    return chosen.every(id => head.includes(id))
  })
  return games(anyOrder) >= MIN_GAMES ? anyOrder : cores
}

/**
 * One place of the core (`index`, 0 the first completed item): the items
 * measured there in the cores that follow what the build chose before it
 * (`coresAfter`), their games added up — the second item after Kraken Slayer
 * is what Kraken Slayer's players build second, not every core's second. Only
 * what was measured there: the core is what the champion's players build
 * first, and the draft's answers from the rest of its items come after it
 * (`laterSlot`) — offered in the core, they took a marksman's second item from
 * the critical strike it needs. One exception, `due`: a resistance a rule makes
 * due at this place (`utils/jev-rules` `dueAt`) that no option measured here
 * holds adds the champion's best answer to it (`draftAnswers`) — Zed's cores
 * hold no magic resist, and into five magic damage dealers his third item was
 * Lord Dominik's Regards against tanks the team did not have. Only a place some
 * core measured is a slot (null else): the sources' cores mostly carry the
 * boots (Eclipse, Plated Steelcaps, Sundered Sky), so their third place is the
 * items after them.
 */
export function coreSlot(options: BuildOptions, index: number, chosen: number[], names: Names, due?: Situational, owed: ItemOption[] = []): JevSlot | null {
  const at = new Map<number, { games: number, wins: number }>()
  for (const core of coresAfter(options.cores, chosen)) {
    const id = pathOf(core)[index]
    if (id === undefined) continue
    const known = at.get(id) ?? { games: 0, wins: 0 }
    at.set(id, { games: known.games + core.games, wins: known.wins + core.winRate * core.games })
  }
  if (!at.size) return null
  const total = [...at.values()].reduce((sum, entry) => sum + entry.games, 0)
  const measuredHere = reliable(withOwed([...at].map(([id, entry]) => ({ itemIds: [id], games: entry.games, winRate: entry.games ? entry.wins / entry.games : 0, pickRate: total ? entry.games / total : 0 })), owed, chosen)).slice(0, 4)
  const answers = due?.needs.length ? draftAnswers(measuredHere, chosen, due, due.needs.length, true) : []
  return { name: `item${index + 1}`, kind: 'item', lane: index === 0, place: index + 1, options: itemOptions([...measuredHere, ...answers.map(option => ({ ...option, situational: true as const }))], names) }
}

/**
 * A slot's measured options and the items a slot before it gave up for its
 * pick (`owed`), each once, the larger sample kept, none the build holds or
 * cannot hold: Lord Dominik's Regards taken third against tanks moves Infinity
 * Edge, Jinx's most played third item, to fourth — not out of the build.
 */
function withOwed(measured: ItemOption[], owed: ItemOption[], held: number[]): ItemOption[] {
  const byId = new Map<number, ItemOption>()
  for (const option of [...owed.filter(option => option.itemIds.every(id => !held.includes(id) && fitsWith(id, held))), ...measured]) {
    const id = option.itemIds[0]!
    if ((byId.get(id)?.games ?? -1) < option.games) byId.set(id, option)
  }
  return [...byId.values()]
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
 * The champion's items to look for the draft's answers in: what the source
 * measured bought on the lane whatever the place (`BuildOptions.situational`),
 * completed items only, boots apart (their own slot offers them) — else every
 * item its cores and the slots after them measured (`measuredPool`).
 */
export function situationalPool(options: BuildOptions, completed: (id: number) => boolean): ItemOption[] {
  const bought = (options.situational ?? []).filter(option => chosen(option.itemIds[0]!) && completed(option.itemIds[0]!))
  return bought.length ? bought : measuredPool(options)
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
export function laterSlot(options: BuildOptions, core: ItemOption | null, slot: number, held: number[], names: Names, situational?: Situational, owed: ItemOption[] = []): JevSlot | null {
  const group = options.followUps(core).find(entry => entry.slot === slot)
  if (!group) return null
  const measuredHere = reliable(withOwed(group.options.filter(option => option.itemIds.every(id => chosen(id) && fitsWith(id, held))), owed, held)).slice(0, 4)
  const open = withSituational(measuredHere, held, situational)
  if (!open.length) return null
  return { name: `item${slot}`, kind: 'item', lane: false, place: slot, options: itemOptions(open, names) }
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
