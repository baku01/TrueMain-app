import { tr } from '#common/utils/i18n'

/** `t(key, params)` for a template or setup: the active language's message. */
export function useT() {
  return { t: tr }
}
