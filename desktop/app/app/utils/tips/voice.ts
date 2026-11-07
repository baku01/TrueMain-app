import type { TipKey, TipParams } from './catalogue'
import type { VoiceKey } from './voice-keys'
import { CHAMPION_FOLDER, NUMBER_FOLDER, VOICE_KEYS } from './voice-keys'

/**
 * What a voice pack says for a tip (`voice-keys.ts` has the naming scheme):
 * which file of a pack is which clip, and which clips a tip plays.
 */

export const AUDIO_TYPES = { mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav' } as const
export type AudioExtension = keyof typeof AUDIO_TYPES

const SPECS = new Map<string, VoiceKey>(VOICE_KEYS.map(spec => [spec.key, spec]))
const ALIAS = /^[a-z][a-z0-9]{0,30}$/i
const NUMBER = /^\d{1,3}$/

/** A pack's clips by name — a key, `champion/<alias>` in lower case, `number/<n>` — each with its variants' ids. */
export type ClipIndex = Record<string, readonly string[]>

export interface ClipFile {
  name: string
  /** 0 for `<name>.mp3`, n for `<name>.<n>.mp3`. */
  variant: number
  extension: AudioExtension
}

/**
 * The clip a file of a pack is, from its path in the ZIP — whatever folder
 * the pack keeps its files in, a champion's name in a `champion` folder and a
 * number in a `number` one — or null when it is none of ours.
 */
export function clipFile(path: string): ClipFile | null {
  const parts = path.split(/[\\/]/).filter(Boolean)
  const match = /^(.+)\.(mp3|ogg|wav)$/i.exec(parts.at(-1) ?? '')
  if (!match) return null
  const extension = match[2]!.toLowerCase() as AudioExtension
  const stem = match[1]!
  const numbered = /^(.+)\.(\d{1,2})$/.exec(stem)
  const folder = parts.at(-2)?.toLowerCase()
  if (folder === CHAMPION_FOLDER || folder === NUMBER_FOLDER) {
    const [base, variant] = numbered ? [numbered[1]!, Number(numbered[2])] : [stem, 0]
    if (folder === CHAMPION_FOLDER && ALIAS.test(base)) return { name: `${CHAMPION_FOLDER}/${base.toLowerCase()}`, variant, extension }
    if (folder === NUMBER_FOLDER && NUMBER.test(base)) return { name: `${NUMBER_FOLDER}/${Number(base)}`, variant, extension }
    return null
  }
  if (SPECS.has(stem)) return { name: stem, variant: 0, extension }
  if (numbered && SPECS.has(numbered[1]!)) return { name: numbered[1]!, variant: Number(numbered[2]), extension }
  return null
}

/** A segment's clip with the tip's params put in: `champion:{alias}` is `champion/leesin`, a key is itself. */
export function segmentClip(segment: string, params: TipParams): string | null {
  const filled = segment.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''))
  const colon = filled.indexOf(':')
  if (colon < 0) return filled
  const [kind, value] = [filled.slice(0, colon), filled.slice(colon + 1)]
  if (kind === CHAMPION_FOLDER && ALIAS.test(value)) return `${CHAMPION_FOLDER}/${value.toLowerCase()}`
  if (kind === NUMBER_FOLDER && NUMBER.test(value)) return `${NUMBER_FOLDER}/${Number(value)}`
  return null
}

const randomPick = (variants: readonly string[]) => variants[Math.floor(Math.random() * variants.length)]!

/**
 * The clips a tip plays, back to back: its line stitched from its segments
 * when the pack has every one, else its whole line, else none — the tip is
 * then text only. One variant of each, picked by `pick`.
 */
export function voicePlan(key: TipKey, params: TipParams, clips: ClipIndex, pick = randomPick): string[] {
  const segments = SPECS.get(key)?.segments
  if (segments) {
    const names = segments.map(segment => segmentClip(segment, params))
    if (names.every(name => name !== null && clips[name]?.length)) return names.map(name => pick(clips[name!]!))
  }
  const line = clips[key]
  return line?.length ? [pick(line)] : []
}

/** How much of the scheme a pack records: the keys it has and lacks, and how many names and numbers. */
export function coverage(clips: ClipIndex) {
  const missing = VOICE_KEYS.filter(spec => !clips[spec.key]?.length).map(spec => spec.key)
  const count = (folder: string) => Object.keys(clips).filter(name => name.startsWith(`${folder}/`)).length
  return { covered: VOICE_KEYS.length - missing.length, total: VOICE_KEYS.length, missing, champions: count(CHAMPION_FOLDER), numbers: count(NUMBER_FOLDER) }
}
