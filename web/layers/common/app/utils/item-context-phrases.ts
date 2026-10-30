import type { ChampionItemContextAxis } from '#shared/types/item-context'
import type { ItemContextPhraseToken, ItemContextTone } from '#shared/utils/item-context'
import { itemContextAxisPhrase } from '#shared/utils/item-context'
import { getActiveLocale } from '#common/utils/i18n'

/** Shorthand, as in the shared module: `phrase('contra um time de ', ['dano mágico', 'magic'])`. */
function phrase(...parts: (string | [string, ItemContextTone])[]): ItemContextPhraseToken[] {
  return parts.map(part => (typeof part === 'string' ? { text: part } : { text: part[0], tone: part[1] }))
}

type Wording = { high: ItemContextPhraseToken[], low: ItemContextPhraseToken[] }

/**
 * The Portuguese wording of `AXIS_PHRASES` in `#shared/utils/item-context`: the
 * same axes, both ends, the same colour on the same term. The shared module
 * cannot import this layer's lookup, so the translation lives here and the
 * three places that word a situation ask for it through `localizedAxisPhrase`.
 * `item-context-phrases.test.ts` fails when an axis the shared module knows is
 * missing here.
 */
export const PT_BR_AXIS_PHRASES: Record<string, Wording> = {
  EnemyMagicDamage: {
    high: phrase('contra um time de ', ['dano mágico', 'magic']),
    low: phrase('contra um time com pouco ', ['dano mágico', 'magic']),
  },
  EnemyPhysicalDamage: {
    high: phrase('contra um time de ', ['dano físico', 'physical']),
    low: phrase('contra um time com pouco ', ['dano físico', 'physical']),
  },
  EnemySustain: {
    high: phrase('contra um time que ', ['se cura', 'heal']),
    low: phrase('contra um time sem ', ['cura', 'heal']),
  },
  EnemyCrowdControl: {
    high: phrase('contra muito ', ['controle de grupo', 'cc']),
    low: phrase('contra pouco ', ['controle de grupo', 'cc']),
  },
  EnemyFrontline: {
    high: phrase('contra uma ', ['linha de frente', 'armor']),
    low: phrase('contra um time sem ', ['linha de frente', 'armor']),
  },
  EnemyMelee: {
    high: phrase('contra um time majoritariamente corpo a corpo'),
    low: phrase('contra um time majoritariamente à distância'),
  },
  EnemyCrit: {
    high: phrase('contra carregadores de ', ['crítico', 'crit']),
    low: phrase('contra um time sem ', ['crítico', 'crit']),
  },
  EnemyArmorPenetration: {
    high: phrase('contra construtores de ', ['letalidade', 'lethality']),
    low: phrase('contra um time sem ', ['letalidade', 'lethality']),
  },
  OpponentRanged: {
    high: phrase('contra um oponente de rota à distância'),
    low: phrase('contra um oponente de rota corpo a corpo'),
  },
  OpponentLanePressure: {
    high: phrase('contra um oponente forte na rota'),
    low: phrase('contra um oponente fraco na rota'),
  },
  OpponentMagicDamage: {
    high: phrase('contra um oponente de rota com ', ['dano mágico', 'magic']),
    low: phrase('contra um oponente de rota com pouco ', ['dano mágico', 'magic']),
  },
  OpponentSustain: {
    high: phrase('contra um oponente de rota que ', ['se cura', 'heal']),
    low: phrase('contra um oponente de rota sem ', ['cura', 'heal']),
  },
  AllyMagicDamage: {
    high: phrase('quando seu time já causa ', ['dano mágico', 'magic']),
    low: phrase('quando seu time não tem ', ['dano mágico', 'magic']),
  },
  AllyFrontline: {
    high: phrase('quando seu time já tem uma ', ['linha de frente', 'armor']),
    low: phrase('quando seu time não tem ', ['linha de frente', 'armor']),
  },
  OwnGoldLeadAt15: {
    high: phrase('quando está ', ['à frente', 'gold'], ' aos 15 min'),
    low: phrase('quando está ', ['atrás', 'gold'], ' aos 15 min'),
  },
}

/** How one situation reads in the active language; `null` for an axis this build cannot word. */
export function localizedAxisPhrase(axis: ChampionItemContextAxis): ItemContextPhraseToken[] | null {
  if (getActiveLocale() === 'pt-BR') {
    const wording = PT_BR_AXIS_PHRASES[axis.axis]
    if (wording) return axis.bucket === 'High' ? wording.high : wording.low
  }
  return itemContextAxisPhrase(axis)
}
