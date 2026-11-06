import type { MessageDictionary } from '#common/utils/i18n'

/** The theme picker (`SettingsTheme`). Catppuccin's flavour and accent names are its own, in every language. */
const NAMES = {
  'appearance.theme.truemain': 'TrueMain',
  'appearance.theme.latte': 'Catppuccin Latte',
  'appearance.theme.frappe': 'Catppuccin Frappé',
  'appearance.theme.macchiato': 'Catppuccin Macchiato',
  'appearance.theme.mocha': 'Catppuccin Mocha',
  'appearance.accent.rosewater': 'Rosewater',
  'appearance.accent.flamingo': 'Flamingo',
  'appearance.accent.pink': 'Pink',
  'appearance.accent.mauve': 'Mauve',
  'appearance.accent.red': 'Red',
  'appearance.accent.maroon': 'Maroon',
  'appearance.accent.peach': 'Peach',
  'appearance.accent.yellow': 'Yellow',
  'appearance.accent.green': 'Green',
  'appearance.accent.teal': 'Teal',
  'appearance.accent.sky': 'Sky',
  'appearance.accent.sapphire': 'Sapphire',
  'appearance.accent.blue': 'Blue',
  'appearance.accent.lavender': 'Lavender',
}

export default {
  'en': {
    ...NAMES,
    'appearance.title': 'Theme',
    'appearance.description': 'The whole app takes the theme\'s colours, its icon included. The top bar\'s switch goes between the theme\'s light and dark.',
    'appearance.mode.light': 'Light',
    'appearance.mode.dark': 'Dark',
    'appearance.mode.both': 'Light and dark',
    'appearance.accent': 'Accent',
    'appearance.icon': 'The app icon follows the theme in the Dock and the taskbar while the app is open; the installed icon stays TrueMain\'s.',
  },
  'pt-BR': {
    ...NAMES,
    'appearance.title': 'Tema',
    'appearance.description': 'O app inteiro muda de cor com o tema, o ícone também. O botão da barra superior alterna entre o claro e o escuro do tema.',
    'appearance.mode.light': 'Claro',
    'appearance.mode.dark': 'Escuro',
    'appearance.mode.both': 'Claro e escuro',
    'appearance.accent': 'Cor de destaque',
    'appearance.icon': 'O ícone do app acompanha o tema no Dock e na barra de tarefas enquanto o app está aberto; o ícone instalado continua o do TrueMain.',
  },
} satisfies MessageDictionary
