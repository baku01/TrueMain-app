/** The shell's answer (`src-tauri/src/graphics.rs`). */
export interface GraphicsView {
  /** The saved choice. */
  hardwareAcceleration: boolean
  /** Whether the webview can really be told to draw without the GPU — Windows' WebView2; macOS' WKWebView cannot. */
  gpuSwitchable: boolean
  /** The saved choice applies to the webview after a restart. */
  restartRequired: boolean
}

/** Set on `<html>` while acceleration is off: `main.css` turns the GPU-heavy effects off under it. */
export const REDUCED_EFFECTS_CLASS = 'reduce-effects'

/** A browser-only `npm run dev` has no shell: the choice lives in memory. */
const DEV_VIEW: GraphicsView = { hardwareAcceleration: true, gpuSwitchable: false, restartRequired: false }

export function applyGraphicsClass(hardwareAcceleration: boolean) {
  if (import.meta.client) document.documentElement.classList.toggle(REDUCED_EFFECTS_CLASS, !hardwareAcceleration)
}

/**
 * Hardware acceleration. Off, the webview draws in software on Windows from
 * the next launch, and on both systems the blurs and endless animations stop
 * at once — on macOS that is all there is to turn off.
 */
export function useGraphics() {
  const view = useState<GraphicsView | null>('graphics-view', () => null)
  const busy = ref(false)

  async function call(command: string, args?: Record<string, unknown>): Promise<GraphicsView> {
    if (insideTauri()) {
      const { invoke } = await import('@tauri-apps/api/core')
      return await invoke<GraphicsView>(command, args)
    }
    const current = view.value ?? DEV_VIEW
    if (command === 'set_graphics_settings') return { ...current, hardwareAcceleration: args!.hardwareAcceleration as boolean }
    return current
  }

  async function load() {
    view.value = await call('graphics_settings')
    applyGraphicsClass(view.value.hardwareAcceleration)
  }

  async function setHardwareAcceleration(on: boolean) {
    if (busy.value) return
    busy.value = true
    try {
      view.value = await call('set_graphics_settings', { hardwareAcceleration: on })
      applyGraphicsClass(view.value.hardwareAcceleration)
    }
    finally {
      busy.value = false
    }
  }

  async function relaunch() {
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  }

  return { view, busy, load, setHardwareAcceleration, relaunch }
}
