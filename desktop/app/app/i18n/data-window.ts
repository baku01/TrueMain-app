import type { MessageDictionary } from '#common/utils/i18n'

/** Settings: which games the numbers come from (`utils/data-window.ts`). */
export default {
  'en': {
    'dataWindow.title': 'Data patch',
    'dataWindow.description': 'Which games the builds, tier lists, matchups and analytics are read from. Changing it reloads the app.',
    'dataWindow.option.auto': 'Automatic',
    'dataWindow.option.auto.description': 'The current patch once it has enough games; the previous one while it is new.',
    'dataWindow.option.current': 'Current patch',
    'dataWindow.option.current.description': 'Only games of the live patch — few in its first days.',
    'dataWindow.option.previous': 'Previous patch',
    'dataWindow.option.previous.description': 'The whole patch before, with all its games.',
    'dataWindow.option.specific': 'Specific patch',
    'dataWindow.option.specific.description': 'One patch of your choice, up to ten back.',
    'dataWindow.pickPatch': 'Pick a patch',
    'dataWindow.patch': 'Patch {patch}',
    'dataWindow.supported': 'lolalytics reads the patch chosen here.',
    'dataWindow.unsupported': 'Blitz, op.gg and Tencent always answer their own latest patch: the patch chosen applies when lolalytics is the source.',
  },
  'pt-BR': {
    'dataWindow.title': 'Patch dos dados',
    'dataWindow.description': 'De quais partidas saem as builds, tier lists, matchups e analytics. Mudar recarrega o app.',
    'dataWindow.option.auto': 'Automático',
    'dataWindow.option.auto.description': 'O patch atual quando já tem partidas suficientes; o anterior enquanto ele é novo.',
    'dataWindow.option.current': 'Patch atual',
    'dataWindow.option.current.description': 'Só partidas do patch em vigor — poucas nos primeiros dias.',
    'dataWindow.option.previous': 'Patch anterior',
    'dataWindow.option.previous.description': 'O patch anterior inteiro, com todas as partidas dele.',
    'dataWindow.option.specific': 'Patch específico',
    'dataWindow.option.specific.description': 'Um patch à sua escolha, até dez para trás.',
    'dataWindow.pickPatch': 'Escolha o patch',
    'dataWindow.patch': 'Patch {patch}',
    'dataWindow.supported': 'O lolalytics usa o patch escolhido aqui.',
    'dataWindow.unsupported': 'Blitz, op.gg e Tencent sempre respondem o último patch deles: o patch escolhido vale quando a fonte é o lolalytics.',
  },
} satisfies MessageDictionary
