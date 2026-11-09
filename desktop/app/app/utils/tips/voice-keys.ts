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
  { key: 'jungle.dead', phrase: 'O caçador inimigo morreu: invade ou pega o próximo objetivo.', segments: ['champion:{alias}', 'jungle.dead.tail'] },
  { key: 'jungle.dead.tail', phrase: 'morreu: invade ou pega o próximo objetivo.', part: true },
  { key: 'ward.startBlue', phrase: 'Se der, warda o azul deles antes do minuto: mostra onde o caçador começa.' },
  { key: 'ward.startRed', phrase: 'Se der, warda o vermelho deles antes do minuto: mostra onde o caçador começa.' },
  { key: 'ward.gank.top', phrase: 'O caçador inimigo tá fechando o clear: empurra e warda o bush do rio da top.' },
  { key: 'ward.gank.mid', phrase: 'O caçador inimigo tá fechando o clear: empurra e warda uma entrada do rio.' },
  { key: 'ward.gank.bot', phrase: 'O caçador inimigo tá fechando o clear: warda o bush do rio da bot ou o tribush.' },
  { key: 'ward.controlBuy', phrase: 'Leva uma Control Ward antes de sair da base.' },
  { key: 'ward.control.back.dragon', phrase: 'Dragão em um minuto e meio: volta e traz uma Control Ward pro pit.' },
  { key: 'ward.control.place.dragon', phrase: 'Dragão em um minuto e meio: leva tua Control Ward pro pit.' },
  { key: 'ward.control.back.baron', phrase: 'Barão em um minuto e meio: volta e traz uma Control Ward pro pit.' },
  { key: 'ward.control.place.baron', phrase: 'Barão em um minuto e meio: leva tua Control Ward pro pit.' },
  { key: 'lane.levelTwoFirst', phrase: 'Nível dois primeiro! Troca agora, antes dele subir.' },
  { key: 'lane.levelTwoBehind', phrase: 'Teu oponente chegou no nível dois antes. Recua até você subir.', segments: ['champion:{alias}', 'lane.levelTwoBehind.tail'] },
  { key: 'lane.levelTwoBehind.tail', phrase: 'chegou no nível dois antes. Recua até você subir.', part: true },
  { key: 'lane.opponentDead', phrase: 'Teu oponente morreu: empurra a wave e bate na torre.', segments: ['champion:{alias}', 'lane.opponentDead.tail'] },
  { key: 'lane.opponentDead.tail', phrase: 'morreu: empurra a wave e bate na torre.', part: true },
  { key: 'lane.cannon', phrase: 'Wave de canhão chegando: empurra antes de voltar ou rodar.' },
  { key: 'recall.cannon', phrase: 'Wave de canhão chegando: empurra na torre e volta pra comprar.' },
  { key: 'recall.lowHealth', phrase: 'Vida baixa e ouro pra gastar: volta agora.' },
  { key: 'recall.richHurt', phrase: 'Meia vida e muito ouro: volta e compra.' },
  { key: 'lane.lowHealth', phrase: 'Vida baixa: fica atrás dos minions, não troca.' },
  { key: 'ward.idle', phrase: 'Faz tempo que você não warda: bota uma no rio.' },
  { key: 'lane.spikeMine', phrase: 'Item fechado: é o seu pico, procura uma troca.' },
  { key: 'lane.spikeTheirs', phrase: 'Teu oponente fechou um item: respeita a troca.', segments: ['champion:{alias}', 'lane.spikeTheirs.tail'] },
  { key: 'lane.spikeTheirs.tail', phrase: 'fechou um item: respeita a troca.', part: true },
  { key: 'lane.levelAhead', phrase: 'Você está níveis acima do oponente: a luta é sua.' },
  { key: 'lane.levelBehind', phrase: 'Teu oponente está níveis acima: não luta, farma seguro.', segments: ['champion:{alias}', 'lane.levelBehind.tail'] },
  { key: 'lane.levelBehind.tail', phrase: 'está níveis acima: não luta, farma seguro.', part: true },
  { key: 'macro.ace', phrase: 'Ace! Empurra torre, inibidor ou faz o Barão.' },
  { key: 'macro.take.baron', phrase: 'Inimigos mortos e o Barão de pé: faz agora!' },
  { key: 'macro.take.dragon', phrase: 'Inimigos mortos e o Dragão de pé: faz agora!' },
  { key: 'macro.take.elder', phrase: 'Inimigos mortos e o Ancião de pé: faz agora!' },
  { key: 'macro.take.herald', phrase: 'Inimigos mortos e o Arauto de pé: pega agora!' },
  { key: 'macro.take.grubs', phrase: 'Inimigos mortos e as Larvas de pé: pega agora!' },
  { key: 'macro.outnumbered', phrase: 'Aliados mortos: não luta, segura a torre.' },
  { key: 'objective.soulPoint.ours', phrase: 'Ponto de alma: o próximo dragão é nosso.' },
  { key: 'objective.soulPoint.theirs', phrase: 'Eles estão no ponto de alma: o próximo dragão é obrigatório.' },
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
