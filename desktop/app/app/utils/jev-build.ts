import type { BuildItemSet, BuildRunePage, BuildSkillOrder, BuildSummonerSpells } from '#shared/types/champions'
import type { Champion } from '~/composables/useChampionStatics'
import type { BuildOptions, ItemOption, Measure, RunePageIds } from '~/utils/sources/model'
import type { Situation } from '~/utils/draft-build'
import type { JevChoiceAnswer, JevChoiceQuestion } from '~/utils/jev'
import { isBoots } from '~/utils/blitz/builds'

/**
 * The Jev matchup page's build: every choice of it — rune page, summoner
 * spells, starter, skill order, boots and when to buy them, the core path and
 * each item after it — is Jev's, asked among the options the source Settings
 * picked measured on the lane, so whatever it builds is something players of
 * the champion build. Beside each choice, the source's own (its most played
 * option), with every option's pick rate, win rate and Jev's probability.
 */

export interface JevOption extends Measure {
  /** The option's key in its question (`o0`, `o1`…): `o0` is the source's most played. */
  key: string
  label: string
  itemIds: number[]
  spellIds?: number[]
  page?: RunePageIds
  order?: string[]
  /** For the boots' timing: how many core items come before the boots. */
  after?: number
}

export interface JevSlot {
  name: string
  /** What the question asks, for Jev. */
  instructions: string
  options: JevOption[]
}

export interface JevDecision {
  slot: JevSlot
  /** The option Jev picked; the only one when the slot had a single option. */
  jev: JevOption
  answer: JevChoiceAnswer | null
  /** The source's most played option. */
  standard: JevOption
}

const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`
const measured = <T extends Measure>(option: T): Measure => ({ games: option.games, pickRate: option.pickRate, winRate: option.winRate })
const keyed = <T>(list: T[], count: number, shape: (option: T) => Omit<JevOption, 'key'>): JevOption[] =>
  list.slice(0, count).map((option, index) => ({ key: `o${index}`, ...shape(option) }))

export interface Names {
  item: (id: number) => string
  perk: (id: number) => string
  style: (id: number) => string
  spell: (id: number) => string
}

const pathOf = (core: ItemOption) => core.itemIds.filter(id => !isBoots(id))

/** The first call's slots: runes, spells, starter, skills, boots and their timing, the core path. */
export function firstSlots(options: BuildOptions, names: Names): JevSlot[] {
  return [
    {
      name: 'runes',
      instructions: 'Which full rune page suits this draft best, for the lane opponent and the enemy team',
      options: keyed(options.pages, 4, page => ({ ...measured(page), itemIds: [], page: page.page, label: `${names.perk(page.page.primaryKeystoneId)}, ${[page.page.primaryPerk1Id, page.page.primaryPerk2Id, page.page.primaryPerk3Id].map(names.perk).join(', ')} (${names.style(page.page.primaryStyleId)}) + ${[page.page.secondaryPerk1Id, page.page.secondaryPerk2Id].map(names.perk).join(', ')} (${names.style(page.page.secondaryStyleId)})` })),
    },
    {
      name: 'spells',
      instructions: 'Which summoner spells suit this draft best',
      options: keyed(options.spells, 3, spell => ({ ...measured(spell), itemIds: [], spellIds: spell.spellIds, label: spell.spellIds.map(names.spell).join(' + ') })),
    },
    {
      name: 'starter',
      instructions: 'Which starting items suit the laning phase against this lane opponent best',
      options: keyed(options.starters, 3, starter => ({ ...measured(starter), itemIds: starter.itemIds, label: starter.itemIds.map(names.item).join(' + ') })),
    },
    {
      name: 'skills',
      instructions: 'Which ability max order suits this matchup and draft best',
      options: keyed(options.skills, 3, skill => ({ ...measured(skill), itemIds: [], order: skill.order, label: skill.order.join(' > ') })),
    },
    {
      name: 'boots',
      instructions: 'Which boots suit this draft best: bought in the laning phase against the lane opponent, then kept for the teamfights against the whole enemy team',
      options: keyed(options.boots, 3, boots => ({ ...measured(boots), itemIds: boots.itemIds.slice(0, 1), label: names.item(boots.itemIds[0]!) })),
    },
    {
      name: 'bootsAfter',
      instructions: 'When to finish the boots in the build order, given the lane opponent and the enemy team',
      options: [0, 1, 2].map(after => ({ key: `o${after}`, after, itemIds: [], games: 0, pickRate: 0, winRate: 0, label: after === 0 ? 'before the first core item' : `after core item ${after}` })),
    },
    {
      name: 'core',
      instructions: 'Which core item path (the first completed items, in order) suits this draft best: its first item is bought during the laning phase, so it must hold the lane against the lane opponent too',
      options: keyed(options.cores, 4, core => ({ ...measured(core), itemIds: pathOf(core), label: pathOf(core).map(names.item).join(' > ') })),
    },
  ].filter(slot => slot.options.length > 0)
}

/** One later item slot: what the source measured there after `core`, without an item already in the build. */
export function laterSlot(options: BuildOptions, core: ItemOption | null, slot: number, held: number[], names: Names): JevSlot | null {
  const group = options.followUps(core).find(entry => entry.slot === slot)
  if (!group) return null
  const open = group.options.filter(option => !option.itemIds.some(id => held.includes(id) || isBoots(id)))
  if (!open.length) return null
  return {
    name: `item${slot}`,
    instructions: `Which item suits this draft best as item number ${slot}: bought after the laning phase, against the whole enemy team's damage, crowd control and healing`,
    options: keyed(open, 4, option => ({ ...measured(option), itemIds: option.itemIds.slice(0, 1), label: names.item(option.itemIds[0]!) })),
  }
}

/** The later slots the source measured after `core`, in order. */
export const laterSlotNumbers = (options: BuildOptions, core: ItemOption | null) => options.followUps(core).map(group => group.slot).sort((a, b) => a - b)

export function questionsOf(slots: JevSlot[]): Record<string, JevChoiceQuestion> {
  return Object.fromEntries(slots.filter(slot => slot.options.length > 1).map(slot => [slot.name, {
    type: 'choice' as const,
    instructions: slot.instructions,
    criteria: Object.fromEntries(slot.options.map(option => [option.key, option.games
      ? `${option.label} (${option.games} games, ${percent(option.pickRate)} pick rate, ${percent(option.winRate)} win rate)`
      : option.label])),
  }]))
}

/** Jev's pick in a slot, taken as it is; the slot's only option when it had one. */
export function decide(slot: JevSlot, answer: JevChoiceAnswer | undefined): JevDecision {
  const jev = (answer && slot.options.find(option => option.key === answer.choice)) ?? slot.options[0]!
  return { slot, jev, answer: answer ?? null, standard: slot.options[0]! }
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
