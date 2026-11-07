/**
 * Every clip a voice pack can hold, and what to record for it — in Brazilian
 * Portuguese, the language the packs are recorded in. Plain data with no
 * import, so a script outside the app (a converter from another pack's
 * format) can read it as it stands; `docs/voice-packs.md` and the template
 * ZIP's `LEIA-ME.txt` are written from it (`voice-template.ts`), and a test
 * holds the doc to it.
 *
 * A clip's file is named by its key: `<key>.mp3`, or `<key>.<n>.mp3` for the
 * n-th variant of the same line, one picked at random each time. A line that
 * names a champion or says a number is first tried stitched from its
 * `segments`, played back to back: `champion:{alias}` is the pack's
 * `champion/<Alias>.mp3` (Riot's alias: `LeeSin`, `MonkeyKing`),
 * `number:{param}` its `number/<n>.mp3`, any other segment a key of this list
 * (a `part`). When one of them is missing, the whole line plays instead, said
 * without the name; when that is missing too, the tip is text only.
 *
 * No key ends in a segment of digits: that is how a variant is told apart.
 */
export interface VoiceKey {
  /** The clip's file name in a pack, without the variant and the extension. */
  key: string
  /** What to record: the whole line, said alone. */
  phrase: string
  /** The same line stitched with the champion's name or the number, tried before the whole one. */
  segments?: readonly string[]
  /** Never said alone: the end of another line's `segments`, after a name or a number. */
  part?: true
}

export const VOICE_KEYS = [
  { key: 'objective.dragon.60s', phrase: 'Dragão daqui a um minuto! Empurra a wave e cola no rio.' },
  { key: 'objective.dragon.30s', phrase: 'Dragão em trinta segundos! Garante a visão do covil.' },
  { key: 'objective.dragon.smite', phrase: 'Dragão em dez segundos! Segura o Smite pro final.' },
  { key: 'objective.elder.60s', phrase: 'Ancião daqui a um minuto! Essa luta decide o jogo.' },
  { key: 'objective.elder.30s', phrase: 'Ancião em trinta segundos! Agrupa e limpa as wards.' },
  { key: 'objective.elder.smite', phrase: 'Ancião em dez segundos! Smite no último hit, sem errar.' },
  { key: 'objective.grubs.60s', phrase: 'Larvas daqui a um minuto! Chega primeiro no lado de cima.' },
  { key: 'objective.grubs.30s', phrase: 'Larvas em trinta segundos! Bota ward no covil.' },
  { key: 'objective.herald.60s', phrase: 'Arauto daqui a um minuto! Combina quem vai pegar.' },
  { key: 'objective.herald.30s', phrase: 'Arauto em trinta segundos! Empurra a wave antes de ir.' },
  { key: 'objective.herald.smite', phrase: 'Arauto em dez segundos! Guarda o Smite pro final.' },
  { key: 'objective.baron.60s', phrase: 'Barão daqui a um minuto! Puxa as waves laterais e agrupa.' },
  { key: 'objective.baron.30s', phrase: 'Barão em trinta segundos! Limpa a visão do rio.' },
  { key: 'objective.baron.smite', phrase: 'Barão em dez segundos! Smite pronto, não deixa roubar.' },
  { key: 'jungle.spotted', phrase: 'Caçador inimigo visto no mapa! Fica esperto.', segments: ['champion:{alias}', 'jungle.spotted.tail'] },
  { key: 'jungle.spotted.tail', phrase: 'foi visto no mapa! Fica esperto.', part: true },
  { key: 'jungle.firstClear', phrase: 'O caçador inimigo tá fechando o primeiro clear. Joga seguro!', segments: ['champion:{alias}', 'jungle.firstClear.tail'] },
  { key: 'jungle.firstClear.tail', phrase: 'tá fechando o primeiro clear. Joga seguro!', part: true },
  { key: 'jungle.gankWindow', phrase: 'Janela de gank do caçador inimigo! Olho no rio.', segments: ['champion:{alias}', 'jungle.gankWindow.tail'] },
  { key: 'jungle.gankWindow.tail', phrase: 'pode estar vindo de gank. Olho no rio!', part: true },
  { key: 'recall.earlyGold', phrase: 'Já dá pra comprar! Empurra a wave e volta pra base.' },
  { key: 'map.minimap', phrase: 'Dá uma olhada no minimapa!' },
  { key: 'ward.redLens', phrase: 'Troca o amuleto amarelo pela lente vermelha!' },
  { key: 'ward.blueLens', phrase: 'Nível nove! Troca pro amuleto azul.' },
  { key: 'farm.great', phrase: 'Farm excelente! Continua assim.' },
  { key: 'farm.ok', phrase: 'Farm razoável. Não perde as waves.' },
  { key: 'farm.low', phrase: 'Farm baixo! Cada wave conta.' },
  { key: 'level.sixFirst', phrase: 'Nível seis primeiro! Aproveita o pico.' },
  { key: 'level.enemySixFirst', phrase: 'Seu oponente chegou no seis antes! Respeita o ultimate.', segments: ['champion:{alias}', 'level.enemySixFirst.tail'] },
  { key: 'level.enemySixFirst.tail', phrase: 'chegou no seis antes! Respeita o ultimate.', part: true },
  { key: 'kill.levelTwo', phrase: 'Abate no nível dois! Que timing!' },
  { key: 'kill.shutdown', phrase: 'Shutdown! A recompensa é do time.', segments: ['champion:{alias}', 'kill.shutdown.tail'] },
  { key: 'kill.shutdown.tail', phrase: 'foi parado! A recompensa é do time.', part: true },
  { key: 'death.streak', phrase: 'Várias mortes seguidas. Respira e joga com o time.', segments: ['number:{deaths}', 'death.streak.tail'] },
  { key: 'death.streak.tail', phrase: 'mortes seguidas. Respira e joga com o time.', part: true },
  { key: 'death.nemesis', phrase: 'Esse inimigo já te pegou três vezes. Não luta sozinho!', segments: ['champion:{alias}', 'death.nemesis.tail'] },
  { key: 'death.nemesis.tail', phrase: 'já te pegou três vezes. Não luta sozinho!', part: true },
  { key: 'gold.ahead', phrase: 'Vocês tão na frente! Pressiona os objetivos.' },
  { key: 'gold.behind', phrase: 'Vocês tão atrás. Farma e espera o erro deles.' },
] as const satisfies readonly VoiceKey[]

/** The folder of a pack's champion names (`champion/LeeSin.mp3`) and the prefix of their segment. */
export const CHAMPION_FOLDER = 'champion'
/** The folder of a pack's numbers (`number/3.mp3`) and the prefix of their segment. */
export const NUMBER_FOLDER = 'number'
/** The numbers a stitched line can say: the death streak's count, up to this. */
export const NUMBERS_SAID = 30
