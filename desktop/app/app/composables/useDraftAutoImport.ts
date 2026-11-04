import type { KitRunePage } from '#shared/types/kit'
import type { DraftState } from '~/types/lcu'
import type { ImportBuild, ItemOrders } from '~/utils/recommended-item-set'
import { tr } from '#common/utils/i18n'
import { spellsInOrder } from '~/composables/useAutoImport'
import { readBlitzBuildDoc } from '~/utils/blitz/builds'
import { recommendedSets } from '~/utils/recommended-item-set'

/** The build selected in the draft, with what goes beyond its items: its rune page and spells. */
export interface ImportChoice extends ImportBuild {
  runePage: KitRunePage | null
  spells: [number, number] | null
}

/** What the build view tells (`BuildView`'s `selection`): the build on screen and the others offered. */
export interface DraftSelection {
  championId: number
  selected: ImportChoice | null
  others: ImportBuild[]
}

/**
 * The draft's automatic import (`useAutoImport`), the way Blitz does it: once
 * the player's champion is locked, the build selected on screen goes into the
 * client — its rune page as the TrueMain page, its spells (Flash on the
 * player's key) and, as recommended item sets the shop opens on in game,
 * every build offered, the selected one first, each block for block like
 * Blitz's (starting items, the buying order, the final build, situational
 * items, boots). Another build picked — a row, a pro's, a kit — is imported
 * in turn; a build that changes as enemies lock (the draft's own) is written
 * again. Never on a hover, never for another champion's build.
 *
 * What was written is remembered across the draft screen's remounts, so the
 * same build is not written twice; a new draft starts afresh.
 */
const written = { champion: null as number | null, runes: '', spells: '', items: '' }

export function useDraftAutoImport(draft: Ref<DraftState>, selection: Ref<DraftSelection | null>) {
  const { settings, enabled } = useAutoImport()
  const { state } = useLcuState()
  const { items } = useStaticData()
  const { nameOf, champions } = useChampionStatics()
  const { t } = useT()
  const toast = useToast()

  const locked = computed(() => draft.value.myChampionLocked && draft.value.myChampion !== null)

  watch(() => [draft.value.myChampion, locked.value] as const, ([champion, isLocked]) => {
    if (!isLocked || champion !== written.champion) Object.assign(written, { champion: isLocked ? champion : null, runes: '', spells: '', items: '' })
  }, { immediate: true })

  /** Blitz's measured buying order of each completed item, for the champion's lane; none when Blitz has none. */
  const orders = new Map<string, Promise<ItemOrders | null>>()
  function ordersFor(championId: number, position: string) {
    const key = `${championId}:${position}`
    let read = orders.get(key)
    if (!read) {
      read = readBlitzBuildDoc(championId, position).then(doc => doc?.itemOrders ?? null).catch(() => null)
      orders.set(key, read)
    }
    return read
  }

  let busy = false
  let again = false
  watch(() => JSON.stringify([locked.value, enabled.value, settings.value, selection.value]), () => void write())

  async function write() {
    if (busy) {
      again = true
      return
    }
    const current = selection.value
    const chosen = current?.selected
    if (!enabled.value || !locked.value || !current || !chosen || current.championId !== draft.value.myChampion || !state.value.connected || !insideTauri()) return
    busy = true
    const champion = nameOf(current.championId)
    const done: string[] = []
    try {
      const { invoke } = await import('@tauri-apps/api/core')

      const runesKey = `${chosen.key}|${JSON.stringify(chosen.runePage)}`
      if (settings.value.runes && chosen.runePage && written.runes !== runesKey) {
        written.runes = runesKey
        await invoke('import_runes', { champion: chosen.title, page: chosen.runePage }).then(() => done.push(tr('autoImport.part.runes')), (error: unknown) => {
          toast.add({ title: tr('build.runes.failed'), description: String(error) === 'no-slot' ? tr('build.runes.noSlotDescription') : String(error), icon: 'i-lucide-circle-x', color: 'error' })
        })
      }

      const spellsKey = `${chosen.key}|${chosen.spells?.join(',')}|${settings.value.flash}`
      if (settings.value.spells && chosen.spells && written.spells !== spellsKey) {
        written.spells = spellsKey
        const [spell1Id, spell2Id] = spellsInOrder(chosen.spells[0], chosen.spells[1], settings.value.flash)
        await invoke('champ_select_spells', { spell1Id, spell2Id }).then(() => done.push(tr('autoImport.part.spells')), (error: unknown) => {
          toast.add({ title: tr('kit.import.spellsFailed'), description: String(error), icon: 'i-lucide-circle-x', color: 'error' })
        })
      }

      const championKey = champions.value.get(current.championId)?.alias
      if (settings.value.items && championKey) {
        const titles = { starting: t('autoImport.block.starting'), order: t('autoImport.block.order'), final: t('autoImport.block.final'), situational: t('autoImport.block.situational'), boots: t('autoImport.block.boots') }
        const sets = recommendedSets(chosen, current.others, championKey, titles, items.value, await ordersFor(current.championId, draft.value.myPosition))
        const key = JSON.stringify(sets)
        if (sets.length && written.items !== key) {
          written.items = key
          await invoke('write_recommended_item_sets', { sets }).then(() => done.push(tr('autoImport.part.items')), (error: unknown) => {
            toast.add({ title: tr('build.items.failed'), description: String(error), icon: 'i-lucide-circle-x', color: 'error' })
          })
        }
      }

      if (done.length) toast.add({ title: tr('autoImport.done', { champion }), description: `${chosen.title} — ${done.join(' · ')}`, icon: 'i-lucide-download', color: 'success' })
    }
    finally {
      busy = false
      // A selection that changed while this one was written: written in turn.
      if (again) {
        again = false
        void write()
      }
    }
  }
}
