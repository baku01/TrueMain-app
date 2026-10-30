import type { MessageDictionary } from '#common/utils/i18n'

/** Settings: hardware acceleration. */
export default {
  'en': {
    'graphics.title': 'Performance',
    'graphics.acceleration': 'Hardware acceleration',
    'graphics.description.windows': 'Draws the app with the graphics card. Turn it off if the app flickers, shows black or blank windows, or slows the game down: the app then draws in software and drops blurs and animations.',
    'graphics.description.mac': 'Turned off, the app drops blurs and endless animations, the effects that keep the graphics card busy. macOS always draws the app\'s pages with the graphics card; that part cannot be turned off.',
    'graphics.restart': 'Restart the app to apply this change.',
    'graphics.restartNow': 'Restart now',
    'graphics.restartFailed': 'The app could not restart itself. Close it and open it again.',
  },
  'pt-BR': {
    'graphics.title': 'Desempenho',
    'graphics.acceleration': 'Aceleração gráfica',
    'graphics.description.windows': 'Desenha o app com a placa de vídeo. Desative se o app piscar, mostrar janelas pretas ou em branco, ou deixar o jogo mais lento: o app passa a desenhar por software e deixa de lado desfoques e animações.',
    'graphics.description.mac': 'Desativada, o app deixa de lado desfoques e animações contínuas, os efeitos que mantêm a placa de vídeo ocupada. O macOS sempre desenha as páginas do app com a placa de vídeo; essa parte não pode ser desligada.',
    'graphics.restart': 'Reinicie o app para aplicar esta mudança.',
    'graphics.restartNow': 'Reiniciar agora',
    'graphics.restartFailed': 'O app não conseguiu se reiniciar. Feche e abra de novo.',
  },
} satisfies MessageDictionary
