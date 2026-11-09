import type { MessageDictionary } from '#common/utils/i18n'

/** Settings: the app in the background and at login. */
export default {
  'en': {
    'startup.title': 'In the background',
    'startup.description': 'Closing the window keeps TrueMain running in the tray (the menu bar on macOS), following the client for the overlay and champion select. Its icon opens the window again; Quit there closes the app.',
    'startup.autostart': 'Start with the computer',
    'startup.autostartDescription': 'TrueMain opens when you log in, straight to the tray, its window hidden until you open it.',
  },
  'pt-BR': {
    'startup.title': 'Em segundo plano',
    'startup.description': 'Fechar a janela mantém o TrueMain na bandeja (na barra de menus no macOS), acompanhando o cliente para o overlay e a seleção de campeões. O ícone dele abre a janela de novo; Sair, ali, fecha o app.',
    'startup.autostart': 'Iniciar com o computador',
    'startup.autostartDescription': 'O TrueMain abre quando você entra no sistema, direto na bandeja, com a janela escondida até você abrir.',
  },
} satisfies MessageDictionary
