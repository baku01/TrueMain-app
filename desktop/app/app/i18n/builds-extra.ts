import type { MessageDictionary } from '#common/utils/i18n'

/** The builds list's extra groups: the player's previous build, Blitz's playstyles, the one-tricks' builds, the main lane's on a thin lane. */
export default {
  'en': {
    'buildx.previous': 'Previous build',
    'buildx.otp': 'One-trick builds',
    'buildx.styles': 'Build styles',
    'buildx.stylesHint': 'Each of the lane\'s ways to build (Blitz): the build and its item set follow the one picked',
    'buildx.badge': 'Read from {source}, whatever the data source',
    'buildx.main': 'Main lane ({lane})',
    'buildx.thin': 'Only {games} games on this lane: too few to stand for it. The {lane} builds, the champion\'s main lane, are opened first.',
  },
  'pt-BR': {
    'buildx.previous': 'Build anterior',
    'buildx.otp': 'Builds de one-tricks',
    'buildx.styles': 'Estilos de build',
    'buildx.stylesHint': 'Cada jeito de buildar da rota (Blitz): a build e o arsenal seguem o escolhido',
    'buildx.badge': 'Lido do {source}, qualquer que seja a fonte de dados',
    'buildx.main': 'Rota principal ({lane})',
    'buildx.thin': 'Só {games} partidas nesta rota: poucas para valer como a build dela. As builds de {lane}, a rota principal do campeão, abrem primeiro.',
  },
} satisfies MessageDictionary
