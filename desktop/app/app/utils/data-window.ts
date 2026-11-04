import { readonly, shallowRef } from 'vue'

/**
 * Which games the sources read (Settings): the current patch, the one before
 * it, a patch picked by its number (`patch:16.20`), or `auto` — the current
 * patch once it has games enough, the one before while it is new (a patch a
 * day old holds a hundredth of the last one's games). The live patch until
 * the player picks another. Kept across launches; changing it reloads
 * the window, like the source (`setDataSource`), so no session cache mixes
 * two windows.
 *
 * Only lolalytics takes a window. Blitz, op.gg and Tencent answer their own
 * latest patch whatever is asked; Settings says so.
 */
export const DATA_WINDOWS = ['current', 'previous', 'auto'] as const
/** A window by name, or one patch by its number (`patch:16.20`). */
export type DataWindow = typeof DATA_WINDOWS[number] | `patch:${string}`

/** How many patches back a specific one may be picked: lolalytics keeps about ten. */
export const PATCHES_BACK = 10

const isWindow = (value: string): value is DataWindow => (DATA_WINDOWS as readonly string[]).includes(value) || /^patch:\d+\.\d+$/.test(value)

const STORAGE_KEY = 'truemain-data-window'
/** Until the player picks otherwise, every page reads the live patch. */
const DEFAULT_WINDOW: DataWindow = 'current'

function readStored(): DataWindow {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored && isWindow(stored) ? stored : DEFAULT_WINDOW
  }
  catch {
    return DEFAULT_WINDOW
  }
}

const current = shallowRef<DataWindow>(import.meta.client ? readStored() : DEFAULT_WINDOW)

export const dataWindow = readonly(current)

export function setDataWindow(next: DataWindow) {
  if (next === current.value) return
  try {
    localStorage.setItem(STORAGE_KEY, next)
  }
  catch {
    // Storage unavailable: the choice holds until the window closes.
  }
  current.value = next
  void clearSourceCache().finally(() => window.location.reload())
}

/** The patches a specific one may be picked from, newest first: `16.22.1` → `16.22`, `16.21`, … */
export function recentPatches(version: string, count = PATCHES_BACK): string[] {
  const [major, minor] = version.split('.').map(Number)
  if (!major || !minor) return []
  return Array.from({ length: Math.min(count + 1, minor) }, (_, back) => `${major}.${minor - back}`)
}

/** `16.22.1` → `16.21`; null for a first patch of the year, which has no `.0` before it to read. */
export function previousPatch(version: string): string | null {
  const [major, minor] = version.split('.').map(Number)
  if (!major || !minor || minor <= 1) return null
  return `${major}.${minor - 1}`
}

/** The shell's kept source answers dropped, so the reloaded window reads afresh (`sources.rs`). */
async function clearSourceCache() {
  if (!insideTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('clear_source_cache').catch(() => {})
}
