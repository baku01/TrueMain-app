/** A paired phone, as the shell remembers it (`src-tauri/src/phone_link`). */
export interface PairedPhone {
  phoneId: string
  name: string
  platform: string
  /** Unix seconds. */
  pairedAt: number
  lastSeenAt: number
  /** Connected right now. */
  online: boolean
}

export interface PhoneLinkStatus {
  enabled: boolean
  listening: boolean
  /** Why the port could not be opened. */
  error: string | null
  port: number
  /** `ip:port` a phone on this network reaches the app at. */
  addresses: string[]
  phones: PairedPhone[]
}

/** A QR code to pair one phone: single use, short-lived. */
export interface PhoneLinkInvite {
  uri: string
  svg: string
  expiresInSeconds: number
  addresses: string[]
}

const CHANGED_EVENT = 'phone-link://changed'

/**
 * The phone link (Settings): on or off, a QR code to pair a phone, the phones
 * paired. The shell does the work — it listens, pairs and relays —; the page
 * shows it, and follows the shell's change event so a phone that connects
 * while the QR code is open shows up at once.
 */
export function usePhoneLink() {
  const status = useState<PhoneLinkStatus | null>('phone-link-status', () => null)
  const invite = ref<PhoneLinkInvite | null>(null)
  const busy = ref(false)

  async function call<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
    if (!insideTauri()) return null
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<T>(command, args)
  }

  async function run(work: () => Promise<void>) {
    if (busy.value) return
    busy.value = true
    try {
      await work()
    }
    finally {
      busy.value = false
    }
  }

  async function load() {
    status.value = await call<PhoneLinkStatus>('phone_link_status')
  }

  /** Registered before any await, so it is torn down with the caller's scope. */
  function follow() {
    let stop: (() => void) | undefined
    let gone = false
    onScopeDispose(() => {
      gone = true
      stop?.()
    })
    if (!insideTauri()) return
    void import('@tauri-apps/api/event').then(async ({ listen }) => {
      const unlisten = await listen<PhoneLinkStatus>(CHANGED_EVENT, (event) => {
        const before = status.value?.phones.filter(p => p.online).length ?? 0
        status.value = event.payload
        // A phone just came in on the QR code on screen: it is spent.
        if (invite.value && event.payload.phones.filter(p => p.online).length > before) invite.value = null
      })
      if (gone) unlisten()
      else stop = unlisten
    })
  }

  const setEnabled = (enabled: boolean) => run(async () => {
    status.value = await call<PhoneLinkStatus>('phone_link_set_enabled', { enabled })
    if (!enabled) invite.value = null
  })

  const showInvite = () => run(async () => {
    invite.value = await call<PhoneLinkInvite>('phone_link_invite')
  })

  const forget = (phoneId: string) => run(async () => {
    status.value = await call<PhoneLinkStatus>('phone_link_forget', { phoneId })
  })

  const reset = () => run(async () => {
    status.value = await call<PhoneLinkStatus>('phone_link_reset')
    invite.value = null
  })

  return { status, invite, busy, load, follow, setEnabled, showInvite, hideInvite: () => (invite.value = null), forget, reset }
}
