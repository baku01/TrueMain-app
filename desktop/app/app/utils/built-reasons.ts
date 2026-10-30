import type { ItemContextPhraseToken, ItemContextTone } from '#shared/utils/item-context'
import { tr } from '#common/utils/i18n'

/**
 * How the in-game reasons of the next item read (#1750): what the enemies
 * have built when the decision opened — their armour, their magic resist,
 * their life steal, the damage they built, their crit.
 *
 * The app's own wording, not the site's: these axes are read by the next
 * item alone (product decision, 2026-10-05), and the champion page's hover
 * cards have no sentence for them. Each reads as a game state — "once the
 * enemies have built armor" — never as a draft, since nobody can know it in
 * champion select.
 */

type PhraseSpec = [prefixKey: string, nounKey: string, tone: ItemContextTone]

/** Each axis' two readings as message keys, worded at the call: the language is not known when this module loads. */
const BUILT_AXIS_PHRASES: Record<string, { high: PhraseSpec, low: PhraseSpec }> = {
  EnemyArmorBuilt: {
    high: ['build.reason.enemiesBuilt', 'build.reason.armor', 'armor'],
    low: ['build.reason.enemiesLittle', 'build.reason.armor', 'armor'],
  },
  EnemyMagicResistBuilt: {
    high: ['build.reason.enemiesBuilt', 'build.reason.magicResist', 'magic'],
    low: ['build.reason.enemiesLittle', 'build.reason.magicResist', 'magic'],
  },
  OpponentArmorBuilt: {
    high: ['build.reason.opponentBuilt', 'build.reason.armor', 'armor'],
    low: ['build.reason.opponentNo', 'build.reason.armor', 'armor'],
  },
  OpponentMagicResistBuilt: {
    high: ['build.reason.opponentBuilt', 'build.reason.magicResist', 'magic'],
    low: ['build.reason.opponentNo', 'build.reason.magicResist', 'magic'],
  },
  EnemyHealingBuilt: {
    high: ['build.reason.enemiesBuilt', 'build.reason.lifeSteal', 'heal'],
    low: ['build.reason.noEnemyBuilt', 'build.reason.lifeSteal', 'heal'],
  },
  EnemyMagicDamageBuilt: {
    high: ['build.reason.enemiesBuilt', 'build.reason.magicDamage', 'magic'],
    low: ['build.reason.enemiesBuilt', 'build.reason.physicalDamage', 'physical'],
  },
  EnemyCritBuilt: {
    high: ['build.reason.enemiesBuilt', 'build.reason.crit', 'crit'],
    low: ['build.reason.enemiesNoBuilt', 'build.reason.crit', 'crit'],
  },
}

/** Every in-game axis this module words — the list its exhaustiveness test reads. */
export const BUILT_AXES: readonly string[] = Object.keys(BUILT_AXIS_PHRASES)

/** How an in-game reason reads, or null for an axis this module does not word. */
export function builtAxisPhrase(axis: string, bucket: 'High' | 'Low'): ItemContextPhraseToken[] | null {
  const spec = BUILT_AXIS_PHRASES[axis]?.[bucket === 'High' ? 'high' : 'low']
  return spec ? [{ text: tr(spec[0]) }, { text: tr(spec[1]), tone: spec[2] }] : null
}
