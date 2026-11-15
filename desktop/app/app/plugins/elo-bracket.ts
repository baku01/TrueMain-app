import { SOURCE_ELO_BRACKET } from '~/utils/data-source'

/**
 * The champion pages' resting bracket (`usePageEloBracket`): the sources'
 * own default, as their reads without a bracket do (`SOURCE_ELO_BRACKET`) —
 * not TrueMain's Master+.
 */
export default defineNuxtPlugin(() => {
  usePageEloBracket().value = SOURCE_ELO_BRACKET
})
