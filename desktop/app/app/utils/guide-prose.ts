import type { GuideRefKind } from '~/utils/mobafire'

/**
 * A chapter's sanitized HTML (`sanitizeGuideHtml`) as a tree the chapter
 * draws itself (`GuidesChapter`), rather than handing it to `v-html`: so an
 * inline reference to the game (`span.guide-ref`) can be the app's own
 * component — its icon, its name in the player's language, its tooltip — in
 * the middle of the author's sentence. Only what the sanitizer lets through
 * is read: its tags, and of their attributes the few it writes.
 */

export interface GuideRef {
  kind: GuideRefKind
  /** The English name, as the site gave it. */
  name: string
  /** The site's picture of it, drawn while the app's is unknown. */
  image: string | null
  /** Whether the author's text showed the name beside the picture; else the picture alone. */
  named: boolean
}

export interface ProseElement {
  tag: string
  attrs: Record<string, string>
  children: ProseNode[]
}

export type ProseNode = string | ProseElement | { ref: GuideRef }

/** The tags the sanitizer keeps, and so the only ones drawn; anything else gives its content alone. */
const TAGS = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'h2', 'h3', 'h4', 'h5', 'ul', 'ol', 'li', 'blockquote', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'img'])
/** The attributes the sanitizer writes, and so the only ones read back. */
const ATTRIBUTES = new Set(['class', 'style', 'src', 'alt', 'loading', 'colspan', 'data-video'])
const REF_KINDS = new Set<string>(['item', 'champion', 'ability', 'rune', 'spell'])

function nodesOf(parent: Node): ProseNode[] {
  const nodes: ProseNode[] = []
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const value = child.textContent ?? ''
      if (value) nodes.push(value)
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const element = child as Element
    const tag = element.tagName.toLowerCase()
    if (tag === 'span' && element.classList.contains('guide-ref')) {
      const kind = element.getAttribute('data-kind') ?? ''
      const name = element.getAttribute('data-name') ?? ''
      if (REF_KINDS.has(kind) && name) nodes.push({ ref: { kind: kind as GuideRefKind, name, image: element.getAttribute('data-image'), named: element.getAttribute('data-text') === '1' } })
      continue
    }
    if (!TAGS.has(tag)) {
      nodes.push(...nodesOf(element))
      continue
    }
    const attrs: Record<string, string> = {}
    for (const attribute of Array.from(element.attributes)) {
      if (ATTRIBUTES.has(attribute.name)) attrs[attribute.name] = attribute.value
    }
    // A picture from the sanitizer is always an https address; anything else is not drawn.
    if (tag === 'img' && !attrs.src?.startsWith('https://')) continue
    nodes.push({ tag, attrs, children: nodesOf(element) })
  }
  return nodes
}

/** `html`, already sanitized, as a tree of its elements, texts and references. */
export function proseTree(html: string): ProseNode[] {
  return nodesOf(new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body)
}
