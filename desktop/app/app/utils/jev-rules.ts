import type { ItemRead } from '~/utils/jev-read'
import type { Resist } from '~/utils/jev-needs'
import type { JevSlot } from '~/utils/jev-build'
import type { ItemOption } from '~/utils/sources/model'
import { MIN_GAMES } from '~/utils/jev-build'

/**
 * LoLTheory's draft rules (blog.loltheory.gg), those the needs model can
 * hold, as `utils/jev-recommend` and `useJevBuild` apply them. Every number
 * here is theirs; none was measured by us.
 */

/**
 * When a resistance is due: two or more enemies dealing mostly physical damage
 * call for "your first armor item before or during your second item slot"
 * (/what-is-armor-league-of-legends), two or more dealing mostly magic damage
 * for "your first MR item before or during your third item slot"
 * (/what-is-magic-resist-league-of-legends). An item slot is a completed
 * item, boots apart: the articles name Plated Steelcaps and Mercury's Treads
 * apart from the rule, as a marksman's choice.
 */
export const RESIST_DUE: Record<Resist, { enemies: number, by: number }> = {
  physical: { enemies: 2, by: 2 },
  magic: { enemies: 2, by: 3 },
}

/** The resistances the enemy team triggers: enough of its champions dealing mostly that kind of damage, as Blitz measures their split. */
export function duesOf(enemies: { physical: number, magic: number }[]): Resist[] {
  const count = (resist: Resist) => enemies.filter(enemy => (resist === 'physical' ? enemy.physical > enemy.magic : enemy.magic > enemy.physical)).length
  return (['physical', 'magic'] as const).filter(resist => count(resist) >= RESIST_DUE[resist].enemies)
}

const RESIST_TAG: Record<Resist, string> = { physical: 'Armor', magic: 'SpellBlock' }

/**
 * The resistances due at item slot `slot` (1 the first completed item), the
 * build holding `held`: triggered, the slot at the rule's or past it, and no
 * completed item of that resistance held yet — boots do not count.
 */
export function dueAt(dues: Resist[], slot: number, held: number[], tags: (id: number) => string[]): Resist[] {
  return dues.filter(resist => slot >= RESIST_DUE[resist].by && !held.some(id => tags(id).includes(RESIST_TAG[resist]) && !tags(id).includes('Boots')))
}

/**
 * One Grievous Wounds item is enough: "GW is a binary on/off debuff…
 * Multiple simultaneous GW sources do not stack the reduction past 40%"
 * (/grievous-wounds-lol). The game's own item groups (`utils/item-groups`)
 * limit Mortal Reminder only as a Last Whisper item and Thornmail only with
 * Bramble Vest, so nothing else keeps Morellonomicon and Thornmail, or
 * Chempunk Chainsword and Mortal Reminder, out of one build. An item cuts
 * healing where Jev read so — a yes, its probability past even.
 */
const cutsHealing = (id: number, reads: Map<number, ItemRead>) => (reads.get(id)?.antiHeal ?? 0) > 0.5

/** Whether `id` can join `held` without a second Grievous Wounds item. */
export const healCutFits = (id: number, held: readonly number[], reads: Map<number, ItemRead>): boolean =>
  !cutsHealing(id, reads) || !held.some(other => cutsHealing(other, reads))

/**
 * When boots are finished, for an enchanter support: "Upgrade boots after your
 * second item, not first" (/how-to-play-support-lol) — the boots' timing at
 * its lowest urgency, after the second item. An enchanter is a support whose
 * Riot classes are Support then Mage, as are the article's four (Lulu,
 * Soraka, Janna, Nami); elsewhere Jev's reading of the lane stands.
 */
export function bootsUrgency(urgency: number | null, champion: { classes: string[] }, position: string): number | null {
  const enchanter = position === 'UTILITY' && champion.classes[0] === 'Support' && champion.classes[1] === 'Mage'
  return enchanter ? 0 : urgency
}

/**
 * The boots slot offers its three most played pairs, and past them the pairs
 * that answer this draft: Plated Steelcaps "for ADCs facing an AD assassin or
 * heavy auto-attacks" (/what-is-armor-league-of-legends), Mercury's Treads
 * into hard crowd control (/what-is-cc-league-of-legends) — on Caitlyn,
 * Steelcaps are only the fifth pair (626 games), and the rule never had them
 * to choose. Each still needs its games (`MIN_GAMES`); its statistics read as
 * any option's, against the slot's most played.
 */
export function withDraftBoots(slot: JevSlot, boots: ItemOption[], label: (id: number) => string, answers: (id: number) => boolean): JevSlot {
  if (slot.kind !== 'boots') return slot
  const shown = new Set(slot.options.map(option => option.itemIds[0]))
  const extra = boots.filter(pair => pair.games >= MIN_GAMES && !shown.has(pair.itemIds[0]) && answers(pair.itemIds[0]!))
  if (!extra.length) return slot
  return {
    ...slot,
    options: [...slot.options, ...extra.map((pair, index) => ({ key: `o${slot.options.length + index}`, games: pair.games, pickRate: pair.pickRate, winRate: pair.winRate, itemIds: pair.itemIds.slice(0, 1), label: label(pair.itemIds[0]!) }))],
  }
}
