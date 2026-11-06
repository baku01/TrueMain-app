import type { MessageDictionary } from '#common/utils/i18n'

/** A jungler's paths (`JunglePaths`), read from op.gg. */
export default {
  'en': {
    'jungle.tab': 'Jungle paths',
    'jungle.side.BLUE': 'Blue side',
    'jungle.side.RED': 'Red side',
    'jungle.camp.BLUE': 'Blue buff',
    'jungle.camp.GROMP': 'Gromp',
    'jungle.camp.WOLVES': 'Murk Wolves',
    'jungle.camp.RAPTORS': 'Raptors',
    'jungle.camp.RED': 'Red buff',
    'jungle.camp.KRUG': 'Krugs',
    'jungle.start': 'Start',
    'jungle.routes': 'Most run full clears',
    'jungle.starts': 'Opening camp',
    'jungle.games': '{count} games',
    'jungle.source': 'op.gg, ranked games',
    'jungle.none': 'op.gg lists no jungle paths for this champion.',
  },
  'pt-BR': {
    'jungle.tab': 'Rotas da selva',
    'jungle.side.BLUE': 'Lado azul',
    'jungle.side.RED': 'Lado vermelho',
    'jungle.camp.BLUE': 'Buff Azul',
    'jungle.camp.GROMP': 'Gromp',
    'jungle.camp.WOLVES': 'Lobos Sombrios',
    'jungle.camp.RAPTORS': 'Carniçãos',
    'jungle.camp.RED': 'Buff Vermelho',
    'jungle.camp.KRUG': 'Krugs',
    'jungle.start': 'Início',
    'jungle.routes': 'Limpezas completas mais jogadas',
    'jungle.starts': 'Acampamento inicial',
    'jungle.games': '{count} partidas',
    'jungle.source': 'op.gg, partidas ranqueadas',
    'jungle.none': 'O op.gg não lista rotas da selva para este campeão.',
  },
} satisfies MessageDictionary
