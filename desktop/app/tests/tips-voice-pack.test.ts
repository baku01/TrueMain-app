import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { PackRefusal } from '../app/utils/tips/voice-pack'
import { VoicePackError, looksLike, readManifest, readVoicePack, unsafePath } from '../app/utils/tips/voice-pack'

// The first bytes of each format, and a little after: what a clip is checked by.
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, 1, 2, 3])
const FRAME = new Uint8Array([0xFF, 0xFB, 0x90, 0x64, 0, 0, 0, 0])
const OGG = strToU8('OggS\0\u0002rest-of-page')
const WAV = strToU8('RIFF\u0024\0\0\0WAVEfmt ')

const zip = (files: Record<string, Uint8Array>, level: 0 | 6 = 6) => zipSync(files, { level })

function refusal(read: () => unknown): PackRefusal | null {
  try {
    read()
    return null
  }
  catch (error) {
    return error instanceof VoicePackError ? error.reason : null
  }
}

describe('readVoicePack', () => {
  it('takes the clips of the scheme, their variants, the names and the numbers, in any folder', () => {
    const read = readVoicePack(zip({
      'Meu pacote/objective.dragon.60s.mp3': MP3,
      'Meu pacote/objective.dragon.60s.1.mp3': FRAME,
      'Meu pacote/map.minimap.ogg': OGG,
      'Meu pacote/champion/LeeSin.wav': WAV,
      'Meu pacote/number/3.mp3': MP3,
    }), 'pack.zip')
    expect(read.clips.map(clip => [clip.name, clip.variant, clip.type]).toSorted()).toEqual([
      ['champion/leesin', 0, 'audio/wav'],
      ['map.minimap', 0, 'audio/ogg'],
      ['number/3', 0, 'audio/mpeg'],
      ['objective.dragon.60s', 0, 'audio/mpeg'],
      ['objective.dragon.60s', 1, 'audio/mpeg'],
    ])
    expect(read.clips.find(clip => clip.name === 'map.minimap')!.data).toEqual(OGG)
    expect(read.ignored).toEqual([])
  })

  it('reads stored entries as well as deflated ones', () => {
    expect(readVoicePack(zip({ 'map.minimap.mp3': MP3 }, 0), 'pack.zip').clips).toHaveLength(1)
  })

  it('leaves behind names off the scheme, other files, and macOS\'s resource forks', () => {
    const read = readVoicePack(zip({
      'map.minimap.mp3': MP3,
      'objective.dragon.15s.mp3': MP3,
      'cover.png': strToU8('\u0089PNG'),
      'LEIA-ME.txt': strToU8('oi'),
      '__MACOSX/._map.minimap.mp3': MP3,
    }), 'pack.zip')
    expect(read.clips.map(clip => clip.name)).toEqual(['map.minimap'])
    expect(read.ignored).toEqual([
      { path: 'objective.dragon.15s.mp3', reason: 'unknownName' },
      { path: 'cover.png', reason: 'notAudio' },
      { path: 'LEIA-ME.txt', reason: 'notAudio' },
    ])
  })

  it('refuses entries whose path climbs out, starts at a root or a drive', () => {
    for (const path of ['../map.minimap.mp3', 'pack/../../map.minimap.mp3', '/map.minimap.mp3', 'C:/map.minimap.mp3', '..\\map.minimap.mp3']) {
      expect(unsafePath(path), path).toBe(true)
    }
    expect(unsafePath('pack/champion/LeeSin.mp3')).toBe(false)
    const read = readVoicePack(zip({ 'map.minimap.mp3': MP3, '../objective.dragon.60s.mp3': MP3 }), 'pack.zip')
    expect(read.clips.map(clip => clip.name)).toEqual(['map.minimap'])
    expect(read.ignored).toEqual([{ path: '../objective.dragon.60s.mp3', reason: 'unsafePath' }])
  })

  it('takes a clip on its bytes, never on its name alone', () => {
    expect(looksLike('mp3', MP3) && looksLike('mp3', FRAME) && looksLike('ogg', OGG) && looksLike('wav', WAV)).toBe(true)
    expect([looksLike('mp3', OGG), looksLike('ogg', MP3), looksLike('wav', strToU8('RIFF0000AVI '))]).toEqual([false, false, false])
    const read = readVoicePack(zip({ 'map.minimap.mp3': MP3, 'farm.ok.mp3': strToU8('<script>alert(1)</script>') }), 'pack.zip')
    expect(read.ignored).toEqual([{ path: 'farm.ok.mp3', reason: 'notAudio' }])
  })

  it('keeps the first of two files for one clip', () => {
    const read = readVoicePack(zip({ 'a/map.minimap.mp3': MP3, 'b/map.minimap.mp3': FRAME }), 'pack.zip')
    expect(read.clips).toHaveLength(1)
    expect(read.clips[0]!.data).toEqual(MP3)
    expect(read.ignored).toEqual([{ path: 'b/map.minimap.mp3', reason: 'duplicate' }])
  })

  it('leaves out a clip over the per-file cap, and refuses a pack over the total one', () => {
    const big = new Uint8Array(64).fill(1)
    big.set(MP3)
    const capped = readVoicePack(zip({ 'map.minimap.mp3': MP3, 'farm.ok.mp3': big }), 'pack.zip', { pack: 10_000, clip: 32 })
    expect(capped.ignored).toEqual([{ path: 'farm.ok.mp3', reason: 'tooLarge' }])
    // Two clips of 4 000 bytes that pack small: the ZIP is under the cap, what it unpacks to is not.
    const long = new Uint8Array(4000)
    long.set(MP3)
    const two = zip({ 'map.minimap.mp3': long, 'farm.ok.mp3': long })
    expect(two.length).toBeLessThan(6000)
    expect(refusal(() => readVoicePack(two, 'pack.zip', { pack: 6000, clip: 5000 }))).toBe('tooLarge')
    expect(refusal(() => readVoicePack(two, 'pack.zip', { pack: 8000, clip: 5000 }))).toBeNull()
    expect(refusal(() => readVoicePack(two, 'pack.zip', { pack: two.length - 1, clip: 5000 }))).toBe('tooLarge')
  })

  it('refuses a file that is no ZIP, and a ZIP with no clip in it', () => {
    expect(refusal(() => readVoicePack(strToU8('just some text, renamed .zip'), 'pack.zip'))).toBe('notZip')
    expect(refusal(() => readVoicePack(zip({ 'LEIA-ME.txt': strToU8('oi'), 'objective.dragon.15s.mp3': MP3 }), 'pack.zip'))).toBe('empty')
  })
})

describe('the manifest', () => {
  const manifest = (body: string) => zip({ 'map.minimap.mp3': MP3, 'manifest.json': strToU8(body) })

  it('gives the pack its name, author, language and version, as short plain strings', () => {
    const read = readVoicePack(manifest(JSON.stringify({ name: '  Narrador\u0007 BR\u202E ', author: 'Fulano', language: 'pt-BR', version: 2, extra: 'x' })), 'pack.zip')
    expect(read.manifest).toEqual({ name: 'Narrador BR', author: 'Fulano', language: 'pt-BR', version: '' })
    expect(readManifest(strToU8(JSON.stringify({ name: 'x'.repeat(500) })), 'p.zip').name).toHaveLength(80)
  })

  it('falls back to the ZIP\'s name when there is none, or it does not parse', () => {
    expect(readVoicePack(zip({ 'map.minimap.mp3': MP3 }), 'Downloads/Meu Pack.ZIP').manifest).toEqual({ name: 'Meu Pack', author: '', language: '', version: '' })
    expect(readVoicePack(manifest('{ not json'), 'Voz.zip').manifest.name).toBe('Voz')
    expect(readVoicePack(manifest('["a list"]'), 'Voz.zip').manifest.name).toBe('Voz')
  })

  it('is read from the pack\'s folder too, the shallowest one winning', () => {
    const read = readVoicePack(zip({
      'Pack/deep/manifest.json': strToU8('{"name":"Deep"}'),
      'Pack/manifest.json': strToU8('{"name":"Top"}'),
      'Pack/map.minimap.mp3': MP3,
    }), 'pack.zip')
    expect(read.manifest.name).toBe('Top')
  })
})
