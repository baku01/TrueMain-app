import { DEFAULT_LOCALE, isLocale, registerMessages, setActiveLocale } from '#common/utils/i18n'

const LOCALE_STORAGE_KEY = 'truemain-locale'

/** The saved language is active before the first component renders; the app's own dictionaries join the layer's, and the shell's menu is told which one. */
export default defineNuxtPlugin({
  enforce: 'pre',
  setup() {
    registerMessages(import.meta.glob('../i18n/*.ts', { eager: true }))
    // Another source picked: the matchup tool's words for numbers that are not TrueMain's model.
    if (externalSource()) registerMessages(import.meta.glob('../i18n-sources/*.ts', { eager: true }))
    let stored: string | null = null
    try {
      stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    }
    catch {
      // Storage unavailable: English.
    }
    const language = isLocale(stored) ? stored : DEFAULT_LOCALE
    setActiveLocale(language)
    // The native menu and tray are the shell's: it learns the language here,
    // and the window reloads on a change, so this runs again then. The overlay
    // panels have no say in it.
    if (insideTauri() && !location.hash.startsWith('#/overlay/')) {
      void import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke('set_menu_language', { language }))
        .catch(() => {})
    }
  },
})
