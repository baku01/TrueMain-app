import type { ChampionItemContextResponse } from '#shared/types/item-context'
import type { BuildOption } from '~/types/build'
import { tr } from '#common/utils/i18n'
import type { ItemSetBuild } from '~/utils/item-set'
import { hasItems, itemSetBuild, situationalFromContext, situationalFromTree } from '~/utils/item-set'

/** What the shell answers when it could not read the client's list (`itemsets.rs`). */
const READ_FAILED = 'read-failed'
/** What the shell answers when the player's own sets no longer read the same. */
const SETS_CHANGED = 'sets-changed'
/** What the shell answers for a build with no item to write. */
const EMPTY_BUILD = 'empty-build'

/** The build the button imports, and whose it is. */
export interface ItemSetSubject {
  championId: number
  champion: string
  position: string
  build: BuildOption
}

/** A build already laid out in the set's blocks (the Jev page's), and whose it is. */
export interface ItemSetBlocks {
  championId: number
  champion: string
  blocks: ItemSetBuild
}

/**
 * The item set import button's one call (#1908): the build on screen written
 * into the client as the one TrueMain item set, replacing the previous one.
 * Only ever run on a click — the shell's write path is built on that rule
 * (`lcu::item_sets`).
 *
 * The situational block needs the item context, asked for here, on the click,
 * rather than for every build the view shows.
 */
export function useItemSetImport() {
  const { state } = useLcuState()
  const { items } = useStaticData()
  const toast = useToast()
  const pending = ref(false)
  const done = ref(false)
  let doneTimer: ReturnType<typeof setTimeout> | undefined

  /** The client has to be there to take the set. */
  const available = computed(() => state.value.connected)

  /** The situational items: the slice's verdicts, else the tree's other branches. */
  async function situational(subject: ItemSetSubject): Promise<number[]> {
    const path = subject.build.core.itemPath?.itemIds ?? []
    try {
      const context = await apiGet<ChampionItemContextResponse>(`/champions/${subject.championId}/item-context`, { position: subject.position })
      const fromContext = situationalFromContext(context.items, path)
      if (fromContext.length > 0) return fromContext
    }
    catch {
      // No context is not a failed import: the tree still says what else was built.
    }
    return situationalFromTree(subject.build.buildTree, path)
  }

  const known = (itemId: number) => itemId in items.value

  /** The one write path: the blocks made on the click, checked, written, and every outcome told. */
  async function write(championId: number, champion: string, blocks: () => Promise<ItemSetBuild>) {
    if (pending.value) return
    pending.value = true
    try {
      const build = await blocks()
      if (!hasItems(build)) throw new Error(EMPTY_BUILD)
      if (insideTauri()) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('import_item_set', { championId, champion, build })
      }
      done.value = true
      clearTimeout(doneTimer)
      doneTimer = setTimeout(() => (done.value = false), 2500)
      toast.add({
        title: tr('kit.import.itemsDone'),
        description: insideTauri() ? tr('build.items.importedDescription', { champion }) : tr('build.devNothingSent'),
        icon: 'i-lucide-check',
        color: 'success',
      })
    }
    catch (error) {
      toast.add(itemSetFailureToast(error instanceof Error ? error.message : String(error)))
    }
    finally {
      pending.value = false
    }
  }

  /** A build view's build: its core blocks, and the situational items the item context or the tree gives. */
  async function importItemSet(subject: ItemSetSubject | ItemSetBlocks) {
    if ('blocks' in subject) {
      const keep = (ids: number[]) => ids.filter(known)
      const { starter, boots, core, situational: rest } = subject.blocks
      return write(subject.championId, subject.champion, async () => ({ starter: keep(starter), boots: keep(boots), core: keep(core), situational: keep(rest) }))
    }
    return write(subject.championId, subject.champion, async () => itemSetBuild(subject.build.core, await situational(subject), known))
  }

  onScopeDispose(() => clearTimeout(doneTimer))

  return { available, pending, done, importItemSet }
}

/** How a failed import is told, shared with a kit's (`useKitImport`). */
export function itemSetFailureToast(message: string) {
  switch (message) {
    case READ_FAILED:
      return {
        title: tr('build.items.readFailed'),
        description: tr('build.items.readFailedDescription'),
        icon: 'i-lucide-circle-x',
        color: 'error' as const,
      }
    case SETS_CHANGED:
      return {
        title: tr('build.items.setsChanged'),
        description: tr('build.items.setsChangedDescription'),
        icon: 'i-lucide-triangle-alert',
        color: 'warning' as const,
      }
    case EMPTY_BUILD:
      return {
        title: tr('build.items.empty'),
        description: tr('build.items.emptyDescription'),
        icon: 'i-lucide-triangle-alert',
        color: 'warning' as const,
      }
    default:
      return {
        title: tr('build.items.failed'),
        description: message,
        icon: 'i-lucide-circle-x',
        color: 'error' as const,
      }
  }
}
