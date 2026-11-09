import type { MessageDictionary } from '#common/utils/i18n'

/** Settings: accepting a found match. */
export default {
  'en': {
    'readyCheck.title': 'Match found',
    'readyCheck.description': 'What the app does when the client finds a match.',
    'readyCheck.autoAccept': 'Accept the match automatically',
    'readyCheck.autoAcceptDescription': 'The app accepts for you after the wait below, unless you already answered in the client. Decline in the client before it does, and the match is left declined.',
    'readyCheck.delay': 'Wait before accepting',
    'readyCheck.atOnce': 'None',
    'readyCheck.seconds': '{seconds} s',
  },
  'pt-BR': {
    'readyCheck.title': 'Partida encontrada',
    'readyCheck.description': 'O que o app faz quando o cliente encontra uma partida.',
    'readyCheck.autoAccept': 'Aceitar a partida automaticamente',
    'readyCheck.autoAcceptDescription': 'O app aceita por você depois da espera abaixo, a não ser que você já tenha respondido no cliente. Recuse no cliente antes, e a partida fica recusada.',
    'readyCheck.delay': 'Espera antes de aceitar',
    'readyCheck.atOnce': 'Nenhuma',
    'readyCheck.seconds': '{seconds} s',
  },
} satisfies MessageDictionary
