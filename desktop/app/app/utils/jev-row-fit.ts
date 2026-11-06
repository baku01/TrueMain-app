import type { BuildOption } from '~/types/build'
import type { ItemRead } from '~/utils/jev-read'
import type { Answer, Needs } from '~/utils/jev-recommend'
import { answersDraft, fitOf } from '~/utils/jev-recommend'
import { BOOTS } from '~/utils/item-groups'

/**
 * Jev's reading of the build list's rows (`BuildList`, the compact header's
 * buttons): once Jev has answered for a champion, lane and draft, how each
 * row's items answer the draft — the team's needs as Jev read the kits,
 * each item's answer to them (`fitOf`), and which of its items answer the
 * draft on their own (`answersDraft`). No new call: the item reads Jev made
 * are kept per patch, champion, lane and item. A row with a completed item
 * Jev did not read gets no mark — never a guess. The row that fits best is
 * Jev's pick for this draft; the player's previous build is read the same
 * way, which says whether the last build still suits this draft. The items
 * weigh by their place, as LoLTheory weighs a build (`ROW_WEIGHTS`).
 */

export interface RowFit {
  /** 0–1: how much of what the team throws at us the row's items answer, halved when one only resists what it does not deal. */
  score: number
  /** The needs answered, most first. */
  answers: Answer[]
  misfit: boolean
  /** The row's items that answer the draft on their own. */
  answering: number[]
}

/**
 * How much each of a row's items weighs in its fit: LoLTheory's build score
 * weighs the first item 25, then 17.5, 12.5, 7.5 and 2.5, the boots 5 (its
 * site's `v=[25,17.5,12.5,7.5,2.5]`; the rest of its 100 is runes, spells,
 * skills and starter, which a row's fit does not read) — the first item is
 * most of a build, the fifth little of it. A sixth, which LoLTheory does not
 * score, weighs as the fifth.
 */
export const ROW_WEIGHTS = { items: [25, 17.5, 12.5, 7.5, 2.5], boots: 5 } as const

/** Each item's weight in a row (`ROW_WEIGHTS`): boots as boots, the rest by their place among the row's items. */
export function rowWeights(items: number[]): number[] {
  let place = 0
  return items.map(id => (BOOTS.has(id) ? ROW_WEIGHTS.boots : ROW_WEIGHTS.items[Math.min(place++, ROW_WEIGHTS.items.length - 1)]!))
}

/** A row's completed items: its path, then its boots. */
export const rowItems = (option: BuildOption): number[] => [...(option.core.itemPath?.itemIds ?? []), ...(option.core.boots?.itemIds ?? []).slice(0, 1)]

/** One row's fit; null when it has no item, or one Jev did not read. */
export function rowFit(items: number[], needs: Needs, readOf: (id: number) => ItemRead | undefined, tags: (id: number) => string[]): RowFit | null {
  if (!items.length) return null
  const reads = new Map<number, ItemRead>()
  for (const id of items) {
    const read = readOf(id)
    if (!read) return null
    reads.set(id, read)
  }
  const fit = fitOf(items, needs, reads, tags, { weights: rowWeights(items) })
  return {
    score: fit.fit * (fit.misfit ? 0.5 : 1),
    answers: fit.answers,
    misfit: fit.misfit,
    answering: [...new Set(items)].filter(id => answersDraft(id, needs, reads, tags)),
  }
}

/** Every readable row's fit, by its key, and the best of them — Jev's pick, the first on a tie; none when no row answers anything. */
export function rowFits(options: BuildOption[], needs: Needs, readOf: (id: number) => ItemRead | undefined, tags: (id: number) => string[]): { fits: Map<string, RowFit>, best: string | null } {
  const fits = new Map<string, RowFit>()
  let best: string | null = null
  for (const option of options) {
    const fit = rowFit(rowItems(option), needs, readOf, tags)
    if (!fit) continue
    fits.set(option.key, fit)
    if (fit.score > 0 && (best === null || fit.score > fits.get(best)!.score + 1e-9)) best = option.key
  }
  return { fits, best }
}
