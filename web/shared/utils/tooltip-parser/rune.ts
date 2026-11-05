import { walkHtmlToSegments } from './dom-walker'
import type { ParsedDocument, ParsedSegment } from './types'

/**
 * Map of raw hex colors emitted by CDragon rune descriptions to a semantic
 * tag name our renderer knows. The aim is to keep palette discipline — the
 * app is dark-mode-only with a constrained color set — so we mediate every
 * inline color through this table.
 *
 * Unknown hex codes fall back to `default` (no inline color, plain text).
 * The list grows empirically: add a new entry the first time a rune surfaces
 * an unseen color.
 */
const RUNE_HEX_TO_TAG: Record<string, string> = {
  '#48c4b7': 'runeadaptive',  // verified — Lethal Tempo adaptive damage
  '#ff9966': 'runead',
  '#ff9900': 'runead',
  '#ffaa00': 'runead',
  '#9999ff': 'runeap',
  '#7eb3ff': 'runeap',
  '#90ee90': 'runehealth',
  '#5bc489': 'runehealth',
  '#ff4444': 'runehealth',
  '#ffff00': 'runearmor',
  '#f2c94c': 'runearmor',
  '#b597f5': 'runemr',
  '#ffffff': 'default',
}

const FONT_TAG_RE = /<font\s+color\s*=\s*['"]?(#[0-9a-fA-F]{3,8})['"]?\s*>([\s\S]*?)<\/font>/gi
const KEYWORD_TAG_RE = /<lol-uikit-tooltipped-keyword[^>]*>([\s\S]*?)<\/lol-uikit-tooltipped-keyword>/gi
const MELEE_RANGED_RE = /\[\s*([^[\]|]+?)\s+Melee\s*\|\|\s*([^[\]|]+?)\s+Ranged\s*\]/gi

/**
 * Parse a CDragon rune description (either `shortDesc` or `longDesc`).
 *
 * CDragon emits rune text in a different shape than DDragon items:
 *   - inline colors via `<font color='#HEX'>` (not semantic tags)
 *   - keyword phrases via `<lol-uikit-tooltipped-keyword key='...'>`
 *   - melee/ranged variants via `[X Melee || Y Ranged]` literal syntax
 *
 * We pre-pass over the raw string to rewrite each of these into something the
 * shared DOM walker understands, then run the same walker as items/spells.
 */
export function parseRuneDescription(description: string): ParsedDocument {
  if (!description) return []
  const prepared = prepareRuneHtml(description)
  return walkHtmlToSegments(prepared).flatMap(highlightRuneText)
}

/**
 * The stats a rune's prose names, in English and Portuguese, to the tag they
 * read in: many localised descriptions carry no color tag at all (Grasp of the
 * Undying in pt-BR is plain text), so the stats and the figures are found in
 * the words themselves. Longest phrase first, so "Vida máxima" wins over "Vida".
 */
const STAT_PHRASES: [string, string][] = ([
  ['dano mágico', 'magicdamage'], ['magic damage', 'magicdamage'],
  ['dano físico', 'physicaldamage'], ['physical damage', 'physicaldamage'],
  ['dano verdadeiro', 'truedamage'], ['true damage', 'truedamage'],
  ['dano adaptativo', 'runeadaptive'], ['adaptive damage', 'runeadaptive'],
  ['força adaptativa', 'runeadaptive'], ['adaptive force', 'runeadaptive'],
  ['dano de ataque', 'runead'], ['attack damage', 'runead'],
  ['poder de habilidade', 'runeap'], ['ability power', 'runeap'],
  ['velocidade de ataque', 'runeas'], ['attack speed', 'runeas'],
  ['velocidade de movimento', 'runespeed'], ['movement speed', 'runespeed'], ['move speed', 'runespeed'],
  ['aceleração de habilidade', 'runehaste'], ['ability haste', 'runehaste'],
  ['resistência mágica', 'runemr'], ['magic resist', 'runemr'], ['magic resistance', 'runemr'],
  ['armadura', 'runearmor'], ['armor', 'runearmor'],
  ['vida máxima', 'runehealth'], ['vida adicional', 'runehealth'], ['vida', 'runehealth'],
  ['maximum health', 'runehealth'], ['max health', 'runehealth'], ['bonus health', 'runehealth'], ['health', 'runehealth'],
  ['curar', 'healing'], ['cura', 'healing'], ['healing', 'healing'], ['heals', 'healing'], ['heal', 'healing'],
  ['escudo', 'shield'], ['shield', 'shield'],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length)

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const NUMBER = String.raw`[+-]?\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?(?:\s*%|s(?![\p{L}]))?`
const HIGHLIGHT_RE = new RegExp(`(?<![\\p{L}\\d])(?:(${NUMBER})|(${STAT_PHRASES.map(([phrase]) => escapeRegExp(phrase)).join('|')}))(?![\\p{L}])`, 'giu')
const TAG_OF = new Map(STAT_PHRASES)

/** A plain stretch of a rune's prose split around its figures and the stats it names. */
function highlightRuneText(segment: ParsedSegment): ParsedSegment[] {
  if (segment.kind !== 'text' || segment.tag !== 'default') return [segment]
  const out: ParsedSegment[] = []
  let last = 0
  for (const match of segment.text.matchAll(HIGHLIGHT_RE)) {
    const at = match.index ?? 0
    if (at > last) out.push({ kind: 'text', tag: 'default', text: segment.text.slice(last, at) })
    const tag = match[1] ? 'runenumber' : TAG_OF.get(match[0].toLowerCase()) ?? 'default'
    out.push({ kind: 'text', tag, text: match[0] })
    last = at + match[0].length
  }
  if (last < segment.text.length) out.push({ kind: 'text', tag: 'default', text: segment.text.slice(last) })
  return out
}

/**
 * Apply the three pre-passes that bring a rune description into shape the
 * shared DOM walker can consume. Exported only for unit testing — production
 * code should call `parseRuneDescription`.
 */
export function prepareRuneHtml(description: string): string {
  let prepared = description

  // 0. A game variable the static data never fills (`@f3@`, `@GoldPerTick*100@`)
  //    would show raw: a bracket that holds one goes (it only states a number
  //    the reader cannot have), and one left elsewhere becomes an ellipsis.
  prepared = prepared
    .replace(/\s*\([^()]*@[^@\s]+@[^()]*\)/g, '')
    .replace(/@[^@\s]+@/g, '…')

  // 0b. A list item (`<li>`, Grasp of the Undying's three effects) starts its
  //     own line, as the client lists it; the walker knows only `<br>`.
  prepared = prepared.replace(/<li>/gi, '<br>• ').replace(/<\/li>/gi, '')

  // 1. Replace `<font color='#HEX'>X</font>` with `<TAG>X</TAG>` where TAG is
  //    a known semantic tag, or strip the wrapper if the hex is unknown.
  prepared = prepared.replace(FONT_TAG_RE, (_, hex: string, inner: string) => {
    const tag = RUNE_HEX_TO_TAG[hex.toLowerCase()]
    if (!tag || tag === 'default') return inner
    return `<${tag}>${inner}</${tag}>`
  })

  // 2. Replace `<lol-uikit-tooltipped-keyword key='...'>X</lol-uikit-...>`
  //    with `<runekeyword>X</runekeyword>`. We drop the `key=` attribute —
  //    resolving it would need a localization table we don't have.
  prepared = prepared.replace(KEYWORD_TAG_RE, (_, inner: string) => `<runekeyword>${inner}</runekeyword>`)

  // 3. Replace `[X Melee || Y Ranged]` with a synthetic `<rng>` marker the
  //    walker turns into a `meleeRanged` segment. Quote-escape the payload
  //    so it survives DOMParser without re-encoding surprises.
  prepared = prepared.replace(MELEE_RANGED_RE, (_, melee: string, ranged: string) => {
    return `<rng melee="${escapeAttr(melee.trim())}" ranged="${escapeAttr(ranged.trim())}"></rng>`
  })

  return prepared
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
