/**
 * Colour for the rune texts. The item descriptions arrive from Data Dragon
 * with their stats already in semantic tags, so they read in colour; the rune
 * texts from Community Dragon carry almost none, and read as plain grey. This
 * adds them back before the shared parser sees the text: the numbers in the
 * emphasis colour, and the game's own terms — damage types, healing, shields,
 * health, armour — in the tooltip vocabulary's colours (`tag-classes.ts`).
 * Terms are matched in English and Portuguese, the two languages of the app.
 * Text the game already tagged is left to its tag.
 */
const TERMS: [string, string][] = [
  ['magic damage', 'magicdamage'], ['dano mágico', 'magicdamage'],
  ['physical damage', 'physicaldamage'], ['dano físico', 'physicaldamage'],
  ['true damage', 'truedamage'], ['dano verdadeiro', 'truedamage'],
  ['adaptive force', 'adaptivedamage'], ['força adaptativa', 'adaptivedamage'],
  ['ability power', 'scaleap'], ['poder de habilidade', 'scaleap'],
  ['attack damage', 'scalead'], ['dano de ataque', 'scalead'],
  ['ability haste', 'attentionhaste'], ['aceleração de habilidade', 'attentionhaste'],
  ['movement speed', 'attentionspeed'], ['velocidade de movimento', 'attentionspeed'],
  ['attack speed', 'attentionas'], ['velocidade de ataque', 'attentionas'],
  ['magic resist', 'scalemr'], ['resistência mágica', 'scalemr'],
  ['maximum health', 'scalehealth'], ['max health', 'scalehealth'], ['vida máxima', 'scalehealth'],
  ['health', 'scalehealth'], ['vida', 'scalehealth'],
  ['armor', 'scalearmor'], ['armadura', 'scalearmor'],
  ['healing', 'healing'], ['heal', 'healing'], ['cura', 'healing'],
  ['shields', 'attentionshield'], ['shield', 'attentionshield'], ['escudos', 'attentionshield'], ['escudo', 'attentionshield'],
  ['gold', 'attentiongold'], ['ouro', 'attentiongold'],
  ['mana', 'scalemana'],
]

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const TERM_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(${[...TERMS].sort((a, b) => b[0].length - a[0].length).map(([term]) => escape(term)).join('|')})(?![\\p{L}\\p{N}])`,
  'giu',
)
const TAG_OF = new Map(TERMS.map(([term, tag]) => [term, tag]))

/** A value as a rune text writes it: `3.5`, `8%`, `1.8-4`, `5s`, `40 %`. */
const NUMBER_RE = /(?<![\p{L}\p{N}.])\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+(?:[.,]\d+)?)?(?:\s?%|s\b)?/gu

export function highlightRuneHtml(html: string): string {
  // The footnote (`<rules>`, the ranged-champion remark) is a block of its own in the shared renderer: a coloured
  // span inside it would break the line, so it stays in its italic grey.
  let inRules = false
  return html
    .split(/(<[^>]*>)/)
    .map((part) => {
      if (/^<rules[\s>]/i.test(part)) inRules = true
      else if (/^<\/rules>/i.test(part)) inRules = false
      if (inRules || part.startsWith('<') || part.trim() === '') return part
      return part
        .replace(NUMBER_RE, value => `<attention>${value}</attention>`)
        .replace(TERM_RE, (term) => {
          const tag = TAG_OF.get(term.toLowerCase()) ?? 'keywordmajor'
          return `<${tag}>${term}</${tag}>`
        })
    })
    .join('')
}
