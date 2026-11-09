import type { ItemRead } from '~/utils/jev-read'
import type { EnemyLine, Needs, Resist } from '~/utils/jev-needs'
import type { ItemOption } from '~/utils/sources/model'
import type { DraftItemBlock } from '~/utils/item-set'
import { ANSWER_SHARE, MIN_GAMES } from '~/utils/jev-build'
import { STANDS_OUT, answerTo, causesOf, draftNeeds, fitOf } from '~/utils/jev-needs'
import { RESIST_DUE } from '~/utils/jev-rules'

/**
 * "Optional by the draft": each need of the enemy team that stands out
 * (`draftNeeds`), the enemies behind it (`causesOf`), and the champion's own
 * items that answer it — what its players buy on the lane when a game calls
 * for it, beside the build, which takes only what a slot's ranking chose.
 * Hexgate labels its items by the threat they counter ("Heavy AP",
 * "Healing") and names the enemies; Blitz and ABSOL write such items into the
 * client's item set. Shown on the Jev board and in champion select, and
 * written into the item set as one block per need (`draftBlocks`).
 */

export interface DraftOptionalItem {
  id: number
  /** How much of the need it answers (`fitOf`'s answer to it). */
  value: number
  games: number
  winRate: number
  /** The build already holds it. */
  inBuild: boolean
}

export interface DraftOptional {
  need: keyof Needs
  /** How much the draft calls for it, 0–1 (`callsOf`). */
  call: number
  /** The item slot a rule makes it due by (`RESIST_DUE`), where it does. */
  dueBy: number | null
  /** The enemies behind it, most first. */
  enemies: number[]
  items: DraftOptionalItem[]
}

/** How many items a need lists. */
export const PER_NEED = 4

/** Answers this close read as one, the more played first: Jev's reads are probabilities, and the more played of two near equals is the surer. */
const TIE = 0.05

export interface OptionalsInput {
  /** The champion's items on the lane — completed items and boots — with their measures; an item listed twice keeps its larger sample. */
  candidates: ItemOption[]
  team: Needs
  /** The resistances a rule makes due against this team (`duesOf`): they read as fully needed. */
  due: Resist[]
  /** The enemies as the needs read them, to name those behind each need. */
  enemies: EnemyLine[]
  reads: Map<number, ItemRead>
  tags: (id: number) => string[]
  /** Whether the build can use the item (`damageKind`: no ability power item on a build of attack damage). */
  suits: (id: number) => boolean
  /** What the build holds. */
  held: number[]
}

/**
 * The needs of the draft that stand out, a due resistance first, each with
 * up to `PER_NEED` of the champion's items that answer it (`STANDS_OUT`): most
 * first, the more played on a near tie; seen in `MIN_GAMES` games and
 * `ANSWER_SHARE` of the champion's games or more, as the build's answers
 * (Randuin's Omen in 686 of Jinx's 262,000 is none),
 * never a misfit (a resistance against damage the team does not deal). A need
 * no item answers is left out.
 */
export function draftOptionals(input: OptionalsInput): DraftOptional[] {
  const { team, due, enemies, reads, tags, suits, held } = input
  const byId = new Map<number, ItemOption>()
  for (const option of input.candidates) {
    const id = option.itemIds[0]
    if (id === undefined || option.games < MIN_GAMES || option.pickRate < ANSWER_SHARE || !suits(id)) continue
    if ((byId.get(id)?.games ?? 0) < option.games) byId.set(id, option)
  }
  const fits = [...byId].map(([id, option]) => ({ id, option, fit: fitOf([id], team, reads, tags, { due }) })).filter(entry => !entry.fit.misfit)
  const band = (value: number) => Math.round(value / TIE)
  return draftNeeds(team, due).map(({ need, value }): DraftOptional => ({
    need,
    call: value,
    dueBy: need === 'physical' || need === 'magic' ? (due.includes(need) ? RESIST_DUE[need].by : null) : null,
    enemies: causesOf(need, enemies),
    items: fits
      .map(({ id, option, fit }) => ({ id, value: answerTo(fit.answers, need), games: option.games, winRate: option.winRate, inBuild: held.includes(id) }))
      .filter(item => item.value >= STANDS_OUT)
      .sort((a, b) => band(b.value) - band(a.value) || b.games - a.games)
      .slice(0, PER_NEED),
  })).filter(optional => optional.items.length > 0)
}

/** The optionals as the item set's blocks, one per need, the enemies behind it named: its title is written at import time, in the app's language. */
export const draftBlocks = (optionals: DraftOptional[], nameOf: (id: number) => string): DraftItemBlock[] =>
  optionals.map(optional => ({ need: optional.need, names: optional.enemies.map(nameOf), items: optional.items.map(item => item.id) }))
