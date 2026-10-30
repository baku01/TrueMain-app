import type { KeyCheck, KeyStatus } from '~/utils/riot-key'

const PLATFORM_KEY = 'truemain-riot-platform'

/**
 * The player's Riot API key. The shell keeps it in the system's credential
 * store and does every call to Riot (`src-tauri/src/riot.rs`); the page only
 * ever holds what the player is typing, and a masked form of what is saved.
 *
 * In a browser `npm run dev` there is no shell: a small stand-in answers, with
 * Riot's usual development-key limits, so the page can be built and looked at.
 * It saves nothing and checks nothing. A production build drops it.
 */
export function useRiotKey() {
  const status = useState<KeyStatus>('riot-key-status', () => ({ saved: false, masked: null }))
  const check = useState<KeyCheck | null>('riot-key-check', () => null)
  const busy = useState<boolean>('riot-key-busy', () => false)
  const error = useState<string | null>('riot-key-error', () => null)
  const platform = useState<string>('riot-key-platform', () => {
    try {
      return localStorage.getItem(PLATFORM_KEY) || 'br1'
    }
    catch {
      return 'br1'
    }
  })

  const standIn = import.meta.dev && !insideTauri()
  let standInKey: string | null = null

  async function call<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
    if (standIn) return await fake(command, args) as T
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<T>(command, args)
  }

  async function fake(command: string, args: Record<string, unknown>): Promise<unknown> {
    await new Promise(resolve => setTimeout(resolve, 400))
    const checkOf = (): KeyCheck => ({
      state: 'valid',
      status: 200,
      platform: String(args.platform ?? 'br1'),
      appLimits: [{ seconds: 1, limit: 20, used: 1 }, { seconds: 120, limit: 100, used: 1 }],
      methodLimits: [{ seconds: 10, limit: 300, used: 1 }],
      retryAfter: null,
    })
    switch (command) {
      case 'riot_key_status': return { saved: standInKey !== null, masked: standInKey ? `${standInKey.slice(0, 10)}…${standInKey.slice(-4)}` : null }
      case 'riot_key_check': return checkOf()
      case 'riot_key_save': standInKey = String(args.key); return checkOf()
      default: standInKey = null; return null
    }
  }

  function rememberPlatform(value: string) {
    platform.value = value
    try {
      localStorage.setItem(PLATFORM_KEY, value)
    }
    catch {
      // Storage unavailable: the choice holds until the window closes.
    }
  }

  async function run(work: () => Promise<void>) {
    busy.value = true
    error.value = null
    try {
      await work()
    }
    catch (failure) {
      error.value = typeof failure === 'string' ? failure : failure instanceof Error ? failure.message : String(failure)
    }
    finally {
      busy.value = false
    }
  }

  const load = () => run(async () => {
    status.value = await call<KeyStatus>('riot_key_status')
  })

  /** Checks what was typed, or the saved key when `key` is empty — and keeps it unless Riot refuses it. */
  const save = (key: string) => run(async () => {
    check.value = await call<KeyCheck>('riot_key_save', { key, platform: platform.value })
    status.value = await call<KeyStatus>('riot_key_status')
  })

  const verify = () => run(async () => {
    check.value = await call<KeyCheck>('riot_key_check', { key: null, platform: platform.value })
  })

  const clear = () => run(async () => {
    await call<null>('riot_key_clear')
    check.value = null
    status.value = await call<KeyStatus>('riot_key_status')
  })

  return { status, check, busy, error, platform, standIn, rememberPlatform, load, save, verify, clear }
}
