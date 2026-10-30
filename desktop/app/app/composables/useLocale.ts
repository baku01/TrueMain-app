import { getActiveLocale, setActiveLocale, tr, type Locale } from '#common/utils/i18n'

const LOCALE_STORAGE_KEY = 'truemain-locale'

/**
 * The app's language, kept across launches in `localStorage` (the `i18n`
 * plugin reads it back). Switching reloads the window: names fetched from Data
 * Dragon, the shared pages' copies and every string already rendered are in
 * the old language, and a reload is what makes each of them ask again.
 */
export function useLocale() {
  const locale = computed(() => getActiveLocale())

  function setLocale(next: Locale) {
    if (next === getActiveLocale()) return
    setActiveLocale(next)
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next)
    }
    catch {
      // Storage unavailable: the choice holds until the window closes.
    }
    reloadNuxtApp({ ttl: 0 })
  }

  return { locale, setLocale, t: tr }
}
