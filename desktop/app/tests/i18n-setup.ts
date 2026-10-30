import { registerMessages, tr } from '#common/utils/i18n'

/** The app's dictionaries (the layer's register themselves), the way its `i18n` plugin registers them. */
export const appDictionaries = import.meta.glob('../app/i18n/*.ts', { eager: true }) as Parameters<typeof registerMessages>[0]

registerMessages(appDictionaries)

// Nuxt auto-imports `useT`; the bare suite has no Nuxt, so components that use it find it here.
;(globalThis as Record<string, unknown>).useT = () => ({ t: tr })
// Nuxt compiles `definePageMeta` away; the bare suite mounts pages that call it.
;(globalThis as Record<string, unknown>).definePageMeta = () => {}
