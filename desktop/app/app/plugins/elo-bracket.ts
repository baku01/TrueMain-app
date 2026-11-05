import { SOURCE_ELO_BRACKET, externalSource } from '~/utils/data-source'

/**
 * The champion pages' resting bracket (`usePageEloBracket`): TrueMain's
 * Master+ only when TrueMain is the source; another source opens on its own
 * default, as its reads without a bracket do (`SOURCE_ELO_BRACKET`).
 */
export default defineNuxtPlugin(() => {
  if (externalSource()) usePageEloBracket().value = SOURCE_ELO_BRACKET
})
