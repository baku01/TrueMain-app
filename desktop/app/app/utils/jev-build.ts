import type { StaticItemData } from '#shared/types/static-data'
import type { Champion } from '~/composables/useChampionStatics'
import type { BuildOptions, ItemOption, Measure } from '~/utils/sources/model'
import type { Situation } from '~/utils/draft-build'
import type { JevChoiceAnswer, JevChoiceQuestion } from '~/utils/jev'
import { isBoots } from '~/utils/blitz/builds'

/**
 * The Jev matchup page's questions: the build and runes for a draft, asked of
 * Jev slot by slot, every option one the source Settings picked measured on
 * the lane — so whatever it picks is a build players of the champion build.
 * It is told the draft as the app reads it (the enemy team's damage, its
 * frontline, crowd control and healers, the lane opponent) and each option's
 * games and win rate, and it answers with a pick, its confidence and every
 * option's probability. The app keeps the last word on the rules Jev does not
 * know: no item twice, no more than three purely defensive items.
 */

export interface JevOption {
  /** The option's key in the question (`o0`, `o1`…). */
  key: string
  itemIds: number[]
  label: string
  games: number
  winRate: number
}

export interface JevSlot {
  name: string
  /** What the question asks, for Jev. */
  instructions: string
  options: JevOption[]
}

const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`

function optionsOf<T extends Measure>(list: T[], ids: (option: T) => number[], label: (option: T) => string, count: number): JevOption[] {
  return list.slice(0, count).map((option, index) => ({ key: `o${index}`, itemIds: ids(option), label: label(option), games: option.games, winRate: option.winRate }))
}

const itemName = (items: Record<number, StaticItemData>) => (id: number) => items[id]?.name ?? `Item ${id}`

/** The first call's slots: the core path, the boots, the rune page and the summoner spells. */
export function firstSlots(options: BuildOptions, items: Record<number, StaticItemData>, names: { perk: (id: number) => string, style: (id: number) => string, spell: (id: number) => string }): JevSlot[] {
  const name = itemName(items)
  return [
    { name: 'core', instructions: 'Which core item path (the first completed items, in order) suits this draft best: its first item is bought during the laning phase, so it must also hold the lane against the lane opponent', options: optionsOf(options.cores, option => option.itemIds.filter(id => !isBoots(id)), option => option.itemIds.filter(id => !isBoots(id)).map(name).join(' > '), 4) },
    { name: 'boots', instructions: 'Which boots suit this draft best: they are bought in the laning phase against the lane opponent, then kept for the teamfights against the whole enemy team', options: optionsOf(options.boots, option => option.itemIds.slice(0, 1), option => name(option.itemIds[0]!), 3) },
    { name: 'runes', instructions: 'Which rune page suits this draft best', options: optionsOf(options.pages, () => [], option => `${names.perk(option.page.primaryKeystoneId)} (${names.style(option.page.primaryStyleId)}) + ${names.style(option.page.secondaryStyleId)}: ${[option.page.secondaryPerk1Id, option.page.secondaryPerk2Id].map(names.perk).join(', ')}`, 3) },
    { name: 'spells', instructions: 'Which summoner spells suit this draft best', options: optionsOf(options.spells, () => [], option => option.spellIds.map(names.spell).join(' + '), 3) },
  ].filter(slot => slot.options.length > 1 || slot.name === 'core')
}

/** The second call's slots: each item slot after the chosen core, without an item already in the build. */
export function laterSlots(options: BuildOptions, core: ItemOption | null, taken: number[], items: Record<number, StaticItemData>): JevSlot[] {
  const name = itemName(items)
  const held = new Set(taken)
  return options.followUps(core).map(group => ({
    name: `item${group.slot}`,
    instructions: `Which item suits this draft best as item number ${group.slot}: it is bought after the laning phase, against the whole enemy team's damage, crowd control and healing`,
    options: optionsOf(group.options.filter(option => !option.itemIds.some(id => held.has(id) || isBoots(id))), option => option.itemIds.slice(0, 1), option => name(option.itemIds[0]!), 4),
  })).filter(slot => slot.options.length > 0)
}

export function questionsOf(slots: JevSlot[]): Record<string, JevChoiceQuestion> {
  return Object.fromEntries(slots.filter(slot => slot.options.length > 1).map(slot => [slot.name, {
    type: 'choice' as const,
    instructions: slot.instructions,
    criteria: Object.fromEntries(slot.options.map(option => [option.key, `${option.label} (${option.games} games, ${percent(option.winRate)} win rate)`])),
  }]))
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
    `Every option below was measured on ${input.games} games of this champion in this role; prefer options that answer this specific enemy team, weighing win rate and sample size.`,
  ]
  const kit = (champion: Champion, max: number) => (input.abilities?.get(champion.id) ?? [])
    .map(ability => `  ${ability.key} ${ability.name}: ${plainAbility(ability.description, max)}`).join('\n')
  if (input.opponent && input.abilities?.has(input.opponent.id)) {
    lines.push(`Laning phase: the boots and the first item are bought while laning against ${input.opponent.name}, whose kit is:\n${kit(input.opponent, 320)}`)
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

/** Tags of an item that defends only: no damage, attack speed or ability power in it. */
const OFFENSIVE = ['Damage', 'SpellDamage', 'AttackSpeed', 'CriticalStrike', 'ArmorPenetration', 'MagicPenetration', 'LifeSteal', 'OnHit']
const defensiveOnly = (id: number, items: Record<number, StaticItemData>) => {
  const tags = items[id]?.tags ?? []
  return (tags.includes('Armor') || tags.includes('SpellBlock') || tags.includes('Health')) && !tags.some(tag => OFFENSIVE.includes(tag))
}

export interface JevPick {
  slot: JevSlot
  /** The option the build takes: Jev's, or the next by its probability when Jev's broke a rule. */
  option: JevOption
  answer: JevChoiceAnswer | null
  /** Jev's own pick was set aside for a rule. */
  overruled: boolean
}

const MAX_DEFENSIVE = 3

/**
 * Each slot's option, in slot order: Jev's pick, unless it repeats an item
 * already taken or is a fourth purely defensive item — then its next most
 * probable option that does not. A slot Jev was not asked (a single option) takes it.
 */
export function settle(slots: JevSlot[], answers: Record<string, JevChoiceAnswer>, items: Record<number, StaticItemData>, taken: number[] = []): JevPick[] {
  const held = [...taken]
  return slots.map((slot) => {
    const answer = answers[slot.name] ?? null
    const ranked = answer
      ? [...slot.options].sort((a, b) => (answer.probabilities[b.key] ?? 0) - (answer.probabilities[a.key] ?? 0))
      : slot.options
    const allowed = (option: JevOption) => !option.itemIds.some(id => held.includes(id))
      && held.filter(id => defensiveOnly(id, items)).length + option.itemIds.filter(id => defensiveOnly(id, items)).length <= MAX_DEFENSIVE
    const option = ranked.find(allowed) ?? ranked[0]!
    held.push(...option.itemIds)
    return { slot, option, answer, overruled: !!answer && answer.choice !== option.key }
  })
}
