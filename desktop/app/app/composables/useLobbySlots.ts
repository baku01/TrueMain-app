import type { InjectionKey } from 'vue'
import type { KitRunePage } from '#shared/types/kit'
import type { SlotPatch } from '~/utils/lobby-slots'
import { tr } from '#common/utils/i18n'
import { slotPerks } from '~/utils/lobby-slots'
import { spellsInOrder } from '~/composables/useAutoImport'

/** What the shell answers for a champion the client does not offer the player (`lobby.rs`). */
const NOT_PICKABLE = 'not-pickable'
/** What the shell answers when the slot is gone: the lobby changed queue, or was left. */
const NO_SLOT = 'no-slot'

/**
 * Where the rune import button sends a page instead of the client's rune
 * pages, under a lobby slot's build (`useRuneImport`). Resolves with the
 * toast's description; rejects with what went wrong.
 */
export const LOBBY_RUNE_TARGET: InjectionKey<(page: KitRunePage) => Promise<string>> = Symbol('LobbyRuneTarget')

/**
 * The lobby builds' writes (Swiftplay): a slot's champion, lane, spells and
 * runes, each from its own button (`lobby.rs`) — never on a build arriving,
 * a phase change or a timer, so the screen stays read-only until the player
 * clicks. The client pushes the changed lobby back, which redraws the slot.
 *
 * Runes go on the slot (`perks`), not into a new rune page: the game reads
 * each Swiftplay champion's page off its slot, so a page selected in the
 * client's list would not reach the game. Item sets need nothing of the lobby
 * — they are files per champion — and the build view's own button writes them.
 *
 * Every outcome is said in a toast; in a plain browser nothing is sent.
 */
export function useLobbySlots() {
  const toast = useToast()
  const { settings } = useAutoImport()
  /** The champions the client lets the player put in a slot; null while unknown, which lists every champion. */
  const pickable = useState<number[] | null>('lobby-pickable', () => null)
  /** The button whose write is out (`champion-0`, `spells-1`…), so it spins and the others wait. */
  const pending = ref<string | null>(null)

  async function loadChoices() {
    if (!insideTauri()) return
    const { invoke } = await import('@tauri-apps/api/core')
    pickable.value = await invoke<number[] | null>('lobby_choices').catch(() => null)
  }

  function failure(error: unknown): string {
    const message = String(error)
    if (message === NOT_PICKABLE) return tr('lobby.error.notPickable')
    if (message === NO_SLOT) return tr('lobby.error.noSlot')
    return message
  }

  /** The one write path. Throws what went wrong, for the caller to say. */
  async function send(slot: number, patch: SlotPatch) {
    if (!insideTauri()) return
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('lobby_slot_set', { slot, patch }).catch((error: unknown) => {
      throw new Error(failure(error))
    })
  }

  async function write(key: string, slot: number, patch: SlotPatch, title: string) {
    if (pending.value) return
    pending.value = key
    try {
      await send(slot, patch)
      toast.add({ title, description: insideTauri() ? tr('lobby.toast.sent') : tr('build.devNothingSent'), icon: 'i-lucide-check', color: 'success' })
    }
    catch (error) {
      toast.add({ title: tr('lobby.error.failed'), description: error instanceof Error ? error.message : String(error), icon: 'i-lucide-circle-x', color: 'error' })
    }
    finally {
      pending.value = null
    }
  }

  const setChampion = (slot: number, championId: number, name: string) =>
    write(`champion-${slot}`, slot, { championId }, tr('lobby.toast.champion', { champion: name }))

  const setLane = (slot: number, position: string) =>
    write(`lane-${slot}`, slot, { position }, tr('lobby.toast.lane'))

  /** The build's two spells, Flash on the key Settings puts it on, as champion select's import does. */
  function importSpells(slot: number, spells: [number, number]) {
    const [spell1, spell2] = spellsInOrder(spells[0], spells[1], settings.value.flash)
    return write(`spells-${slot}`, slot, { spell1, spell2 }, tr('lobby.toast.spells'))
  }

  /** The rune import button's target for slot `slot` (`LOBBY_RUNE_TARGET`). */
  async function importRunes(slot: number, page: KitRunePage): Promise<string> {
    const perks = slotPerks(page)
    if (!perks) throw new Error(tr('lobby.error.incompleteRunes'))
    await send(slot, { perks })
    return insideTauri() ? tr('lobby.toast.runes') : tr('build.devNothingSent')
  }

  return { pickable, pending, loadChoices, setChampion, setLane, importSpells, importRunes }
}
