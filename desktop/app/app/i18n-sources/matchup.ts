import type { MessageDictionary } from '#common/utils/i18n'

/**
 * The matchup tool's words when Settings picked another source
 * (`utils/sources/composition.ts`): no source weighs games by draft or counts
 * true mains, and the games listed are Blitz's latest of the matchup, not the
 * ones the numbers came from. Registered over the layer's by `plugins/i18n.ts`.
 */
export default {
  'en': {
    'builder.stats.byMains': 'of {scanned} games in the matchup',
    'builder.games.titleNamed': 'Recent games: {name}',
    'builder.games.title': 'Recent games',
    'builder.games.description': 'The latest high-elo and pro games Blitz keeps of this champion on the lane, this matchup first. The source does not list the games behind its numbers.',
    'builder.games.empty': 'Blitz has no recent game of this champion on the lane.',
  },
  'pt-BR': {
    'builder.stats.byMains': 'de {scanned} partidas no confronto',
    'builder.games.titleNamed': 'Partidas recentes: {name}',
    'builder.games.title': 'Partidas recentes',
    'builder.games.description': 'As partidas mais recentes de elo alto e de pros que o Blitz guarda deste campeão na rota, este confronto primeiro. A fonte não lista as partidas por trás dos números.',
    'builder.games.empty': 'O Blitz não tem partida recente deste campeão na rota.',
  },
} satisfies MessageDictionary
