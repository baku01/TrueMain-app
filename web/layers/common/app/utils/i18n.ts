/**
 * The two languages the apps speak and the lookup behind every visible string.
 *
 * Messages live in dictionary files, one per area, under an app's or this
 * layer's `i18n/` directory: `export default { 'en': {...}, 'pt-BR': {...} }`,
 * collected with `import.meta.glob` and handed to `registerMessages` (this layer's own are registered below, an app's by its `i18n` plugin and its test setup). A key is
 * flat and dotted (`nav.favorites`), a parameter is `{name}`. English is the
 * fallback for a key a language lacks, so a missing translation shows English
 * rather than a key; `tests/i18n-messages.test.ts` fails on the drift instead.
 *
 * Only the desktop app switches language (`useLocale`, which reloads the
 * window on a change); the site never leaves English, so the active locale is
 * a plain module variable and not reactive state.
 */
export const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
] as const

export type Locale = typeof LOCALES[number]['code']

export type MessageDictionary = Record<Locale, Record<string, string>>

export const DEFAULT_LOCALE: Locale = 'en'

/** Data Dragon's folder for each language (`data/<code>/item.json`). */
const DDRAGON_LOCALES: Record<Locale, string> = { 'en': 'en_US', 'pt-BR': 'pt_BR' }

/** Community Dragon's folder for each language (`global/<code>/v1/perks.json`). */
const CDRAGON_LOCALES: Record<Locale, string> = { 'en': 'default', 'pt-BR': 'pt_br' }

export const ddragonLocale = (locale: Locale) => DDRAGON_LOCALES[locale]
export const cdragonLocale = (locale: Locale) => CDRAGON_LOCALES[locale]

const messages: Record<Locale, Record<string, string>> = { 'en': {}, 'pt-BR': {} }

export function registerMessages(dictionaries: Record<string, { default: MessageDictionary }>) {
  for (const { default: dictionary } of Object.values(dictionaries)) {
    for (const { code } of LOCALES) Object.assign(messages[code], dictionary[code])
  }
}

export const allMessages = () => messages

// This layer's own dictionaries, there wherever the lookup is imported — a
// component, a util's unit test, the site. An app registers its own on top.
registerMessages(import.meta.glob('../i18n/*.ts', { eager: true }))

let activeLocale: Locale = DEFAULT_LOCALE
export const getActiveLocale = () => activeLocale
export function setActiveLocale(locale: Locale) {
  activeLocale = locale
}

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some(locale => locale.code === value)
}

/** The message for `key` in `locale`, each `{name}` replaced by its param; an unknown key answers itself. */
export function translate(locale: Locale, key: string, params: Record<string, string | number> = {}): string {
  const message = messages[locale][key] ?? messages.en[key] ?? key
  return message.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole))
}

/** `translate` in the active language — for code that runs outside a component. */
export const tr = (key: string, params?: Record<string, string | number>) => translate(activeLocale, key, params)
