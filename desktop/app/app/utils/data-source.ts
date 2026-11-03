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

export function setDataSource(next: DataSource) {
  if (next === current.value) return
  try {
    localStorage.setItem(STORAGE_KEY, next)
  }
  catch {
    // Storage unavailable: the choice holds until the window closes.
  }
  current.value = next
  window.location.reload()
}
