/**
 * Starting with the computer (`src-tauri/src/autostart.rs`), off until the
 * player turns it on. The system keeps the choice (a Launch Agent on macOS,
 * the `Run` key on Windows), so the page reads it from the shell rather than
 * remembering it; launched at login, the app stays in the tray.
 */
export function useAutostart() {
  const enabled = useState<boolean | null>('autostart-enabled', () => null)
  const busy = ref(false)

  /** A browser-only `npm run dev` has no shell: the choice lives in memory. */
  async function call(command: string, args?: Record<string, unknown>): Promise<boolean> {
    if (insideTauri()) {
      const { invoke } = await import('@tauri-apps/api/core')
      return await invoke<boolean>(command, args)
    }
    return command === 'set_autostart' ? args!.enabled as boolean : enabled.value ?? false
  }

  async function load() {
    enabled.value = await call('autostart_enabled').catch(() => false)
  }

  async function update(next: boolean) {
    if (busy.value || enabled.value === null) return
    busy.value = true
    try {
      enabled.value = await call('set_autostart', { enabled: next })
    }
    finally {
      busy.value = false
    }
  }

  return { enabled, busy, load, update }
}
