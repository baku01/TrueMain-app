import type { KitRunePage } from '#shared/types/kit'
import { tr } from '#common/utils/i18n'
import { LOBBY_RUNE_TARGET } from '~/composables/useLobbySlots'

/** What the shell answers when every rune page is the player's own (`runes.rs`). */
const NO_SLOT = 'no-slot'

/**
 * The rune import button's one call (#1678): the page on screen pushed into
 * the client as the TrueMain page, and selected. Only ever run on a click —
 * the shell's write path is built on that rule (`lcu::runes`).
 *
 * Every outcome is said in a toast: an import that fails silently is worse
 * than one that says why.
 *
 * Under a Swiftplay lobby slot's build the page goes onto that slot instead
 * (`LOBBY_RUNE_TARGET`, `useLobbySlots`): the game reads each slot's own page.
 */
export function useRuneImport() {
  const { state } = useLcuState()
  const toast = useToast()
  const pending = ref(false)
  const done = ref(false)
  let doneTimer: ReturnType<typeof setTimeout> | undefined
  const lobbyTarget = inject(LOBBY_RUNE_TARGET, null)

  /** The client has to be there to take the page. */
  const available = computed(() => state.value.connected)

  async function importRunes(page: KitRunePage, champion: string) {
    if (pending.value) return
    pending.value = true
    try {
      let description = insideTauri() ? tr('build.runes.importedDescription') : tr('build.devNothingSent')
      if (lobbyTarget) {
        description = await lobbyTarget(page)
      }
      else if (insideTauri()) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('import_runes', { champion, page })
      }
      done.value = true
      clearTimeout(doneTimer)
      doneTimer = setTimeout(() => (done.value = false), 2500)
      toast.add({
        title: tr('build.runes.imported'),
        description,
        icon: 'i-lucide-check',
        color: 'success',
      })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.add(message === NO_SLOT
        ? {
            title: tr('build.runes.noSlot'),
            description: tr('build.runes.noSlotDescription'),
            icon: 'i-lucide-triangle-alert',
            color: 'warning',
          }
        : {
            title: tr('build.runes.failed'),
            description: message,
            icon: 'i-lucide-circle-x',
            color: 'error',
          })
    }
    finally {
      pending.value = false
    }
  }

  onScopeDispose(() => clearTimeout(doneTimer))

  return { available, pending, done, importRunes }
}
