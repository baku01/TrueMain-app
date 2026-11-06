import type { MessageDictionary } from '#common/utils/i18n'

/** The teams' damage split meter (`TeamDamageMeter`). */
export default {
  'en': {
    'damage.meter.ally': 'Your team damage',
    'damage.meter.enemy': 'Enemy team damage',
    'damage.meter.physical': 'Physical',
    'damage.meter.magic': 'Magic',
    'damage.meter.true': 'True',
    'damage.meter.lean': '{share} {kind} damage',
    'damage.meter.kind.physical': 'physical',
    'damage.meter.kind.magic': 'magic',
    'damage.meter.kind.true': 'true',
    'damage.meter.unmeasured': '{count} not measured',
    'damage.share.title': 'Send to the champion select chat',
    'damage.share.line': '{team}: {physical} AD · {magic} AP · {true} true',
    'damage.share.sent': 'Sent to the chat',
    'damage.share.failed': 'Could not send to the chat',
  },
  'pt-BR': {
    'damage.meter.ally': 'Dano do seu time',
    'damage.meter.enemy': 'Dano do time inimigo',
    'damage.meter.physical': 'Físico',
    'damage.meter.magic': 'Mágico',
    'damage.meter.true': 'Verdadeiro',
    'damage.meter.lean': '{share} de dano {kind}',
    'damage.meter.kind.physical': 'físico',
    'damage.meter.kind.magic': 'mágico',
    'damage.meter.kind.true': 'verdadeiro',
    'damage.meter.unmeasured': '{count} sem medição',
    'damage.share.title': 'Enviar ao chat da seleção',
    'damage.share.line': '{team}: {physical} AD · {magic} AP · {true} verdadeiro',
    'damage.share.sent': 'Enviado ao chat',
    'damage.share.failed': 'Não foi possível enviar ao chat',
  },
} satisfies MessageDictionary
