import type { Kit } from '#shared/types/kit'
import { tr } from '#common/utils/i18n'
import { itemSetFailureToast } from '~/composables/useItemSetImport'
import { kitItemSetBlocks } from '~/utils/item-set'

/** What the shell answers outside champion select (`lcu::Refusal::NotYourTurn`). */
const NOT_IN_CHAMP_SELECT = 'not-your-turn'

/**
 * A kit's two writes beyond the rune page (#2185), each the twin of a build's
 * import and only ever run on its click: the kit's tree as the one TrueMain
 * item set — one block per path, after the starter and the boots — and its
 * summoner spells into the player's champion select (`my-selection`). The
 * rune page goes through the build's own import (`useRuneImport`), into the
 * same TrueMain page.
 */
export function useKitImport() {
  const { state } = useLcuState()
  const { items } = useStaticData()
  const toast = useToast()
  const pending = ref<'items' | 'spells' | null>(null)

  const available = computed(() => state.value.connected)
  /** Spells can only be written while a champion select runs. */
  const inChampSelect = computed(() => state.value.connected && state.value.phase === 'ChampSelect')

  const dev = () => (insideTauri() ? null : tr('build.devNothingSent'))

  async function importItems(kit: Kit, champion: string) {
    if (pending.value) return
    pending.value = 'items'
    try {
      const name = (itemId: number) => items.value[itemId]?.name ?? tr('kit.slots.item', { id: itemId })
      const blocks = kitItemSetBlocks(kit, name, itemId => itemId in items.value)
      if (blocks.length === 0) throw new Error('empty-build')
      if (insideTauri()) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('import_kit_item_set', { championId: kit.championId, champion, blocks })
      }
      toast.add({ title: tr('kit.import.itemsDone'), description: dev() ?? tr('kit.import.itemsDoneDescription', { champion }), icon: 'i-lucide-check', color: 'success' })
    }
    catch (error) {
      toast.add(itemSetFailureToast(error instanceof Error ? error.message : String(error)))
    }
    finally {
      pending.value = null
    }
  }

  async function importSpells(kit: Kit) {
    if (pending.value) return
    pending.value = 'spells'
    try {
      if (insideTauri()) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('champ_select_spells', { spell1Id: kit.spells[0], spell2Id: kit.spells[1] })
      }
      toast.add({ title: tr('kit.import.spellsDone'), description: dev() ?? tr('kit.import.spellsDoneDescription'), icon: 'i-lucide-check', color: 'success' })
    }
    catch (error) {
      const message = String(error)
      toast.add(message === NOT_IN_CHAMP_SELECT
        ? { title: tr('kit.import.notInChampSelect'), description: tr('kit.import.notInChampSelectDescription'), icon: 'i-lucide-triangle-alert', color: 'warning' }
        : { title: tr('kit.import.spellsFailed'), description: message, icon: 'i-lucide-circle-x', color: 'error' })
    }
    finally {
      pending.value = null
    }
  }

  return { available, inChampSelect, pending, importItems, importSpells }
}
