import type { GuideTerm } from '~/utils/guide-entities'

/**
 * The game's words in what a MOBAFire author wrote, kept out of the machine
 * translation's hands (`utils/guide-translate`). Left to itself, Google reads a
 * guide as ordinary English: "trades" became "negociações", "builds"
 * "construções", "Certain Death" "Certa Morte", an item's name a phrase. So
 * before a text goes, every word of the game in it is wrapped in a
 * `<span class="notranslate">` — which the service leaves as it is, tried on
 * its `translate_a/t` endpoint — and numbered; when the translation comes back,
 * each is put back: a thing of the game (an item, a rune, a summoner spell, a
 * champion or one of the guide champion's abilities) under its name in the
 * player's language, from the app's own data; the players' jargon (build,
 * gank, trade, lane…), the ability keys (Q, W1, E-Q) and the usual
 * abbreviations (AD, CS) as the author wrote them, the way Brazilian players
 * write them too. An inline reference to the game (`span.guide-ref`, from
 * `sanitizeGuideHtml`) is never sent at all: an empty mark stands in for it.
 */

/** What a protected word is: a thing of the game, by its id — or the players' jargon. */
export type LexiconKind = GuideTerm['kind'] | 'ability' | 'jargon'

export interface LexiconEntry {
  /** As the game (or the jargon list) writes it, in English. */
  name: string
  kind: LexiconKind
  /** The thing's id; null for jargon and abilities. */
  id: number | null
  /** An ability's key (`Q`, `P` for the passive). */
  key?: string
  /**
   * Which of an ability's names this is, for an ability of two forms the game
   * names as one (`Blood Frenzy / Snack Attack`, Elise's `Neurotoxin /
   * Venomous Bite`): authors write each half alone, and each is given back as
   * the same half of the name in the player's language.
   */
  part?: { at: number, of: number }
  /**
   * A one-word name is protected only where the author capitalised it: "Heal"
   * is the summoner spell, "heal up" plain English, left to the translator.
   */
  strict: boolean
}

export interface GuideLexicon {
  entries: Map<string, LexiconEntry>
  /** Every entry's name, longest first, as whole words; null for an empty lexicon. */
  pattern: RegExp | null
}

/** One of the guide champion's abilities by its English name (Data Dragon's `en_US`). */
export interface LexiconAbility {
  name: string
  key: string
}

/**
 * The players' own words, kept in English: Brazilian players write "build",
 * "gank", "farm" and "trade" as they are, and a translator turns each into a
 * dictionary word nobody uses in the game ("construção", "negociar"). A verb
 * or a noun brings its usual forms (`formsOf`). Words too common in ordinary
 * English to protect alone come in their game phrases only: "clear" as "full
 * clear" and "clearing", "back" as "backing", "early" as "early game", "top"
 * and "mid" as "top lane" and "mid laner".
 */
const JARGON = [
  'build', 'trade', 'gank', 'counter gank', 'counter-gank', 'countergank', 'lane', 'laner', 'jungle', 'jungler', 'farm', 'poke', 'all-in', 'all in',
  'kite', 'roam', 'split push', 'split-push', 'splitpush', 'snowball', 'carry', 'tank', 'tanky', 'bruiser', 'adc', 'support',
  'top lane', 'mid lane', 'bot lane', 'toplane', 'midlane', 'botlane', 'top laner', 'mid laner', 'bot laner', 'toplaner', 'midlaner', 'botlaner',
  'early game', 'mid game', 'late game', 'power spike', 'spike', 'cooldown', 'ult', 'flash', 'smite', 'ignite', 'ghost', 'exhaust',
  'buff', 'red buff', 'blue buff', 'nerf', 'matchup', 'counter', 'counterpick', 'counter pick', 'combo', 'burst', 'sustain', 'invade',
  'full clear', 'clear speed', 'jungle clear', 'wave clear', 'clearing', 'dive', 'tower dive', 'peel', 'engage', 'freeze', 'push',
  'slow push', 'fast push', 'wave', 'recall', 'backing', 'back timing', 'reset', 'proc', 'stack', 'skillshot', 'one-shot', 'oneshot',
  'counterplay', 'counter play', 'counter-play', 'itemization', 'gap closer', 'gapcloser', 'leash', 'scuttle', 'teamfight', 'team fight', 'skirmish', 'objective', 'pathing', 'clear path', 'farm path', 'jungle path',
]

/** Words that are words of the game only in capitals: "AD", not "ad"; "TP", not "tp". */
const ACRONYMS = ['AD', 'AP', 'ADC', 'CC', 'CS', 'DPS', 'AoE', 'AOE', 'KDA', 'TP', 'JG', 'HP', 'MR', 'AA', 'AAs']

/** A word's usual forms: `trade` → trades, trading, traded, trader; `carry` → carries, carried, carrying. */
export function formsOf(phrase: string): string[] {
  const words = phrase.split(' ')
  const last = words.pop()!
  const head = words.length ? `${words.join(' ')} ` : ''
  if (!/^[a-z]+$/.test(last) || last.length < 3) return [phrase]
  const stem = last.endsWith('e') ? last.slice(0, -1) : last
  const forms = new Set([last, `${last}s`, `${stem}ing`, `${stem}ed`, `${stem}er`, `${stem}ers`])
  if (last.endsWith('y')) for (const ending of ['ies', 'ied']) forms.add(`${last.slice(0, -1)}${ending}`)
  if (/(?:sh|ch|x|ss)$/.test(last)) forms.add(`${last}es`)
  return [...forms].map(form => head + form)
}

/** A word as the lexicon keys it: lower case, one kind of apostrophe, single spaces. */
export const termKey = (text: string) => text.normalize('NFC').toLowerCase().replace(/[’‘`´]/g, '\'').replace(/\s+/g, ' ').trim()

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A name as the pattern looks for it: any apostrophe, any run of spaces. */
const patternOf = (name: string) => escape(termKey(name)).replace(/'/g, '[\'’‘]').replace(/ /g, '\\s+')

const lexicons = new WeakMap<GuideTerm[], Map<string, GuideLexicon>>()

/**
 * The words a guide's translation protects: every thing of the game the index
 * knows by its English name, the guide champion's abilities, and the jargon,
 * which wins where it is a game name too ("Flash" stays "Flash"). Built once
 * per index and champion.
 */
export function guideLexicon(terms: GuideTerm[], abilities: LexiconAbility[] = []): GuideLexicon {
  const cacheKey = abilities.map(ability => `${ability.key}:${ability.name}`).join('|')
  let byChampion = lexicons.get(terms)
  const kept = byChampion?.get(cacheKey)
  if (kept) return kept
  const entries = new Map<string, LexiconEntry>()
  const add = (entry: LexiconEntry) => {
    const key = termKey(entry.name)
    if (key.length < 2 || !/\p{L}/u.test(key)) return
    entries.set(key, entry)
  }
  for (const term of terms) add({ name: term.name, kind: term.kind, id: term.id, strict: !/[\s'’.:&-]/.test(term.name.trim()) })
  for (const ability of abilities) {
    const strict = (name: string) => !/[\s'’.:&-]/.test(name.trim())
    add({ name: ability.name, kind: 'ability', id: null, key: ability.key, strict: strict(ability.name) })
    const parts = abilityParts(ability.name)
    if (parts.length > 1) parts.forEach((name, at) => add({ name, kind: 'ability', id: null, key: ability.key, part: { at, of: parts.length }, strict: strict(name) }))
  }
  for (const phrase of JARGON) {
    for (const form of formsOf(phrase)) add({ name: form, kind: 'jargon', id: null, strict: false })
  }
  const names = [...entries.keys()].sort((a, b) => b.length - a.length || a.localeCompare(b))
  const lexicon: GuideLexicon = {
    entries,
    pattern: names.length ? new RegExp(`(^|[^\\p{L}\\p{N}_])(${names.map(patternOf).join('|')})(?![\\p{L}\\p{N}_])`, 'giu') : null,
  }
  if (!byChampion) lexicons.set(terms, (byChampion = new Map()))
  byChampion.set(cacheKey, lexicon)
  return lexicon
}

/** An ability's names, for one of two forms named as one (`Blood Frenzy / Snack Attack`); a single name otherwise. */
export const abilityParts = (name: string) => name.split(/\s*\/\s*/).map(part => part.trim()).filter(Boolean)

/**
 * The name `local` gives a thing in the player's language, or the half of it
 * an entry stands for: `Frenesi Sanguinário/Ataque Faminto`'s first half for
 * `Blood Frenzy`. Null where the player's name does not split as the
 * English one does.
 */
export function localPart(entry: LexiconEntry, name: string | null): string | null {
  if (!name || !entry.part) return name
  const parts = abilityParts(name)
  return parts.length === entry.part.of ? parts[entry.part.at] ?? null : null
}

/** An empty lexicon: only the ability keys and the abbreviations are protected. */
export const NO_LEXICON: GuideLexicon = { entries: new Map(), pattern: null }

/**
 * The ability keys as authors write them — `Q`, `W1`, `R2`, `AA`, combos as
 * `E-Q`, `Q > W`, `E+Q`, and made verbs (`W'd`, `E'ing`), kept whole: a lone
 * key before an apostrophe came back from the translator doubled
 * (`E E'ing`) — and the abbreviations, in capitals only.
 */
const KEY = '(?:[QWER][1-3]?|AA)'
const KEYS = new RegExp(`(^|[^\\p{L}\\p{N}_])(${KEY}(?:\\s?[-+>/]\\s?${KEY})*(?:['’]\\p{Ll}{1,3})?|${ACRONYMS.map(escape).join('|')})(?![\\p{L}\\p{N}_])`, 'gu')

/** One protected word found in a text. */
export interface TermMatch {
  start: number
  end: number
  text: string
  entry: LexiconEntry | null
}

/** Every protected word of `text`, in order: the lexicon's, then the keys and abbreviations between them. */
export function termMatches(text: string, lexicon: GuideLexicon): TermMatch[] {
  const found: TermMatch[] = []
  if (lexicon.pattern) {
    for (const match of text.matchAll(lexicon.pattern)) {
      const word = match[2]!
      const entry = lexicon.entries.get(termKey(word))
      if (!entry) continue
      // A one-word name the author did not capitalise is plain English: "heal", "resolve".
      if (entry.strict && word[0] === word[0]!.toLowerCase()) continue
      const start = match.index + match[1]!.length
      found.push({ start, end: start + word.length, text: word, entry })
    }
  }
  const taken = (start: number, end: number) => found.some(match => start < match.end && end > match.start)
  for (const match of text.matchAll(KEYS)) {
    const start = match.index + match[1]!.length
    const end = start + match[2]!.length
    if (!taken(start, end)) found.push({ start, end, text: match[2]!, entry: null })
  }
  return found.sort((a, b) => a.start - b.start)
}

/** A protected piece of a text: a word, or an inline reference's attributes (`span.guide-ref`). */
export type Protected = { text: string, entry: LexiconEntry | null } | { ref: Record<string, string> }

const MARK = 'notranslate'
/** A run of the author's capitals, sent in small letters and given back in capitals (`shoutedRuns`). */
const CAPS = 'tm-caps'

const parse = (html: string) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')

/** The text nodes under `root`, in order. */
function textsOf(root: Node): Text[] {
  const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node as Text)
  return texts
}

/**
 * Where an author writes in capitals — "VERY TOUGH MATCHUP!", "ALL BUILDS
 * (CHECK NOTES)" — as `[start, end)` spans: runs of words with no small letter
 * and at least two of three letters or more, so a key (`W1>Q`) or an
 * abbreviation (`AD`) alone is no run, ending at the last of those. The translator reads shouting poorly —
 * "VERY TOUGH MATCHUP" came back "JOGO MUITO", the matchup taken for the
 * game and the toughness lost — and reads the same words in small letters
 * well, so a run goes in small letters and its translation comes back in
 * capitals.
 */
export function shoutedRuns(text: string): [number, number][] {
  const runs: [number, number][] = []
  let start = -1
  let end = -1
  let words = 0
  const close = () => {
    if (start >= 0 && words >= 2) runs.push([start, end])
    start = -1
    words = 0
  }
  for (const token of text.matchAll(/\S+/g)) {
    const word = token[0]
    const letters = word.match(/\p{L}/gu)?.length ?? 0
    if (/\p{Ll}/u.test(word)) {
      close()
      continue
    }
    // Figures and marks (`{26.22}`, `/`, `!`) sit inside a run, never start or end one.
    if (!letters) continue
    if (start < 0) start = token.index
    // A word of a letter or two (`I`, `TO`, `W1`) ends no run: "MATCHUP! I like it" shouts up to the matchup.
    if (letters < 3) continue
    end = token.index + word.length
    words++
  }
  close()
  return runs
}

/**
 * `html` with every protected word wrapped in a numbered `span.notranslate`,
 * every inline reference swapped for an empty one, and every run of capitals
 * in small letters inside a `span.tm-caps`: what is sent to the translator,
 * and what `restoreTerms` needs to put each back.
 */
export function protectTerms(html: string, lexicon: GuideLexicon): { html: string, kept: Protected[] } {
  const doc = parse(html)
  const kept: Protected[] = []
  const mark = (content: string | null) => {
    const span = doc.createElement('span')
    span.setAttribute('class', MARK)
    span.setAttribute('data-p', String(kept.length))
    if (content) span.textContent = content
    return span
  }
  for (const ref of Array.from(doc.body.querySelectorAll('span.guide-ref'))) {
    const attributes: Record<string, string> = {}
    for (const attribute of Array.from(ref.attributes)) attributes[attribute.name] = attribute.value
    const span = mark(null)
    kept.push({ ref: attributes })
    ref.replaceWith(span)
  }
  // The runs of capitals first, as they were written: the words are found in them after, in the author's case.
  for (const node of textsOf(doc.body)) {
    const value = node.data
    const runs = shoutedRuns(value)
    if (!runs.length) continue
    const fragment = doc.createDocumentFragment()
    let at = 0
    for (const [start, end] of runs) {
      if (start > at) fragment.appendChild(doc.createTextNode(value.slice(at, start)))
      const caps = doc.createElement('span')
      caps.setAttribute('class', CAPS)
      caps.textContent = value.slice(start, end)
      fragment.appendChild(caps)
      at = end
    }
    if (at < value.length) fragment.appendChild(doc.createTextNode(value.slice(at)))
    node.replaceWith(fragment)
  }
  for (const node of textsOf(doc.body)) {
    const value = node.data
    const matches = termMatches(value, lexicon)
    if (!matches.length) continue
    const fragment = doc.createDocumentFragment()
    let at = 0
    for (const match of matches) {
      if (match.start > at) fragment.appendChild(doc.createTextNode(value.slice(at, match.start)))
      fragment.appendChild(mark(match.text))
      kept.push({ text: match.text, entry: match.entry })
      at = match.end
    }
    if (at < value.length) fragment.appendChild(doc.createTextNode(value.slice(at)))
    node.replaceWith(fragment)
  }
  for (const caps of Array.from(doc.body.querySelectorAll(`span.${CAPS}`))) {
    for (const node of textsOf(caps)) {
      if (!node.parentElement?.closest(`span.${MARK}`)) node.data = node.data.toLowerCase()
    }
  }
  return { html: doc.body.innerHTML, kept }
}

/** The blocks a sentence cannot run across: what starts one starts a sentence. */
const BLOCKS = new Set(['BODY', 'P', 'LI', 'DIV', 'H2', 'H3', 'H4', 'H5', 'TD', 'TH', 'BLOCKQUOTE'])

/** Whether `node` opens a sentence: nothing but space before it in its block, or a line break, or a full stop. */
function startsSentence(node: Node): boolean {
  for (let at: Node | null = node; at; at = at.parentNode) {
    for (let before = at.previousSibling; before; before = before.previousSibling) {
      if (before.nodeName === 'BR') return true
      const text = (before.textContent ?? '').trim()
      if (text) return /[.!?…:]$/.test(text)
    }
    if (at.parentNode && BLOCKS.has(at.parentNode.nodeName)) return true
  }
  return true
}

/**
 * The translation with each protected piece put back: a reference as it was,
 * a thing of the game under `local`'s name for it (its English one when the
 * app has none), jargon as the author wrote it; and each run of capitals in
 * capitals again. The translator likes to put a space between a mark and the
 * punctuation after it (`lane .`): taken out.
 */
export function restoreTerms(html: string, kept: Protected[], local: (entry: LexiconEntry) => string | null): string {
  const doc = parse(html)
  for (const span of Array.from(doc.body.querySelectorAll(`span.${MARK}`))) {
    const piece = kept[Number(span.getAttribute('data-p'))]
    let node: Node
    if (piece && 'ref' in piece) {
      const ref = doc.createElement('span')
      for (const [name, value] of Object.entries(piece.ref)) ref.setAttribute(name, value)
      node = ref
    }
    else if (piece) {
      node = doc.createTextNode(piece.entry && piece.entry.kind !== 'jargon' ? localPart(piece.entry, local(piece.entry)) ?? piece.text : piece.text)
    }
    else {
      node = doc.createTextNode(span.textContent ?? '')
    }
    // A word the translation moved to the head of a sentence ("Bruiser build works" → "build Bruiser funciona") takes its capital.
    if (piece && !('ref' in piece) && startsSentence(span)) (node as Text).data = (node as Text).data.replace(/^\p{Ll}/u, letter => letter.toUpperCase())
    span.replaceWith(node)
    const after = node.nextSibling
    if (after?.nodeType === Node.TEXT_NODE) (after as Text).data = (after as Text).data.replace(/^\s+(?=[.,;:!?)\]%…])/, '')
    const before = node.previousSibling
    if (before?.nodeType === Node.TEXT_NODE) (before as Text).data = (before as Text).data.replace(/([([])\s+$/, '$1')
  }
  for (const caps of Array.from(doc.body.querySelectorAll(`span.${CAPS}`))) {
    for (const node of textsOf(caps)) node.data = node.data.toUpperCase()
    caps.replaceWith(...Array.from(caps.childNodes))
  }
  return doc.body.innerHTML
}

/** A plain text as HTML for the translator: its characters escaped, its line breaks as `<br>`. */
export function textToHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>')
}

/** HTML back to a plain text: its characters unescaped, each `<br>` a line break, the spaces the translator left around it gone. */
export function htmlToText(html: string): string {
  const doc = parse(html)
  for (const br of Array.from(doc.body.querySelectorAll('br'))) br.replaceWith(doc.createTextNode('\n'))
  return (doc.body.textContent ?? '').split('\n').map(line => line.replace(/\s+/g, ' ').trim()).join('\n').trim()
}
