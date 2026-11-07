import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { allMessages, setActiveLocale } from '#common/utils/i18n'
import { unzipSync, strFromU8 } from 'fflate'
import { afterEach, describe, expect, it } from 'vitest'
import { SAMPLE_PARAMS, TIP_KEYS, makeTip } from '../app/utils/tips/catalogue'
import { tipImage, tipText } from '../app/utils/tips/display'
import { DEFAULT_TIP_SETTINGS, readTipSettings, speaks, tipsRunning } from '../app/utils/tips/settings'
import { clipFile, coverage, segmentClip, voicePlan } from '../app/utils/tips/voice'
import { VOICE_KEYS } from '../app/utils/tips/voice-keys'
import { VoicePackError, readVoicePack } from '../app/utils/tips/voice-pack'
import { voiceKeysMarkdown, voicePackReadme, voicePackTemplate } from '../app/utils/tips/voice-template'

afterEach(() => setActiveLocale('en'))

describe('a pack\'s file names', () => {
  it('read a tip\'s line and its variants, in any folder of the ZIP', () => {
    expect(clipFile('objective.dragon.60s.mp3')).toEqual({ name: 'objective.dragon.60s', variant: 0, extension: 'mp3' })
    expect(clipFile('meu pacote/objective.dragon.60s.2.OGG')).toEqual({ name: 'objective.dragon.60s', variant: 2, extension: 'ogg' })
    expect(clipFile('jungle.spotted.tail.wav')).toEqual({ name: 'jungle.spotted.tail', variant: 0, extension: 'wav' })
  })

  it('read a champion\'s name and a number from their folders', () => {
    expect(clipFile('champion/LeeSin.mp3')).toEqual({ name: 'champion/leesin', variant: 0, extension: 'mp3' })
    expect(clipFile('pack/Champion/MonkeyKing.1.mp3')).toEqual({ name: 'champion/monkeyking', variant: 1, extension: 'mp3' })
    expect(clipFile('number/03.mp3')).toEqual({ name: 'number/3', variant: 0, extension: 'mp3' })
  })

  it('know nothing of another name, another format, or a bad name in a folder', () => {
    for (const path of ['objective.dragon.15s.mp3', 'objective.dragon.60s.txt', 'objective.dragon.60s', 'champion/Lee Sin.mp3', 'number/three.mp3', 'number/1000.mp3', '._objective.dragon.60s.mp3']) {
      expect(clipFile(path), path).toBeNull()
    }
  })
})

describe('a tip\'s voice', () => {
  const first = (variants: readonly string[]) => variants[0]!
  const spotted = makeTip('jungle.spotted', { champion: 'Wukong', alias: 'MonkeyKing' })

  it('puts the tip\'s names and numbers in its segments', () => {
    expect(segmentClip('champion:{alias}', { alias: 'MonkeyKing' })).toBe('champion/monkeyking')
    expect(segmentClip('number:{deaths}', { deaths: 3 })).toBe('number/3')
    expect(segmentClip('jungle.spotted.tail', {})).toBe('jungle.spotted.tail')
    expect(segmentClip('champion:{alias}', {})).toBeNull()
    expect(segmentClip('number:{deaths}', { deaths: 'many' })).toBeNull()
  })

  it('stitches the line from its segments when the pack has every one', () => {
    const clips = { 'champion/monkeyking': ['wukong'], 'jungle.spotted.tail': ['tail'], 'jungle.spotted': ['line'] }
    expect(voicePlan(spotted.key, spotted.params, clips, first)).toEqual(['wukong', 'tail'])
    const streak = makeTip('death.streak', { deaths: 5 })
    expect(voicePlan(streak.key, streak.params, { 'number/5': ['five'], 'death.streak.tail': ['tail'] }, first)).toEqual(['five', 'tail'])
  })

  it('falls back to the whole line when a segment is missing, and to text only without it', () => {
    expect(voicePlan(spotted.key, spotted.params, { 'jungle.spotted.tail': ['tail'], 'jungle.spotted': ['line'] }, first)).toEqual(['line'])
    expect(voicePlan(spotted.key, spotted.params, { 'champion/monkeyking': ['wukong'], 'jungle.spotted': ['line'] }, first)).toEqual(['line'])
    expect(voicePlan(spotted.key, spotted.params, { 'champion/monkeyking': ['wukong'] }, first)).toEqual([])
    expect(voicePlan('map.minimap', {}, {}, first)).toEqual([])
  })

  it('plays one of a line\'s variants', () => {
    const variants = ['a', 'b', 'c']
    expect(voicePlan('map.minimap', {}, { 'map.minimap': variants }, list => list.at(-1)!)).toEqual(['c'])
    for (let draw = 0; draw < 20; draw++) expect(variants).toContain(voicePlan('map.minimap', {}, { 'map.minimap': variants })[0])
  })

  it('counts what a pack records and lists what it lacks', () => {
    const report = coverage({ 'map.minimap': ['x'], 'jungle.spotted.tail': ['y'], 'champion/leesin': ['z'], 'number/3': ['n'], 'number/4': ['m'] })
    expect(report).toMatchObject({ covered: 2, total: VOICE_KEYS.length, champions: 1, numbers: 2 })
    expect(report.missing).toHaveLength(VOICE_KEYS.length - 2)
    expect(report.missing).not.toContain('map.minimap')
  })
})

describe('the scheme', () => {
  const keys = VOICE_KEYS.map(spec => spec.key)
  const parts = VOICE_KEYS.filter(spec => 'part' in spec).map(spec => spec.key)

  it('has one entry a key, none ending in digits, so a variant is never read as a key', () => {
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.filter(key => /\.\d+$/.test(key))).toEqual([])
  })

  it('has every tip a line, every part in a line\'s segments, every segment a part, a name or a number', () => {
    expect(TIP_KEYS.toSorted()).toEqual(keys.filter(key => !parts.includes(key)).toSorted())
    const used = VOICE_KEYS.flatMap(spec => ('segments' in spec ? [...spec.segments] : []))
    expect(used.filter(segment => !/^(champion|number):\{\w+\}$/.test(segment) && !parts.includes(segment))).toEqual([])
    expect(parts.filter(part => !used.includes(part))).toEqual([])
  })

  it('gives every tip a line in both languages, with the params its rules fill', () => {
    const { en, 'pt-BR': pt } = allMessages()
    expect(TIP_KEYS.filter(key => !en[`tip.${key}`] || !pt[`tip.${key}`])).toEqual([])
    const asked = (message: string) => [...message.matchAll(/\{(\w+)\}/g)].map(match => match[1])
    expect(TIP_KEYS.flatMap(key => asked(en[`tip.${key}`]!)).filter(param => !(param! in SAMPLE_PARAMS))).toEqual([])
  })

  it('is what the doc lists, and what the template\'s LEIA-ME lists', () => {
    const doc = readFileSync(join(process.cwd(), '../../docs/voice-packs.md'), 'utf8')
    expect(doc).toContain(voiceKeysMarkdown())
    const readme = voicePackReadme()
    for (const spec of VOICE_KEYS) expect(readme).toContain(`${spec.key}.mp3 — "${spec.phrase}"`)
    expect(readme).toContain('champion/<Alias>.mp3 + jungle.spotted.tail.mp3')
  })

  it('hands out a template of a manifest and the LEIA-ME, which imports as no pack', () => {
    const template = voicePackTemplate()
    const files = unzipSync(template)
    expect(Object.keys(files).toSorted()).toEqual(['LEIA-ME.txt', 'manifest.json'])
    expect(JSON.parse(strFromU8(files['manifest.json']!))).toMatchObject({ language: 'pt-BR' })
    expect(() => readVoicePack(template, 'modelo.zip')).toThrow(VoicePackError)
  })
})

describe('a tip on screen', () => {
  it('writes its numbers the active language\'s way', () => {
    const farm = makeTip('farm.great', { csPerMin: 7.5, minute: 10 })
    expect(tipText(farm)).toBe('7.5 CS/min at 10 min — excellent farm, keep it up.')
    setActiveLocale('pt-BR')
    expect(tipText(farm)).toBe('7,5 CS/min aos 10 min — farm excelente, continua assim.')
    expect(tipText(makeTip('recall.earlyGold', { gold: 1450 }))).toBe('1.450 de ouro na mão — empurra a wave e volta pra comprar.')
  })

  it('shows an objective\'s minimap icon, the drake\'s element included, and no picture for the others', () => {
    expect(tipImage(makeTip('objective.dragon.30s', { drake: 'ocean' }))).toMatch(/\/dragon_ocean\.png$/)
    expect(tipImage(makeTip('objective.elder.60s'))).toMatch(/\/dragon_elder\.png$/)
    expect(tipImage(makeTip('objective.herald.smite'))).toMatch(/\/riftherald\.png$/)
    expect(tipImage(makeTip('jungle.spotted', SAMPLE_PARAMS))).toBeNull()
  })
})

describe('the tips\' settings', () => {
  it('read leniently, a field at a time', () => {
    expect(readTipSettings(null)).toEqual(DEFAULT_TIP_SETTINGS)
    expect(readTipSettings('not json')).toEqual(DEFAULT_TIP_SETTINGS)
    const read = readTipSettings(JSON.stringify({ voice: 'yes', categories: { map: false, kill: 'no' }, pack: 'p1', volume: 3 }))
    expect(read).toMatchObject({ voice: true, pack: 'p1', volume: DEFAULT_TIP_SETTINGS.volume })
    expect(read.categories).toMatchObject({ map: false, kill: true, objective: true })
  })

  it('reads the one switch kept before the voice had its own as the voice\'s', () => {
    expect(readTipSettings(JSON.stringify({ enabled: false }))).toMatchObject({ voice: false })
    expect(readTipSettings(JSON.stringify({ enabled: false, voice: true }))).toMatchObject({ voice: true })
  })

  it('speaks with the voice on and a pack chosen, and runs while shown or spoken', () => {
    const settings = (change: Partial<typeof DEFAULT_TIP_SETTINGS>) => ({ ...DEFAULT_TIP_SETTINGS, ...change })
    expect(speaks(settings({ pack: null }))).toBe(false)
    expect(speaks(settings({ pack: 'p1', voice: false }))).toBe(false)
    expect(speaks(settings({ pack: 'p1' }))).toBe(true)
    // Voice only: the tips panel off, the feed still runs for the voice.
    expect(tipsRunning(settings({ pack: 'p1' }), false)).toBe(true)
    expect(tipsRunning(settings({ pack: null }), false)).toBe(false)
    expect(tipsRunning(settings({ voice: false }), true)).toBe(true)
  })
})
