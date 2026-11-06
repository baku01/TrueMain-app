import type { KitRunePage } from '#shared/types/kit'
import type { LobbySlot } from '~/types/lcu'

/**
 * The lobby builds' pure rules (Swiftplay, `components/lobby`): what a slot's
 * rune page is written as, which lanes a slot may move to, and which
 * champions its picker lists.
 */

/** The lanes a slot can queue for, in the client's order. */
export const LOBBY_LANES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const

/** One change to a slot, as `lobby_slot_set` takes it (`SlotPatch` in `crates/lcu/src/lobby.rs`). */
export interface SlotPatch {
  championId?: number
  position?: string
  spell1?: number
  spell2?: number
  perks?: string
}

/**
 * A build's rune page as the client keeps it on a slot (`perks`): a JSON
 * document in a string, the nine perks in the client's order — the keystone,
 * the primary tree's three, the secondary's two, the three shards — and the
 * two trees, as Blitz writes it. The game reads each slot's own page, so this,
 * not a new rune page, is what an import changes in the lobby. Null for a page
 * with a hole in it, which the client would take and leave the player to find.
 */
export function slotPerks(page: KitRunePage): string | null {
  const perkIds = [
    page.primaryKeystoneId,
    page.primaryPerk1Id,
    page.primaryPerk2Id,
    page.primaryPerk3Id,
    page.secondaryPerk1Id,
    page.secondaryPerk2Id,
    page.statOffense,
    page.statFlex,
    page.statDefense,
  ]
  const complete = page.primaryStyleId > 0 && page.secondaryStyleId > 0 && perkIds.every(id => id > 0)
  return complete ? JSON.stringify({ perkIds, perkStyle: page.primaryStyleId, perkSubStyle: page.secondaryStyleId }) : null
}

/** The lanes slot `index` may move to: every lane but those the other slots hold. */
export function lanesFor(slots: LobbySlot[], index: number): string[] {
  const taken = new Set(slots.filter((_, at) => at !== index).map(slot => slot.position))
  return LOBBY_LANES.filter(lane => !taken.has(lane))
}

/** A name as the picker matches it: no case, no accent, no space or apostrophe (`kogmaw` finds Kog'Maw). */
export function searchKey(name: string): string {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
}

/**
 * The champions a slot's picker lists: those the client lets the player play
 * (every champion while it has not said), matching the term when there is
 * one. Without a term the player's own pool comes first, most played first,
 * then the rest by name — the picks a player usually reaches for.
 */
export function pickerChampions(
  champions: { id: number, name: string }[],
  pickable: readonly number[] | null,
  pool: readonly number[],
  term: string,
): { id: number, name: string }[] {
  const allowed = pickable ? new Set(pickable) : null
  const playable = champions.filter(champion => !allowed || allowed.has(champion.id))
  const byName = [...playable].sort((a, b) => a.name.localeCompare(b.name))
  const key = searchKey(term)
  if (key) return byName.filter(champion => searchKey(champion.name).includes(key))
  const rank = new Map(pool.map((id, at) => [id, at]))
  return [
    ...byName.filter(champion => rank.has(champion.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!),
    ...byName.filter(champion => !rank.has(champion.id)),
  ]
}
