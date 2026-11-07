import type { TipSettings } from '~/utils/tips/settings'
import { TIP_SETTINGS_KEY, readTipSettings } from '~/utils/tips/settings'

/**
 * The in-game tips' settings (`utils/tips/settings.ts`), shared by the Overlay
 * page that changes them and the overlay panel that reads them: each in its
 * own webview, kept in step by the `storage` event another window's write
 * raises here.
 */
export function useTipSettings() {
  const settings = useState<TipSettings>('tip-settings', () => readTipSettings(globalThis.localStorage?.getItem(TIP_SETTINGS_KEY) ?? null))
  const listening = useState<boolean>('tip-settings-listening', () => false)

  if (import.meta.client && !listening.value) {
    listening.value = true
    window.addEventListener('storage', (event) => {
      if (event.key === TIP_SETTINGS_KEY) settings.value = readTipSettings(event.newValue)
    })
  }

  function update(change: Partial<TipSettings>) {
    settings.value = { ...settings.value, ...change }
    globalThis.localStorage?.setItem(TIP_SETTINGS_KEY, JSON.stringify(settings.value))
  }

  return { settings: readonly(settings), update }
}
