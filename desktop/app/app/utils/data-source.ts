import { readonly, shallowRef } from 'vue'

/**
 * Where the app reads its numbers (Settings, personal build only): TrueMain,
 * or another source — Blitz, op.gg (its official API), lolalytics or
 * Tencent (both experimental: read off public endpoints they do not
 * document). Kept across launches. Every read that has a counterpart in the
 * chosen source asks it first (`apiGet`, `readChampionBuild`,
 * `utils/sources`); a read with none stays on TrueMain whatever the choice.
 *
 * A module-level ref rather than `useState`: `apiGet` is called outside any
 * component. Changing the source reloads the window (`setDataSource`), so the
 * session caches every page keeps are never a mix of two.
 */
export const DATA_SOURCES = ['truemain', 'blitz', 'opgg', 'lolalytics', 'tencent'] as const

export type DataSource = typeof DATA_SOURCES[number]

/** The sources whose reads are not TrueMain's. */
export type ExternalSource = Exclude<DataSource, 'truemain'>

const STORAGE_KEY = 'truemain-data-source'

function readStored(): DataSource {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return (DATA_SOURCES as readonly string[]).includes(stored ?? '') ? stored as DataSource : 'truemain'
  }
  catch {
    return 'truemain'
  }
}

const current = shallowRef<DataSource>(import.meta.client ? readStored() : 'truemain')

export const dataSource = readonly(current)

export const fromBlitz = () => current.value === 'blitz'

/** The source the reads go to when it is not TrueMain; null on TrueMain. */
export const externalSource = (): ExternalSource | null => (current.value === 'truemain' ? null : current.value)

/**
 * The elo bracket another source reads when none is picked: the one its own
 * site opens on (lolalytics, Blitz and op.gg all open on Emerald+), not
 * TrueMain's Master+ — on lolalytics, Aatrox's top lane on one patch is 3,370
 * games in Master+ and 18,877 in Emerald+.
 */
export const SOURCE_ELO_BRACKET = 'EMERALD_PLUS'

/**
 * Tell the shell whether TrueMain is the source: with another one it refuses
 * every request to TrueMain's API, the ones it makes on its own included, and
 * keeps the choice for the next launch (`api.rs`).
 */
export async function syncDataSourceWithShell(source: DataSource = current.value) {
  if (!insideTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_data_source', { external: source !== 'truemain' }).catch(() => {})
}

export async function setDataSource(next: DataSource) {
  if (next === current.value) return
  try {
    localStorage.setItem(STORAGE_KEY, next)
  }
  catch {
    // Storage unavailable: the choice holds until the window closes.
  }
  current.value = next
  await clearSourceCache()
  await syncDataSourceWithShell(next)
  window.location.reload()
}

/** The shell's kept source answers dropped, so the reloaded window reads afresh (`sources.rs`). */
async function clearSourceCache() {
  if (!insideTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('clear_source_cache').catch(() => {})
}
