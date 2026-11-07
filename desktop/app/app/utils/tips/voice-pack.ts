import { unzipSync } from 'fflate'
import type { AudioExtension, ClipFile } from './voice'
import { AUDIO_TYPES, clipFile } from './voice'

/**
 * A voice pack the player imports: a ZIP of clips named by the scheme
 * (`voice-keys.ts`), read and checked here before anything of it is kept.
 * Only audio files with a name of the scheme are taken, and only when their
 * first bytes are that audio's; anything else in the ZIP is left behind,
 * never opened. Nothing in a pack is ever run or shown but its manifest's
 * few words, as plain text.
 */

/** The whole ZIP, and everything taken out of it. */
export const MAX_PACK_BYTES = 200 * 1024 * 1024
/** One clip: a line is a few seconds, a few hundred kilobytes at most. */
export const MAX_CLIP_BYTES = 5 * 1024 * 1024
const MAX_MANIFEST_BYTES = 64 * 1024
const MAX_FIELD = 80

export interface PackManifest {
  name: string
  author: string
  language: string
  version: string
}

export interface PackClip {
  /** The clip's name in the scheme (`objective.dragon.60s`, `champion/leesin`, `number/3`). */
  name: string
  variant: number
  type: string
  data: Uint8Array
}

export type IgnoredReason = 'unsafePath' | 'notAudio' | 'unknownName' | 'tooLarge' | 'duplicate' | 'unsupported'

export interface PackRead {
  manifest: PackManifest
  clips: PackClip[]
  /** The entries left behind, and why. */
  ignored: { path: string, reason: IgnoredReason }[]
}

export type PackRefusal = 'notZip' | 'tooLarge' | 'empty'

export class VoicePackError extends Error {
  constructor(readonly reason: PackRefusal) {
    super(`voice pack refused: ${reason}`)
  }
}

/** A path that climbs out of the ZIP, starts at a root or a drive, or hides a NUL. */
export function unsafePath(path: string) {
  return path.includes('\0') || /^[\\/]/.test(path) || /^[a-z]:/i.test(path) || path.split(/[\\/]/).includes('..')
}

/** Whether `data` begins the way that audio format does: a clip is never taken on its name alone. */
export function looksLike(extension: AudioExtension, data: Uint8Array) {
  const text = (from: number, length: number) => String.fromCharCode(...data.subarray(from, from + length))
  if (extension === 'mp3') return text(0, 3) === 'ID3' || (data[0] === 0xFF && ((data[1] ?? 0) & 0xE0) === 0xE0)
  if (extension === 'ogg') return text(0, 4) === 'OggS'
  return text(0, 4) === 'RIFF' && text(8, 4) === 'WAVE'
}

const field = (value: unknown) => (typeof value === 'string' ? value.replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, MAX_FIELD) : '')

/** The manifest's four words, each a short plain string, and the ZIP's own name for a missing name. */
export function readManifest(data: Uint8Array | null, fileName: string): PackManifest {
  let parsed: Record<string, unknown> = {}
  try {
    const value: unknown = data ? JSON.parse(new TextDecoder().decode(data)) : {}
    if (value && typeof value === 'object' && !Array.isArray(value)) parsed = value as Record<string, unknown>
  }
  catch {
    // A manifest that does not parse is no manifest: the pack keeps its file's name.
  }
  const fallback = field(fileName.split(/[\\/]/).pop()!.replace(/\.zip$/i, '')) || 'Voice pack'
  return { name: field(parsed.name) || fallback, author: field(parsed.author), language: field(parsed.language), version: field(parsed.version) }
}

/**
 * Read a pack's ZIP. Each entry is judged from the ZIP's directory before
 * it is inflated — its path, its name, its size — so an entry refused is
 * never decompressed, and the sizes declared there bound what inflating
 * produces. Refuses a file that is no ZIP, one over `MAX_PACK_BYTES` packed
 * or unpacked, and one with no clip at all; `limits` lowers the caps for tests.
 */
export function readVoicePack(bytes: Uint8Array, fileName: string, limits = { pack: MAX_PACK_BYTES, clip: MAX_CLIP_BYTES }): PackRead {
  if (bytes.length > limits.pack) throw new VoicePackError('tooLarge')
  const ignored: PackRead['ignored'] = []
  const taken = new Map<string, ClipFile>()
  const seen = new Set<string>()
  let manifestPath: string | null = null
  let total = 0
  let overflow = false

  const skip = (path: string, reason: IgnoredReason) => {
    ignored.push({ path, reason })
    return false
  }
  const inflatable = (compression: number) => compression === 0 || compression === 8

  const judge = (path: string, size: number, compression: number): boolean => {
    if (path.endsWith('/') || path.split(/[\\/]/).includes('__MACOSX')) return false
    if (unsafePath(path)) return skip(path, 'unsafePath')
    if (/(^|[\\/])manifest\.json$/i.test(path) && size <= MAX_MANIFEST_BYTES && inflatable(compression)) {
      if (manifestPath !== null && manifestPath.length <= path.length) return false
      manifestPath = path
      return true
    }
    const clip = clipFile(path)
    if (!clip) return skip(path, /\.(mp3|ogg|wav)$/i.test(path) ? 'unknownName' : 'notAudio')
    if (!inflatable(compression)) return skip(path, 'unsupported')
    if (size > limits.clip) return skip(path, 'tooLarge')
    const id = `${clip.name}#${clip.variant}`
    if (seen.has(id)) return skip(path, 'duplicate')
    // Over the cap, nothing more is inflated: the pack is refused once the directory is read.
    if (total + size > limits.pack) {
      overflow = true
      return false
    }
    seen.add(id)
    total += size
    taken.set(path, clip)
    return true
  }

  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes, { filter: entry => judge(entry.name, entry.originalSize, entry.compression) })
  }
  catch {
    throw new VoicePackError('notZip')
  }
  if (overflow) throw new VoicePackError('tooLarge')

  const clips: PackClip[] = []
  for (const [path, clip] of taken) {
    const data = files[path]
    if (!data || data.length > limits.clip || !looksLike(clip.extension, data)) {
      ignored.push({ path, reason: 'notAudio' })
      continue
    }
    clips.push({ name: clip.name, variant: clip.variant, type: AUDIO_TYPES[clip.extension], data })
  }
  if (clips.length === 0) throw new VoicePackError('empty')
  return { manifest: readManifest(manifestPath ? files[manifestPath] ?? null : null, fileName), clips, ignored }
}
