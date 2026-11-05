import type { BuildItemSet, BuildRunePage, BuildSkillOrder, BuildSummonerSpells } from '#shared/types/champions'
import type { Champion } from '~/composables/useChampionStatics'
import type { BuildOptions, ItemOption, Measure, RunePageIds } from '~/utils/sources/model'
import type { Situation } from '~/utils/draft-build'
import type { JevAnswer, JevQuestion } from '~/utils/jev'
import type { ItemStat } from '~/utils/blitz/item-stats'
import { isBoots } from '~/utils/blitz/builds'

/**
 * The Jev matchup page's build: every choice of it — rune page, summoner
 * spells, starter, skill order, boots and when to buy them, the core path and
 * each item after it — is Jev's, asked among the options the source Settings
 * picked measured on the lane, so whatever it builds is something players of
 * the champion build. Beside each choice, the source's own (its most played
 * option), with every option's pick rate, win rate and Jev's probability.
 *
 * Asked the way TypeSafe's documentation advises (atomic "gut-check"
 * questions, combined in code — its "composite scoring" pattern): the items
 * (starter, boots, core, each later item) are not one "which is best"
 * question but, for each option, yes/no checks Jev answers on its own — does
 * it suit our champion's kit, is it strong against this enemy team, does it
 * help the lane (for what is bought while laning) — weighed together, then by
 * how many games the source saw it in. The runes, spells, skill order and the
 * boots' timing stay single choices. Options the source barely saw are left
 * out, so a dozen lucky games cannot carry a slot.
 */

export interface JevOption extends Measure {
  /** The option's key in its question (`o0`, `o1`…): `o0` is the source's most played. */
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
  /** What the option does, in words Jev can weigh: stats, effects, what it answers. */
  effect?: string
  /** Not measured in this slot: added from the champion's measured items because it answers the draft. */
  situational?: boolean
  /** Win probability added on the lane (Blitz's item stats), the option's items averaged; null where unmeasured. */
  wpa?: number | null
  /** The same against the lane opponent, when the matchup has the games. */
  vsWpa?: number | null
  vsGames?: number
}

export interface JevSlot {
  name: string
  /** What the question asks, for Jev. */
  instructions: string
  options: JevOption[]
  /** `checks`: each option judged by yes/no checks combined in code; a single choice otherwise. */
  kind?: 'choice' | 'checks'
  /** For checks: the option is bought while laning, so the lane check counts too. */
  lane?: boolean
}

/** What Jev's yes/no checks said of one option, each the probability of yes. */
export interface JevChecks { kit: number, draft: number, lane: number | null }

/** Jev's answer to a slot, whichever way it was asked: its pick, every option's share, how sure. */
export interface JevVerdict {
  choice: string
  /** TypeSafe's measure: 1 when all the weight is on one option, 0 when it is spread evenly. */
  confidence: number
  probabilities: Record<string, number>
  /** For checks: each option's yes/no answers. */
  checks?: Record<string, JevChecks>
}

export interface JevDecision {
  slot: JevSlot
  /** The option Jev picked; the only one when the slot had a single option. */
  jev: JevOption
  answer: JevVerdict | null
  /** The source's most played option. */
  standard: JevOption
}

const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`
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
  /** What an item gives and what it answers (`itemEffect`), for Jev to tell options apart. */
  itemEffect: (id: number) => string
  /** A rune's or a summoner spell's one-line effect. */
  perkEffect: (id: number) => string
  spellEffect: (id: number) => string
}

const plain = (html: string | undefined) => (html ?? '').replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/(, )+/g, ', ').replace(/^, |, $/g, '').trim()
const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** What each defensive or utility tag answers on the enemy side. */
const ANSWERS: [string, string][] = [
  ['SpellBlock', 'magic damage'],
  ['Armor', 'physical damage'],
  ['Tenacity', 'crowd control'],
  ['MagicPenetration', 'magic resist stacking and tanks'],
  ['ArmorPenetration', 'armor stacking and tanks'],
  ['LifeSteal', 'long fights'],
  ['SpellVamp', 'long fights'],
]
const ANTI_HEAL_NAMES = /grievous|feridas graves|anti-?heal/i

/**
 * An item as Jev can weigh it: its stats and passives out of Data Dragon's
 * description, and what it answers by its tags ("answers magic damage").
 */
export function itemEffect(item: { description?: string, plaintext?: string, tags?: string[] } | undefined, max = 260): string {
  if (!item) return ''
  const description = item.description ?? ''
  const stats = plain(/<stats>([\s\S]*?)<\/stats>/i.exec(description)?.[1])
  const passives = [...description.matchAll(/<(?:passive|active)>([\s\S]*?)<\/(?:passive|active)>/gi)].map(match => plain(match[1])).filter(Boolean)
  const answers = ANSWERS.filter(([tag]) => item.tags?.includes(tag)).map(([, what]) => what)
  if (ANTI_HEAL_NAMES.test(description)) answers.push('healing')
  const parts = [
    stats && `stats: ${stats}`,
    passives.length ? `effects: ${passives.join(', ')}` : '',
    item.plaintext ? plain(item.plaintext) : '',
    answers.length ? `answers ${[...new Set(answers)].join(', ')}` : '',
  ].filter(Boolean)
  return cut(parts.join('; '), max)
}


const pathOf = (core: ItemOption) => core.itemIds.filter(id => !isBoots(id))

/**
 * What the slots are asked against: the lane opponent, and in one line what
 * the enemy team demands (`draftNeeds`), named in each question so Jev weighs
 * the options against it rather than against "this draft" in general.
 */
export interface Ask {
  /** Our champion as the checks name it: `Darius (Fighter/Tank, TOP)`. */
  champion: string
  opponent: string
  needs: string
}

/** The first call's slots: runes, spells, starter, skills, boots and their timing, the core path. */
export function firstSlots(options: BuildOptions, names: Names, ask: Ask): JevSlot[] {
  return [
    {
      name: 'runes',
      instructions: `Pick the rune page that wins the lane against ${ask.opponent} and keeps its value in teamfights against an enemy team with ${ask.needs}`,
      options: keyed(options.pages, 4, page => ({
        ...measured(page),
        itemIds: [],
        page: page.page,
        label: `${names.perk(page.page.primaryKeystoneId)}, ${[page.page.primaryPerk1Id, page.page.primaryPerk2Id, page.page.primaryPerk3Id].map(names.perk).join(', ')} (${names.style(page.page.primaryStyleId)}) + ${[page.page.secondaryPerk1Id, page.page.secondaryPerk2Id].map(names.perk).join(', ')} (${names.style(page.page.secondaryStyleId)})`,
        effect: [page.page.primaryKeystoneId, page.page.primaryPerk1Id, page.page.primaryPerk2Id, page.page.primaryPerk3Id, page.page.secondaryPerk1Id, page.page.secondaryPerk2Id].map(id => `${names.perk(id)}: ${cut(names.perkEffect(id), 90)}`).join(' | '),
      })),
    },
    {
      name: 'spells',
      instructions: `Pick the summoner spells that best survive and threaten ${ask.opponent} in lane and the enemy team's crowd control and engage (${ask.needs})`,
      options: keyed(options.spells, 3, spell => ({ ...measured(spell), itemIds: [], spellIds: spell.spellIds, label: spell.spellIds.map(names.spell).join(' + '), effect: spell.spellIds.map(id => `${names.spell(id)}: ${cut(names.spellEffect(id), 110)}`).join(' | ') })),
    },
    {
      name: 'starter',
      kind: 'checks' as const,
      lane: true,
      instructions: `Pick the starting items that best trade with or sustain against ${ask.opponent} in the first levels`,
      options: keyed(reliable(options.starters), 3, starter => ({ ...measured(starter), itemIds: starter.itemIds, label: starter.itemIds.map(names.item).join(' + '), effect: starter.itemIds.map(id => `${names.item(id)}: ${names.itemEffect(id)}`).join(' | ') })),
    },
    {
      name: 'skills',
      instructions: `Pick the ability max order that best wins the trades against ${ask.opponent} and the fights after the lane`,
      options: keyed(options.skills, 3, skill => ({ ...measured(skill), itemIds: [], order: skill.order, opening: skill.opening, label: `max ${skill.order.join(' > ')}, levels 1-3 ${skill.opening.join(' ')}` })),
    },
    {
      name: 'boots',
      kind: 'checks' as const,
      lane: true,
      instructions: `Pick the boots that best defend against what this draft throws at us: ${ask.needs}. They are bought while laning against ${ask.opponent} and kept for the teamfights`,
      options: keyed(reliable(options.boots), 3, boots => ({ ...measured(boots), itemIds: boots.itemIds.slice(0, 1), label: names.item(boots.itemIds[0]!), effect: names.itemEffect(boots.itemIds[0]!) })),
    },
    {
      name: 'bootsAfter',
      instructions: `Pick when to finish the boots: early when the lane against ${ask.opponent} needs their defense or mobility now, later when the first item's power matters more`,
      options: [0, 1, 2].map(after => ({ key: `o${after}`, after, itemIds: [], games: 0, pickRate: 0, winRate: 0, label: after === 0 ? 'before the first core item' : `after core item ${after}` })),
    },
    {
      name: 'core',
      kind: 'checks' as const,
      lane: true,
      instructions: `Pick the core item path whose first item holds the lane against ${ask.opponent} and whose items fit an enemy team with ${ask.needs}, without giving up our champion's damage`,
      options: keyed(reliable(options.cores), 4, core => ({ ...measured(core), itemIds: pathOf(core), label: pathOf(core).map(names.item).join(' > '), effect: pathOf(core).map(id => `${names.item(id)}: ${names.itemEffect(id)}`).join(' | ') })),
    },
  ].filter(slot => slot.options.length > 0)
}

/**
 * Every completed item the source measured for the champion on the lane,
 * whatever core it followed or slot it took, its games added up: where a
 * slot's own options miss what the draft calls for, the answer is looked for
 * here — still an item the source saw players of the champion build.
 */
export function measuredPool(options: BuildOptions): ItemOption[] {
  const pool = new Map<number, { games: number, wins: number }>()
  const add = (id: number, option: ItemOption) => {
    if (isBoots(id)) return
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
 * completed item it was seen finishing, its own paths' or not — in the shape of
 * an option, joined to the source's measured pool (the larger sample kept).
 */
export function statsPool(stats: Map<number, ItemStat>, measured: ItemOption[], completed: (id: number) => boolean): ItemOption[] {
  const pool = new Map(measured.map(option => [option.itemIds[0]!, option]))
  for (const [id, stat] of stats) {
    if (!completed(id) || isBoots(id)) continue
    const known = pool.get(id)
    if (!known || known.games < stat.games) pool.set(id, { itemIds: [id], games: stat.games, winRate: stat.winRate, pickRate: known?.pickRate ?? 0 })
  }
  return [...pool.values()]
}

/** Each item option's win probability added, on the lane and against the lane opponent, its items averaged. */
export function withItemStats(slots: JevSlot[], lane: Map<number, ItemStat>, versus: Map<number, ItemStat>): JevSlot[] {
  const average = (ids: number[], stats: Map<number, ItemStat>) => {
    const known = ids.map(id => stats.get(id)).filter(stat => !!stat)
    return known.length ? { wpa: known.reduce((sum, stat) => sum + stat.wpa, 0) / known.length, games: Math.min(...known.map(stat => stat.games)) } : null
  }
  return slots.map(slot => (slot.kind !== 'checks'
    ? slot
    : {
        ...slot,
        options: slot.options.map((option) => {
          const onLane = average(option.itemIds, lane)
          const against = average(option.itemIds, versus)
          return { ...option, wpa: onLane?.wpa ?? null, vsWpa: against?.wpa ?? null, vsGames: against?.games ?? 0 }
        }),
      }))
}

const signed = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`

/** How many of the draft's answers a later slot may add to what the source measured in it. */
const SITUATIONAL = 2

/**
 * One later item slot: what the source measured there after `core`, without
 * an item already in the build — and, when none of those answers what the
 * draft calls for, up to two items of the champion's measured pool that do
 * (`answersDraft`: armour penetration against a frontline, magic resist
 * against magic damage, anti-heal against healers…), marked situational.
 */
export function laterSlot(options: BuildOptions, core: ItemOption | null, slot: number, held: number[], names: Names, ask: Ask, situational?: { pool: ItemOption[], answersDraft: (id: number) => boolean }): JevSlot | null {
  const group = options.followUps(core).find(entry => entry.slot === slot)
  if (!group) return null
  const measuredHere = reliable(group.options.filter(option => !option.itemIds.some(id => held.includes(id) || isBoots(id))))
  const here = new Set(measuredHere.flatMap(option => option.itemIds))
  const extra = situational
    ? situational.pool
        .filter(option => option.games >= MIN_GAMES && !here.has(option.itemIds[0]!) && !held.includes(option.itemIds[0]!) && situational.answersDraft(option.itemIds[0]!))
        .sort((a, b) => b.games - a.games)
        .slice(0, measuredHere.some(option => situational.answersDraft(option.itemIds[0]!)) ? 1 : SITUATIONAL)
    : []
  const open = [...measuredHere, ...extra.map(option => ({ ...option, situational: true }))]
  if (!open.length) return null
  return {
    name: `item${slot}`,
    kind: 'checks',
    lane: false,
    instructions: `Pick item number ${slot}: the one that best protects against or punishes what the enemy team brings (${ask.needs}) without giving up our champion's damage. It is bought after the laning phase`,
    options: keyed(open, 4 + extra.length, option => ({ ...measured(option), itemIds: option.itemIds.slice(0, 1), label: names.item(option.itemIds[0]!), effect: names.itemEffect(option.itemIds[0]!), situational: 'situational' in option })),
  }
}

/** The later slots the source measured after `core`, in order. */
export const laterSlotNumbers = (options: BuildOptions, core: ItemOption | null) => options.followUps(core).map(group => group.slot).sort((a, b) => a - b)

const CHECK = '__'

/**
 * The questions for the slots: a choice for a choice slot; for a checks slot,
 * per option, the yes/no checks (`kit`, `draft`, `lane` when it is bought while
 * laning), each a statement about that one option, with what it does.
 */
export function questionsOf(slots: JevSlot[], ask: Ask): Record<string, JevQuestion> {
  const questions: Record<string, JevQuestion> = {}
  for (const slot of slots) {
    if (slot.options.length < 2) continue
    if (slot.kind !== 'checks') {
      questions[slot.name] = {
        type: 'choice',
        instructions: slot.instructions,
        criteria: Object.fromEntries(slot.options.map(option => [option.key, [
          option.label,
          option.effect ? `— ${option.effect}` : '',
          option.games ? `(${option.games} games, ${percent(option.pickRate)} pick rate, ${percent(option.winRate)} win rate)` : '',
        ].filter(Boolean).join(' ')])),
      }
      continue
    }
    for (const option of slot.options) {
      const measures = [
        option.wpa !== null && option.wpa !== undefined ? `on this lane it adds ${signed(option.wpa)} win probability` : '',
        option.vsWpa !== null && option.vsWpa !== undefined && (option.vsGames ?? 0) >= MIN_GAMES ? `against ${ask.opponent} it adds ${signed(option.vsWpa)} over ${option.vsGames} games` : '',
      ].filter(Boolean).join('; ')
      const what = `"${option.label}"${option.effect ? ` (${option.effect})` : ''}${measures ? ` [${measures}]` : ''}`
      const at = `${slot.name}${CHECK}${option.key}${CHECK}`
      questions[`${at}kit`] = {
        type: 'noul',
        instructions: `${what} is something ${ask.champion} builds to make its own kit work`,
        criteria: { true: 'It gives the stats and effects this champion\'s abilities and role need', false: 'It is off this champion\'s kit or role' },
      }
      questions[`${at}draft`] = {
        type: 'noul',
        instructions: `${what} is a strong buy against this enemy team: ${ask.needs}`,
        criteria: { true: 'It protects against or punishes what this enemy team brings', false: 'It does nothing special against this enemy team' },
      }
      if (slot.lane) {
        questions[`${at}lane`] = {
          type: 'noul',
          instructions: `${what} helps ${ask.champion} win the lane against ${ask.opponent}`,
          criteria: { true: 'It wins trades or holds the lane against this opponent', false: 'It does not matter in this lane' },
        }
      }
    }
  }
  return questions
}

/**
 * What the item's measured effect adds to Jev's checks: its win probability
 * added — against the lane opponent when the matchup has the games, blended
 * with the lane's — as a factor around 1: four points of win probability make
 * the option weigh about 1.4 times, held between 0.6 and 1.6.
 */
function wpaFactor(option: JevOption): number {
  const versus = option.vsWpa !== null && option.vsWpa !== undefined && (option.vsGames ?? 0) >= MIN_GAMES ? option.vsWpa : null
  const lane = option.wpa ?? null
  const wpa = versus !== null ? (lane !== null ? 0.6 * versus + 0.4 * lane : versus) : lane
  if (wpa === null) return 1
  return Math.min(1.6, Math.max(0.6, Math.exp(8 * wpa)))
}

/** How many games a measure needs to be trusted half: the sample's weight is `games / (games + this)`. */
const SAMPLE_HALF = 60

/** TypeSafe's confidence of a distribution: 1 all on one option, 0 spread evenly (one minus the normalised entropy). */
export function confidenceOf(probabilities: number[]): number {
  if (probabilities.length < 2) return 1
  const entropy = probabilities.reduce((sum, p) => (p > 0 ? sum - p * Math.log(p) : sum), 0)
  return Math.max(0, 1 - entropy / Math.log(probabilities.length))
}

/**
 * A checks slot's verdict: each option's checks weighed together — the enemy
 * team first, then the kit, then the lane when it counts — times how far the
 * source's sample can be trusted, as shares of the slot.
 */
function verdictOfChecks(slot: JevSlot, answers: Record<string, JevAnswer>): JevVerdict | null {
  const noul = (key: string) => {
    const answer = answers[key]
    return answer && answer.type === 'noul' ? answer.noul : null
  }
  const checks: Record<string, JevChecks> = {}
  const scores = slot.options.map((option) => {
    const at = `${slot.name}${CHECK}${option.key}${CHECK}`
    const kit = noul(`${at}kit`)
    const draft = noul(`${at}draft`)
    const lane = slot.lane ? noul(`${at}lane`) : null
    if (kit === null || draft === null) return 0
    checks[option.key] = { kit, draft, lane }
    const fit = lane === null ? 0.55 * draft + 0.45 * kit : 0.4 * draft + 0.35 * kit + 0.25 * lane
    return fit * (option.games / (option.games + SAMPLE_HALF)) * wpaFactor(option)
  })
  const total = scores.reduce((sum, score) => sum + score, 0)
  if (total <= 0) return null
  const shares = scores.map(score => score / total)
  const best = shares.indexOf(Math.max(...shares))
  return {
    choice: slot.options[best]!.key,
    confidence: confidenceOf(shares),
    probabilities: Object.fromEntries(slot.options.map((option, index) => [option.key, shares[index]!])),
    checks,
  }
}

/** Jev's pick in a slot, taken as it is; the slot's only option when it had one. */
export function decide(slot: JevSlot, answers: Record<string, JevAnswer>): JevDecision {
  const raw = answers[slot.name]
  const answer: JevVerdict | null = slot.kind === 'checks'
    ? verdictOfChecks(slot, answers)
    : raw && raw.type === 'choice' ? raw : null
  const jev = (answer && slot.options.find(option => option.key === answer.choice)) ?? slot.options[0]!
  return { slot, jev, answer, standard: slot.options[0]! }
}

/** A build laid out for the core view (`BuildCore`) and its purchase order. */
export interface LaidBuild {
  runePage: BuildRunePage | null
  summonerSpells: BuildSummonerSpells | null
  starterItems: BuildItemSet | null
  skillOrder: BuildSkillOrder | null
  boots: BuildItemSet | null
  /** Every completed item in the order it is bought, the boots where they fall. */
  order: number[]
}

/** One side of the comparison, read off the decisions: Jev's picks, or the source's most played. */
export function laidBuild(decisions: JevDecision[], side: 'jev' | 'standard', later: number[]): LaidBuild {
  const pick = (name: string) => {
    const decision = decisions.find(entry => entry.slot.name === name)
    return decision ? decision[side] : null
  }
  const page = pick('runes')
  const spells = pick('spells')
  const starter = pick('starter')
  const skills = pick('skills')
  const boots = pick('boots')
  const core = pick('core')?.itemIds ?? []
  const after = Math.min(pick('bootsAfter')?.after ?? 1, core.length)
  const order = [...core.slice(0, after), ...(boots?.itemIds ?? []), ...core.slice(after), ...later]
  return {
    runePage: page?.page ? { ...page.page, ...measured(page) } : null,
    summonerSpells: spells?.spellIds && spells.spellIds.length >= 2 ? { spell1Id: spells.spellIds[0]!, spell2Id: spells.spellIds[1]!, ...measured(spells) } : null,
    starterItems: starter ? { itemIds: starter.itemIds, ...measured(starter) } : null,
    skillOrder: skills?.order ? { sequence: skills.order, ...measured(skills) } : null,
    boots: boots ? { itemIds: boots.itemIds, ...measured(boots) } : null,
    order,
  }
}

/** Healers by Data Dragon alias: the champions whose kit heals enough that the enemy builds anti-heal. */
const HEALERS = new Set(['Aatrox', 'Briar', 'DrMundo', 'Fiddlesticks', 'Illaoi', 'Kayn', 'Nami', 'Olaf', 'Renekton', 'Senna', 'Seraphine', 'Sona', 'Soraka', 'Swain', 'Sylas', 'Vladimir', 'Volibear', 'Warwick', 'Yuumi', 'Zac', 'Maokai', 'Nasus', 'Trundle'])

/**
 * What the enemy team demands, in one line: its damage split (each champion's
 * 0–10 attack against magic ratings), its crowd control, frontline and healers.
 */
export function draftNeeds(enemies: Champion[]): string {
  if (!enemies.length) return 'an unknown team'
  const magic = enemies.reduce((sum, champion) => {
    const skew = champion.info ? champion.info.magic - champion.info.attack : 0
    return sum + (skew >= 2 ? 1 : skew <= -2 ? 0 : 0.5)
  }, 0) / enemies.length
  const cc = enemies.filter(champion => champion.tags?.some(tag => tag === 'Tank' || tag === 'Support')).map(champion => champion.name)
  const front = enemies.filter(champion => champion.tags?.includes('Tank')).map(champion => champion.name)
  const healers = enemies.filter(champion => HEALERS.has(champion.alias)).map(champion => champion.name)
  return [
    `${Math.round(magic * 100)}% magic and ${Math.round((1 - magic) * 100)}% physical damage`,
    cc.length ? `heavy crowd control from ${cc.join(', ')}` : 'little crowd control',
    front.length ? `a frontline of ${front.join(', ')}` : 'no real frontline',
    healers.length ? `healing from ${healers.join(', ')}` : 'no notable healing',
  ].join(', ')
}

const KIND = (champion: Champion) => {
  const skew = champion.info ? champion.info.magic - champion.info.attack : 0
  return skew >= 2 ? 'magic damage' : skew <= -2 ? 'physical damage' : 'mixed damage'
}

/** A champion's passive and abilities, as Data Dragon words them: what they deal and how they lock down. */
export interface AbilityText { key: string, name: string, description: string }

/** Plain text of an ability's description (Data Dragon writes tags and line breaks into it), cut to `max` characters. */
export function plainAbility(text: string | undefined, max: number): string {
  const plain = (text ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain
}

/** The lane as the source measured it: the game and the lane at fifteen minutes against this opponent. */
export interface LaneRead { games: number, winRate: number, laneWinRate: number | null, goldDiffAt15: number | null }

/** The draft as Jev reads it: who plays what, their kits, the lane, and what the app reads of the enemy team. */
export function stateOf(input: {
  champion: Champion | undefined
  position: string
  opponent: Champion | undefined
  enemies: Champion[]
  allies: Champion[]
  situations: Situation[]
  games: number
  taken?: string[]
  /** By champion id. */
  abilities?: Map<number, AbilityText[]>
  lane?: LaneRead | null
}): string {
  const describe = (champion: Champion) => `${champion.name} (${(champion.tags ?? []).join('/') || 'champion'}, ${KIND(champion)}${(champion.attackRange ?? 500) <= 200 ? ', melee' : ', ranged'})`
  const lines = [
    `League of Legends ranked draft. We play ${input.champion?.name ?? 'our champion'} in the ${input.position} role.`,
    input.opponent ? `Lane opponent: ${describe(input.opponent)}.` : 'Lane opponent: unknown.',
    `Enemy team: ${input.enemies.map(describe).join('; ') || 'unknown'}.`,
    `Our team: ${input.allies.map(describe).join('; ') || 'unknown'}.`,
    `What the enemy team demands: ${draftNeeds(input.enemies)}.`,
    `Read of the enemy team: ${input.situations.map(s => `${s.axis} ${s.bucket}${s.strength !== undefined ? ` (strength ${s.strength.toFixed(2)})` : ''}`).join(', ') || 'no clear lean'}.`,
    `Every option below was measured on ${input.games} games of this champion in this role; prefer what answers this specific lane and enemy team, weighing win rate and sample size.`,
  ]
  const kit = (champion: Champion, max: number) => (input.abilities?.get(champion.id) ?? [])
    .map(ability => `  ${ability.key} ${ability.name}: ${plainAbility(ability.description, max)}`).join('\n')
  if (input.opponent && input.abilities?.has(input.opponent.id)) {
    lines.push(`Laning phase: the starter, the boots and the first item are bought while laning against ${input.opponent.name}, whose kit is:\n${kit(input.opponent, 320)}`)
  }
  if (input.lane) {
    const lane = input.lane
    lines.push(`This matchup in the source: ${lane.games} games, ${percent(lane.winRate)} game win rate${lane.laneWinRate !== null ? `, ${percent(lane.laneWinRate)} of decided lanes won` : ''}${lane.goldDiffAt15 !== null ? `, ${Math.round(lane.goldDiffAt15)} gold difference at 15 minutes` : ''}.`)
  }
  const others = input.enemies.filter(enemy => enemy.id !== input.opponent?.id && input.abilities?.has(enemy.id))
  if (others.length) {
    lines.push(`The rest of the enemy team, for the items after the laning phase:\n${others.map(enemy => `${enemy.name}:\n${kit(enemy, 160)}`).join('\n')}`)
  }
  if (input.taken?.length) lines.push(`Already chosen for this build: ${input.taken.join(', ')}.`)
  return lines.join('\n')
}
