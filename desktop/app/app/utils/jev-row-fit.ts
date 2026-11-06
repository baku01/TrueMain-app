import type { BuildOption } from '~/types/build'
import type { ItemRead } from '~/utils/jev-read'
import type { Answer, Needs } from '~/utils/jev-recommend'
import { answersDraft, fitOf } from '~/utils/jev-recommend'

/**
 * Jev's reading of the build list's rows (`BuildList`, the compact header's
 * buttons): once Jev has answered for a champion, lane and draft, how each
 * row's items answer the draft — the team's needs as Jev read the kits,
 * each item's answer to them (`fitOf`), and which of its items answer the
 * draft on their own (`answersDraft`). No new call: the item reads Jev made
 * are kept per patch, champion, lane and item. A row with a completed item
 * Jev did not read gets no mark — never a guess. The row that fits best is
 * Jev's pick for this draft; the player's previous build is read the same
 * way, which says whether the last build still suits this draft.
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
  const fit = fitOf(items, needs, reads, tags)
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
