/**
 * Riot's patch notes, read from the JSON their pages embed (`__NEXT_DATA__`,
 * fetched by the shell — `src-tauri/src/news.rs`). Two shapes: the list of
 * patches (the tag page's article grid) and one patch's note, whose body is an
 * HTML string. That body is Riot's, not ours: it goes through an allow-list
 * before it is rendered — a handful of tags, no attribute but a few classes
 * and the image address, no link — so nothing in it can run or load from
 * somewhere the app's CSP does not already name.
 */
export interface PatchSummary {
  /** `26.21`. */
  version: string
  title: string
  description: string
  publishedAt: string
  imageUrl: string | null
  /** The note's path on the site, as the list gives it. */
  path: string
}

export interface PatchBlock {
  id: string
  /** The champion or item the block is about; empty for a block that names none. */
  title: string
  iconUrl: string | null
  /** The block's changes, sanitised. */
  html: string
  /** Carries one of Riot's own pictures (a summary graphic, the skins), or is prose that names no champion (mid-patch notes, system changes): it takes the whole row, not a column. */
  wide: boolean
}

export interface PatchSection {
  id: string
  title: string
  blocks: PatchBlock[]
}

export interface PatchNote {
  /** Riot's introduction, sanitised. */
  intro: string
  sections: PatchSection[]
}

const IMAGE_HOSTS = new Set(['ddragon.leagueoflegends.com', 'cmsassets.rgpub.io', 'raw.communitydragon.org'])
const KEPT_CLASSES = new Set(['change-detail-title', 'ability-title', 'blockquote', 'context', 'gs-container', 'skin-box', 'skin-title', 'note-icon', 'note-art'])
const KEPT_TAGS = new Set(['p', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'br', 'h2', 'h3', 'h4', 'span', 'div', 'blockquote', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'])
const DROPPED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'svg', 'link', 'meta', 'hr'])

interface NextDataBlade { type?: string, items?: unknown[], richText?: { body?: string } }

/** The page's blades; a page that is not the JSON this expects has none. */
function bladesOf(nextData: string): NextDataBlade[] {
  try {
    const parsed = JSON.parse(nextData) as { props?: { pageProps?: { page?: { blades?: NextDataBlade[] } } } }
    return parsed.props?.pageProps?.page?.blades ?? []
  }
  catch {
    return []
  }
}

/** Riot's descriptions are plain text or an `{ type: 'html', body }` object; the card shows text. */
function plainText(value: string | undefined): string {
  return (value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** `.../patch-26-21-notes` → `26.21`; null for a page that is not a patch's. */
export function patchVersion(path: string): string | null {
  const match = path.match(/patch-(\d+)-(\d+)(?:-notes)?(?:\/|$)/)
  return match ? `${match[1]}.${match[2]}` : null
}

/** Newest first; a malformed list is an empty one. */
export function parsePatchList(nextData: string): PatchSummary[] {
  const items = bladesOf(nextData).find(blade => blade.type === 'articleCardGrid')?.items ?? []
  const seen = new Set<string>()
  const list: PatchSummary[] = []
  for (const raw of items) {
    const item = raw as { title?: string, description?: string | { body?: string }, publishedAt?: string, media?: { url?: string }, action?: { payload?: { url?: string } } }
    const path = item.action?.payload?.url ?? ''
    const version = patchVersion(path)
    if (!version || !path.includes('/game-updates/') || seen.has(version)) continue
    seen.add(version)
    list.push({
      version,
      title: item.title ?? version,
      description: plainText(typeof item.description === 'string' ? item.description : item.description?.body),
      publishedAt: item.publishedAt ?? '',
      imageUrl: item.media?.url ?? null,
      path,
    })
  }
  const order = (version: string) => version.split('.').map(Number)
  return list.sort((a, b) => {
    const [aMajor = 0, aMinor = 0] = order(a.version)
    const [bMajor = 0, bMinor = 0] = order(b.version)
    return bMajor - aMajor || bMinor - aMinor
  })
}

/** An image address the app may load: Data Dragon's own, or the one Riot's CDN wraps it in. */
export function safeImage(src: string | null | undefined): string | null {
  if (!src) return null
  try {
    let url = new URL(src)
    const inner = url.hostname === 'am-a.akamaihd.net' ? url.searchParams.get('f') : null
    if (inner) url = new URL(inner)
    return url.protocol === 'https:' && IMAGE_HOSTS.has(url.hostname) ? url.toString() : null
  }
  catch {
    return null
  }
}

/** Riot's CDN names a picture by its size (`…-143x148.png`); anything up to this wide is an icon, past it a picture to look at. */
const ICON_MAX_WIDTH = 600

/** An item or ability icon, as opposed to art: Data Dragon's own, or a small one of Riot's. */
export function isIcon(src: string): boolean {
  if (src.includes('ddragon.leagueoflegends.com')) return true
  const width = src.match(/-(\d+)x\d+\.\w+(?:\?|$)/)?.[1]
  return width !== undefined && Number(width) <= ICON_MAX_WIDTH
}

/** Rebuilds `node` keeping only what the allow-list names. */
function clean(node: Node, into: Node, doc: Document) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      into.appendChild(doc.createTextNode(child.textContent ?? ''))
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const element = child as Element
    const tag = element.tagName.toLowerCase()
    if (DROPPED_TAGS.has(tag)) continue
    if (tag === 'img') {
      const src = safeImage(element.getAttribute('src'))
      if (src) {
        const image = doc.createElement('img')
        image.setAttribute('src', src)
        image.setAttribute('class', isIcon(src) ? 'note-icon' : 'note-art')
        image.setAttribute('alt', element.getAttribute('alt') ?? '')
        image.setAttribute('loading', 'lazy')
        into.appendChild(image)
      }
      continue
    }
    if (!KEPT_TAGS.has(tag)) {
      clean(element, into, doc)
      continue
    }
    const copy = doc.createElement(tag)
    const classes = (element.getAttribute('class') ?? '').split(/\s+/).filter(name => KEPT_CLASSES.has(name))
    if (classes.length) copy.setAttribute('class', classes.join(' '))
    clean(element, copy, doc)
    into.appendChild(copy)
  }
}

export function sanitizeNoteHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const out = doc.createElement('div')
  clean(doc.body, out, doc)
  return out.innerHTML
}

/** Prose is read at full width: a block with a picture of Riot's, or long text that is no champion's card. */
const PROSE_LENGTH = 250

function isWide(html: string, icon: string | null): boolean {
  if (html.includes('class="note-art"')) return true
  return !icon && html.replace(/<[^>]+>/g, '').length > PROSE_LENGTH
}

const slug = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** One patch's note, split into its sections and, in each, the blocks (one champion, item or system each). */
export function parsePatchNote(nextData: string): PatchNote {
  const body = bladesOf(nextData).find(blade => blade.type === 'patchNotesRichText')?.richText?.body ?? ''
  const doc = new DOMParser().parseFromString(`<body>${body}</body>`, 'text/html')
  const root = doc.querySelector('#patch-notes-container') ?? doc.body

  const sections: PatchSection[] = []
  let intro = ''
  const section = (title: string) => {
    const created = { id: slug(title) || `section-${sections.length}`, title, blocks: [] as PatchBlock[] }
    sections.push(created)
    return created
  }

  for (const child of Array.from(root.children)) {
    if (child.matches('blockquote') && !intro && sections.length === 0) {
      intro = sanitizeNoteHtml(child.innerHTML)
    }
    else if (child.matches('header')) {
      section(child.querySelector('h2')?.textContent?.trim() ?? '')
    }
    else if (child.classList.contains('content-border')) {
      const current = sections.at(-1) ?? section('')
      const copy = child.cloneNode(true) as Element
      const heading = copy.querySelector('h3')
      const title = heading?.textContent?.trim() ?? ''
      const icon = safeImage(copy.querySelector('a.reference-link img')?.getAttribute('src'))
      copy.querySelector('a.reference-link')?.closest('p')?.remove()
      heading?.remove()
      const html = sanitizeNoteHtml(copy.innerHTML)
      if (html.trim()) current.blocks.push({ id: `${current.id}-${slug(title) || current.blocks.length}`, title, iconUrl: icon, html, wide: isWide(html, icon) })
    }
  }
  return { intro, sections: sections.filter(entry => entry.blocks.length > 0) }
}

/** Whether a change helps the champion or item (`buff`), hurts it (`nerf`), or both, line by line (`adjust`). */
export type ChangeKind = 'buff' | 'nerf' | 'adjust'

/** What reads better lower — a cooldown, a cost, a cast time —: a smaller number there is a buff. */
const LOWER_IS_BETTER = /recarga|cooldown|custo|cost\b|tempo de conjura|cast time|atraso|delay|recharge|penalidade|penalty|tempo de canaliza|channel time/i

/**
 * A side's values, group by group: a run of ranks (`50/75/100`), a range
 * (`85 - 277`) or a lone number (`(+ 60% do PdH)`, `5s`) is one group, read
 * as its mean. Decimal commas are points (`87,5`); a point before three
 * digits is a thousands separator (`3.800`).
 */
function groupsOf(text: string): number[] {
  const number = (value: string) => Number(value.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
  return (text.match(/\d+(?:[.,]\d+)*(?:\s*[/-]\s*\d+(?:[.,]\d+)*)*/g) ?? []).map((group) => {
    const values = group.split(/\s*[/-]\s*/).map(number).filter(value => Number.isFinite(value))
    return values.reduce((total, value) => total + value, 0) / (values.length || 1)
  })
}

/**
 * One line of a note, `Label: before ⇒ after`, read as a buff or a nerf: each
 * group of values after against the one before it — the sides lined up from
 * their ends, since Riot leaves out what did not change (`120/200/280
 * (+ 35% AP) ⇒ (+ 40% AP)`) —, their relative changes added up, the sense
 * turned for what reads better lower. Null for a line that changes no number
 * (a rewrite, a removal).
 */
export function lineChange(text: string): Exclude<ChangeKind, 'adjust'> | null {
  const [before, after] = text.split('⇒')
  if (before === undefined || after === undefined) return null
  const label = before.includes(':') ? before.slice(0, before.indexOf(':')) : ''
  const from = groupsOf(before.slice(label.length))
  const to = groupsOf(after)
  if (!from.length || !to.length) return null
  const length = Math.min(from.length, to.length)
  let change = 0
  for (let index = 1; index <= length; index++) {
    const a = from[from.length - index]!
    const b = to[to.length - index]!
    change += a === 0 ? Math.sign(b) : (b - a) / Math.abs(a)
  }
  if (Math.abs(change) < 1e-9) return null
  const up = LOWER_IS_BETTER.test(label) ? change < 0 : change > 0
  return up ? 'buff' : 'nerf'
}

/** A card's changes taken together: only buffs, only nerfs, or some of each; null when no line moves a number. */
export function blockChange(html: string): ChangeKind | null {
  let buffs = 0
  let nerfs = 0
  for (const match of html.matchAll(/<(?:li|p)\b[^>]*>([\s\S]*?)<\/(?:li|p)>/g)) {
    const kind = lineChange(match[1]!.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' '))
    if (kind === 'buff') buffs++
    if (kind === 'nerf') nerfs++
  }
  if (!buffs && !nerfs) return null
  return buffs && nerfs ? 'adjust' : buffs ? 'buff' : 'nerf'
}

/** The card's html with each line marked buff or nerf (`change-buff`, `change-nerf`), for the view to colour. */
export function markChanges(html: string): string {
  return html.replace(/<(li|p)\b([^>]*)>([\s\S]*?)<\/\1>/g, (whole, tag: string, attributes: string, inner: string) => {
    const kind = lineChange(inner.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' '))
    return kind ? `<${tag}${attributes} class="change-${kind}">${inner}</${tag}>` : whole
  })
}
