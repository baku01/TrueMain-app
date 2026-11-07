import { strToU8, zipSync } from 'fflate'
import type { VoiceKey } from './voice-keys'
import { CHAMPION_FOLDER, NUMBER_FOLDER, NUMBERS_SAID, VOICE_KEYS } from './voice-keys'
import { MAX_CLIP_BYTES, MAX_PACK_BYTES } from './voice-pack'

/**
 * What a voice pack's author starts from, written from the scheme itself
 * (`voice-keys.ts`) so neither can drift from it: the key table of
 * `docs/voice-packs.md` (a test holds the doc to it) and the template ZIP the
 * Overlay page hands out — a `manifest.json` to fill and a `LEIA-ME.txt`
 * listing every file to record. In Portuguese, as the packs are.
 */

const megabytes = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`

/** How a stitched line is put together, in file names: `champion/<Alias>.mp3 + jungle.spotted.tail.mp3`. */
export function stitchedFiles(spec: VoiceKey, quote = (file: string) => file) {
  return spec.segments?.map(segment => quote(segment
    .replace(/^champion:\{\w+\}$/, `${CHAMPION_FOLDER}/<Alias>`)
    .replace(/^number:\{\w+\}$/, `${NUMBER_FOLDER}/<n>`)
    .concat('.mp3'))).join(' + ') ?? null
}

/** The doc's table: every file, its phrase, and how the line is stitched when it is. */
export function voiceKeysMarkdown() {
  const rows = VOICE_KEYS.map((spec: VoiceKey) => {
    const how = spec.part ? 'parte final, depois do nome ou do número' : stitchedFiles(spec, file => `\`${file}\``) ?? ''
    return `| \`${spec.key}.mp3\` | ${spec.phrase} | ${how} |`
  })
  return ['| Arquivo | Frase | Montada com |', '| --- | --- | --- |', ...rows].join('\n')
}

/** The template's `LEIA-ME.txt`. */
export function voicePackReadme() {
  const lines = VOICE_KEYS.flatMap((spec: VoiceKey) => {
    const said = `${spec.key}.mp3 — "${spec.phrase}"${spec.part ? ' (parte final: vem depois do nome ou do número)' : ''}`
    const stitched = stitchedFiles(spec)
    return stitched ? [said, `    montada: ${stitched}`] : [said]
  })
  return [
    'Pacote de voz do TrueMain — modelo',
    '',
    'Como montar:',
    '1. Grave cada frase da lista e salve com o nome de arquivo indicado (.mp3, .ogg ou .wav).',
    '2. Variações da mesma frase: <chave>.1.mp3, <chave>.2.mp3… — o app sorteia uma a cada vez.',
    `3. Nomes de campeões na pasta ${CHAMPION_FOLDER}/, pelo nome interno da Riot: ${CHAMPION_FOLDER}/LeeSin.mp3, ${CHAMPION_FOLDER}/MonkeyKing.mp3.`,
    `4. Números na pasta ${NUMBER_FOLDER}/: ${NUMBER_FOLDER}/3.mp3 (de 0 a ${NUMBERS_SAID}).`,
    '5. As frases "montadas" tocam em sequência: o nome (ou o número) e depois a parte final.',
    '   Se faltar um pedaço, toca a frase inteira; sem ela, a dica aparece só em texto.',
    '6. Preencha o manifest.json (nome, autor, idioma, versão), compacte tudo em um ZIP',
    '   e importe no TrueMain em Overlay → Dicas no jogo → Importar pacote de voz.',
    `Limites: ${megabytes(MAX_CLIP_BYTES)} por arquivo, ${megabytes(MAX_PACK_BYTES)} no total.`,
    '',
    'Arquivos:',
    ...lines,
    '',
  ].join('\n')
}

/** The template ZIP: a manifest to fill and the list of files to record. */
export function voicePackTemplate(): Uint8Array {
  const manifest = { name: 'Meu pacote de voz', author: '', language: 'pt-BR', version: '1.0' }
  return zipSync({
    'manifest.json': strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
    'LEIA-ME.txt': strToU8(voicePackReadme()),
  })
}
