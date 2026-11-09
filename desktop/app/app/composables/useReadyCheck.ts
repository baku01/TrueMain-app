/** The shell's answer (`src-tauri/src/ready_check.rs`). */
export interface ReadyCheckSettings {
  /** Accept a found match without the player's click. */
  autoAccept: boolean
  /** Seconds to wait first, 0 to `MAX_DELAY_SECONDS`. */
  delaySeconds: number
}

/** Mirrors `MAX_DELAY_SECONDS`: the client gives the players about ten seconds. */
export const MAX_DELAY_SECONDS = 8

/** A browser-only `npm run dev` has no shell: the choice lives in memory. */
const DEV_SETTINGS: ReadyCheckSettings = { autoAccept: false, delaySeconds: 3 }

/**
 * Accepting a found match for the player, off until turned on. The shell
 * does the accepting — the app's window may be hidden behind the client —;
 * the page only keeps the choice.
 */
export function useReadyCheck() {
  const settings = useState<ReadyCheckSettings | null>('ready-check-settings', () => null)
  const busy = ref(false)

  async function call(command: string, args?: Record<string, unknown>): Promise<ReadyCheckSettings> {
    if (insideTauri()) {
      const { invoke } = await import('@tauri-apps/api/core')
      return await invoke<ReadyCheckSettings>(command, args)
    }
    if (command === 'set_ready_check_settings') return { autoAccept: args!.autoAccept as boolean, delaySeconds: Math.min(MAX_DELAY_SECONDS, args!.delaySeconds as number) }
    return settings.value ?? DEV_SETTINGS
  }

  async function load() {
    settings.value = await call('ready_check_settings')
  }

  async function update(change: Partial<ReadyCheckSettings>) {
    if (busy.value || !settings.value) return
    busy.value = true
    try {
      settings.value = await call('set_ready_check_settings', { ...settings.value, ...change })
    }
    finally {
      busy.value = false
    }
  }

  return { settings, busy, load, update }
}
