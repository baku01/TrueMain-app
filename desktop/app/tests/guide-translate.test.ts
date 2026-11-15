import { describe, expect, it, vi } from 'vitest'
import type { GuideTerm } from '~/utils/guide-entities'
import type { Guide } from '~/utils/mobafire'
import { formsOf, guideLexicon, htmlToText, protectTerms, restoreTerms, shoutedRuns, termMatches, textToHtml } from '~/utils/guide-terms'
import { proseTree } from '~/utils/guide-prose'
import { translateGuide } from '~/utils/guide-translate'
import { sanitizeGuideHtml } from '~/utils/mobafire'

// The translator, as the service answers: the words outside the marks in
// Portuguese, the marks kept, and a space put before the punctuation after one.
vi.mock('~/utils/translate', () => ({
  translateTexts: async (texts: string[]) => texts.map(text => text
    .replace(/I rush/g, 'Eu corro para')
    .replace(/and then/g, 'e depois')
    .replace(/early/g, 'cedo')
    .replace(/<\/span>\./g, '</span> .')),
}))

const terms: GuideTerm[] = [
  { name: 'Sterak\'s Gage', kind: 'item', id: 3053 },
  { name: 'Heal', kind: 'spell', id: 7 },
  { name: 'Flash', kind: 'spell', id: 4 },
  { name: 'Conqueror', kind: 'rune', id: 8010 },
  { name: 'Briar', kind: 'champion', id: 233 },
  { name: 'Nunu & Willump', kind: 'champion', id: 20 },
]
const abilities = [{ name: 'Head Rush', key: 'Q' }, { name: 'Blood Frenzy / Snack Attack', key: 'W' }, { name: 'Certain Death', key: 'R' }]
const LOCAL: Record<string, string> = { 3053: 'Medalhão de Sterak', 7: 'Curar', 4: 'Flash (pt)', 8010: 'Conquistador', 233: 'Briar', 20: 'Nunu e Willump' }
const local = (entry: { id: number | null, key?: string }) => (entry.key ? { Q: 'Investida', W: 'Frenesi Sanguinário/Ataque Faminto', R: 'Morte Certa' }[entry.key] ?? null : LOCAL[entry.id ?? -1] ?? null)
const lexicon = guideLexicon(terms, abilities)
const words = (text: string) => termMatches(text, lexicon).map(match => match.text)

describe('the game\'s words in a guide\'s writing', () => {
  it('knows a word of the jargon in its usual forms', () => {
    expect(formsOf('trade')).toEqual(expect.arrayContaining(['trade', 'trades', 'trading', 'traded']))
    expect(formsOf('carry')).toEqual(expect.arrayContaining(['carries', 'carried', 'carrying']))
    expect(formsOf('split push')).toContain('split pushing')
  })

  it('finds the game\'s names whole, the longest first, whatever the apostrophe', () => {
    expect(words('Rush Sterak’s Gage, then trade with Head Rush into Certain Death.')).toEqual(['Sterak’s Gage', 'trade', 'Head Rush', 'Certain Death'])
    expect(words('Nunu & Willump ganks early; Briar ganking top lane')).toEqual(['Nunu & Willump', 'ganks', 'Briar', 'ganking', 'top lane'])
    // Never inside another word.
    expect(words('a farmhouse, untraded, overbuild')).toEqual([])
  })

  it('takes a one-word name only where the author capitalised it, and the jargon in any case', () => {
    expect(words('Take Heal, then heal up and BUILDS')).toEqual(['Heal', 'BUILDS'])
    expect(words('take Conqueror, not conqueror')).toEqual(['Conqueror'])
  })

  it('keeps the ability keys and the abbreviations, in capitals only', () => {
    expect(words('Max Q, then W1 into E-Q and AA reset for AD; as ad hoc')).toEqual(['Q', 'W1', 'E-Q', 'AA', 'reset', 'AD'])
    // A key made a verb stays whole, so the translator cannot split it.
    expect(words('you get W\'d, then E\'ing resets it; Q\'s range')).toEqual(['W\'d', 'E\'ing', 'resets', 'Q\'s'])
  })

  it('knows each name of an ability of two forms, and the whole', () => {
    expect(words('Use Blood Frenzy, or Snack Attack: Blood Frenzy / Snack Attack')).toEqual(['Blood Frenzy', 'Snack Attack', 'Blood Frenzy / Snack Attack'])
  })

  it('finds the runs an author shouts, never a key or an abbreviation alone', () => {
    const runs = (text: string) => shoutedRuns(text).map(([start, end]) => text.slice(start, end))
    expect(runs('VERY TOUGH MATCHUP! I like it')).toEqual(['VERY TOUGH MATCHUP!'])
    expect(runs('{26.22} Rank 1 Briar / Briar Jungle ALL BUILDS (CHECK NOTES) !')).toEqual(['ALL BUILDS (CHECK NOTES)'])
    expect(runs('Then W1>Q for AD and CS, or ADC')).toEqual([])
  })
})

describe('protecting the game\'s words through a translation', () => {
  it('marks each word and empties each reference, then puts each back in the player\'s language', () => {
    const html = '<p>I rush <b>Sterak\'s Gage</b> <span class="guide-ref" data-kind="item" data-name="Sterak\'s Gage" data-text="1"></span> and then trade with Q.</p>'
    const { html: sent, kept } = protectTerms(html, lexicon)
    expect(sent).toBe('<p>I rush <b><span class="notranslate" data-p="1">Sterak\'s Gage</span></b> <span class="notranslate" data-p="0"></span> and then <span class="notranslate" data-p="2">trade</span> with <span class="notranslate" data-p="3">Q</span>.</p>')
    expect(kept[0]).toEqual({ ref: { 'class': 'guide-ref', 'data-kind': 'item', 'data-name': 'Sterak\'s Gage', 'data-text': '1' } })
    const answer = sent.replace('I rush', 'Eu corro para').replace('and then', 'e depois').replace('</span>.', '</span> .')
    expect(restoreTerms(answer, kept, local)).toBe('<p>Eu corro para <b>Medalhão de Sterak</b> <span class="guide-ref" data-kind="item" data-name="Sterak\'s Gage" data-text="1"></span> e depois trade with Q.</p>')
  })

  it('gives an ability\'s half the same half of its name in the player\'s language', () => {
    const { html: sent, kept } = protectTerms('Snack Attack, then Head Rush', lexicon)
    expect(restoreTerms(sent, kept, local)).toBe('Ataque Faminto, then Investida')
  })

  it('sends a run of capitals in small letters and gives its translation back in capitals', () => {
    const { html: sent, kept } = protectTerms('VERY TOUGH MATCHUP! I like it.', lexicon)
    expect(sent).toBe('<span class="tm-caps">very tough <span class="notranslate" data-p="0">MATCHUP</span>!</span> I like it.')
    const answer = '<span class="tm-caps"><span class="notranslate" data-p="0">MATCHUP</span> muito difícil!</span> Eu gosto.'
    expect(restoreTerms(answer, kept, local)).toBe('MATCHUP MUITO DIFÍCIL! Eu gosto.')
  })

  it('gives a word the translation moved to the head of a sentence its capital, and no other', () => {
    const { kept } = protectTerms('Bruiser build works. A tank build too', lexicon)
    // Kept: Bruiser, build, tank, build.
    expect(restoreTerms('<span class="notranslate" data-p="1">build</span> Bruiser funciona. Uma <span class="notranslate" data-p="3">build</span> tank também', kept, local))
      .toBe('Build Bruiser funciona. Uma build tank também')
    expect(restoreTerms('Ok: <b><span class="notranslate" data-p="1">build</span></b><br><span class="notranslate" data-p="3">build</span>', kept, local)).toBe('Ok: <b>Build</b><br>Build')
  })

  it('leaves a name the app has no word for in English, and a mark the translator lost as its text', () => {
    const { kept } = protectTerms('Use Flash and Certain Death', lexicon)
    expect(restoreTerms('Use <span class="notranslate" data-p="0">Flash</span> e <span class="notranslate" data-p="1">Certain Death</span> <span class="notranslate" data-p="9">x</span>', kept, () => null))
      .toBe('Use Flash e Certain Death x')
  })

  it('sends a plain text as HTML and reads it back as text, its lines kept', () => {
    expect(textToHtml('a < b & c\nnext')).toBe('a &lt; b &amp; c<br>next')
    expect(htmlToText('a &lt; b &amp; c<br> next ')).toBe('a < b & c\nnext')
  })

  it('translates a guide with its game words protected and localized', async () => {
    const guide = {
      title: 'Briar early guide',
      builds: [],
      threats: [{ champion: 'Elise', image: null, level: 1, label: 'Extreme', note: 'I rush Heal.\nand then Head Rush' }],
      synergies: [],
      chapters: [{ title: 'Runes', html: '<p>I rush <span class="guide-ref" data-kind="ability" data-name="Head Rush" data-image="https://www.mobafire.com/images/ability/briar-head-rush.png"></span> early.</p>' }],
    } as unknown as Guide
    const translated = await translateGuide(guide, 'pt', { lexicon, local })
    expect(translated.title).toBe('Briar cedo guide')
    expect(translated.threats[0]!.note).toBe('Eu corro para Curar.\ne depois Investida')
    expect(translated.chapters[0]!.html).toBe('<p>Eu corro para <span class="guide-ref" data-kind="ability" data-name="Head Rush" data-image="https://www.mobafire.com/images/ability/briar-head-rush.png"></span> cedo.</p>')
  })
})

describe('an author\'s inline references to the game', () => {
  it('makes the site\'s reference a mark the app draws, and keeps that mark through a second sanitizing', () => {
    const site = 'your <span class="ajax-tooltip {t:\'Ability\',i:\'1050\'}" title="Head Rush"> <a href="/league-of-legends/ability/head-rush-1050"><img width="20px" data-original="/images/ability/briar-head-rush.png" src="/images/spacer.png"></a></span> Q'
    const once = sanitizeGuideHtml(site)
    expect(once).toBe('your <span class="guide-ref" data-kind="ability" data-name="Head Rush" data-image="https://www.mobafire.com/images/ability/briar-head-rush.png"></span> Q')
    expect(sanitizeGuideHtml(once)).toBe(once)
    expect(sanitizeGuideHtml('<span class="ajax-tooltip {t:\'Item\',i:\'9\'}"><a href="/league-of-legends/item/steraks-gage-9"><img src="/images/item/steraks-gage.png"><span>Sterak\'s Gage</span></a></span>'))
      .toBe('<span class="guide-ref" data-kind="item" data-name="Sterak\'s Gage" data-image="https://www.mobafire.com/images/item/steraks-gage.png" data-text="1"></span>')
  })

  it('keeps nothing of a mark but a known kind, a name and an allowed picture', () => {
    expect(sanitizeGuideHtml('<span class="guide-ref" data-kind="script" data-name="x"></span><span class="guide-ref" data-kind="item" data-name="Long Sword" data-image="javascript:x()" onclick="x()"></span>'))
      .toBe('<span class="guide-ref" data-kind="item" data-name="Long Sword"></span>')
    // A user's tooltip is no reference: its text stays as text.
    expect(sanitizeGuideHtml('<span class="ajax-tooltip { t:\'User\',i:\'1\' }">Logan</span>')).toBe('<span>Logan</span>')
  })

  it('reads the writing as a tree the chapter draws, each reference a node of its own', () => {
    expect(proseTree('<p>Take <span class="guide-ref" data-kind="rune" data-name="Conqueror" data-text="1"></span><img src="javascript:x()"><img src="https://i.imgur.com/a.png" onerror="x()"></p>')).toEqual([
      { tag: 'p', attrs: {}, children: ['Take ', { ref: { kind: 'rune', name: 'Conqueror', image: null, named: true } }, { tag: 'img', attrs: { src: 'https://i.imgur.com/a.png' }, children: [] }] },
    ])
  })
})
