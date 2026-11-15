/**
 * MOBAFire's build guides (mobafire.com), read from its pages: the guide list
 * (`league-of-legends/build[/<champion>][/<lane>]?sort&author&category&page`)
 * and one guide (`league-of-legends/build/<slug>-<id>`). The site has no API —
 * its pages are drawn on its server — so each is parsed here from the HTML the
 * shell reads in its MOBAFire window (`src-tauri/src/mobafire.rs`). Every
 * address and picture is made absolute on mobafire.com, whose pictures load
 * as they are; a guide's chapters are its author's writing and are kept to an
 * allow-list (`sanitizeGuideHtml`).
 */

export const MOBAFIRE = 'https://www.mobafire.com'

export const GUIDE_ROLES = ['top', 'jungle', 'middle', 'adc', 'support'] as const
export type GuideRole = typeof GUIDE_ROLES[number]

export const GUIDE_CATEGORIES = ['champion', 'off-meta', 'general', 'tft', 'arena'] as const
export type GuideCategory = typeof GUIDE_CATEGORIES[number]

export const GUIDE_SORTS = ['updated', 'top', 'newest'] as const
export type GuideSort = typeof GUIDE_SORTS[number]

/** The list's filters, as the site's own form sends them. */
export interface GuideFilters {
  /** The champion's word in MOBAFire's addresses (`khazix`, `nunu-amp-willump`). */
  champion: string | null
  role: GuideRole | null
  category: GuideCategory | null
  sort: GuideSort
  /** Ranked authors only (the site's `author=verified`). */
  ranked: boolean
  page: number
}

export const DEFAULT_FILTERS: GuideFilters = { champion: null, role: null, category: null, sort: 'updated', ranked: false, page: 1 }

export interface GuideSummary {
  /** The guide's page, `league-of-legends/build/<slug>-<id>`. */
  path: string
  /** `<slug>-<id>`, the app's route to it. */
  slug: string
  title: string
  champion: string | null
  /** The champion's picture the author chose (a skin). */
  avatar: string | null
  role: GuideRole | null
  /** The site's rating out of 10, null before it has one. */
  score: number | null
  /** Rated this season: the site greys the others out. */
  current: boolean
  votesUp: number
  votesDown: number
  author: string
  /** Last update, epoch milliseconds. */
  updatedAt: number | null
  tags: string[]
  /** The author's rank (`grandmaster`), when the site shows it. */
  rank: string | null
}

export interface GuideSection {
  /** The list's divider above them (`2026, Season 3 Guides // Patch 26.22`); null before any. */
  label: string | null
  guides: GuideSummary[]
}

export interface TrendingGuide {
  slug: string
  title: string
  image: string | null
  author: string
  views: string
  votes: string
}

export interface GuideChampion {
  slug: string
  name: string
  image: string | null
  aliases: string[]
}

export interface GuideList {
  sections: GuideSection[]
  page: number
  pages: number
  trending: TrendingGuide[]
  champions: GuideChampion[]
}

export interface GuideIcon {
  name: string
  image: string | null
}

export interface GuideRunePage {
  title: string
  notes: string | null
  primary: { tree: string, runes: GuideIcon[] }
  secondary: { tree: string, runes: GuideIcon[] }
  shards: GuideIcon[]
  /** The shards' bonuses as the site words them (`+9 Adaptive (5.4 AD or 9 AP)`). */
  bonuses: string[]
}

export interface GuideSpellSet {
  title: string
  notes: string | null
  spells: GuideIcon[]
}

export interface GuideItemSection {
  title: string
  notes: string | null
  items: GuideIcon[]
}

export interface GuideAbility {
  /** `P` for the passive, else the key. */
  key: string
  name: string
  image: string | null
  /** The levels the ability is ranked at, 1 to 18. */
  levels: number[]
}

export interface GuideMatchup {
  champion: string
  image: string | null
  /** 1 (extreme threat, ideal synergy) to 5 (tiny). */
  level: number
  label: string
  note: string
}

export interface GuideBuild {
  recommended: GuideIcon[]
  runes: GuideRunePage[]
  spells: GuideSpellSet[]
  items: GuideItemSection[]
  abilities: { title: string | null, notes: string | null, rows: GuideAbility[] } | null
}

export interface GuideChapter {
  title: string
  html: string
}

export interface Guide {
  path: string
  slug: string
  title: string
  champion: string | null
  role: GuideRole | null
  banner: string | null
  updatedAt: number | null
  score: number | null
  current: boolean
  votesUp: number
  votesDown: number
  rank: string | null
  author: { name: string, avatar: string | null }
  views: string | null
  comments: number | null
  builds: GuideBuild[]
  threats: GuideMatchup[]
  synergies: GuideMatchup[]
  chapters: GuideChapter[]
}

/** The list's address for `filters`, as the site writes it after its form redirects. */
export function listPath(filters: GuideFilters): string {
  const words = [filters.champion, filters.role].filter((word): word is string => !!word)
  const query = new URLSearchParams()
  if (filters.sort !== 'updated') query.set('sort', filters.sort)
  if (filters.category) query.set('category', filters.category)
  if (filters.ranked) query.set('author', 'verified')
  if (filters.page > 1) query.set('page', String(filters.page))
  const search = query.toString()
  return `league-of-legends/build${words.map(word => `/${word}`).join('')}${search ? `?${search}` : ''}`
}

/** A guide's page from its slug; null for anything that is not one. */
export function guidePath(slug: string): string | null {
  return /^[a-z0-9-]+-\d+$/.test(slug) ? `league-of-legends/build/${slug}` : null
}

/** The page MOBAFire shows instead of its own when Cloudflare refuses or checks the visit. */
export function isBlockedPage(html: string): boolean {
  return /<title>\s*(Attention Required!|Just a moment|Um momento)/i.test(html)
}

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html')

const text = (node: Element | null | undefined) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()

const count = (value: string) => Number(value.replace(/[^\d]/g, '')) || 0

/** An address of the site's made absolute; null for anything but http(s). */
export function absolute(src: string | null | undefined): string | null {
  if (!src) return null
  try {
    const url = new URL(src, MOBAFIRE)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString().replace(/^http:/, 'https:') : null
  }
  catch {
    return null
  }
}

/** A picture's address: the site loads most of them late, from `data-original`, and puts a spacer in `src` until then. */
function imageOf(image: Element | null | undefined): string | null {
  if (!image) return null
  const late = image.getAttribute('data-original')
  const src = image.getAttribute('src')
  return absolute(late || (src && !src.includes('spacer') ? src : null))
}

/** The lane a lane icon's file names (`/images/lanes/white-jungle.png`). */
function roleOf(src: string | null | undefined): GuideRole | null {
  const word = src?.match(/lanes\/(?:white-|blue-)?(top|jungle|middle|mid|bottom|adc|support)\b/)?.[1]
  if (!word) return null
  if (word === 'bottom') return 'adc'
  if (word === 'mid') return 'middle'
  return word as GuideRole
}

/** The role a listing's picture is marked with (`role-jungle`). */
function roleFromClass(element: Element | null): GuideRole | null {
  const word = element?.className.match(/\brole-([a-z]+)\b/)?.[1]
  return word && (GUIDE_ROLES as readonly string[]).includes(word) ? word as GuideRole : roleOf(`lanes/${word}`)
}

const slugOf = (href: string | null) => href?.match(/\/league-of-legends\/build\/([a-z0-9-]+-\d+)/)?.[1] ?? null

const timeOf = (element: Element | null) => {
  const seconds = Number(element?.getAttribute('data-timestamp'))
  return seconds > 0 ? seconds * 1000 : null
}

/** The rating ring: its score, and whether it is this season's (`--live`). */
function ratingOf(root: Element | null) {
  const circle = root?.querySelector('.mf-listings__item__rating__circle') ?? null
  const shown = text(circle?.querySelector('span'))
  const info = root?.querySelector('.mf-listings__item__rating__info')
  return {
    score: shown !== '' && Number.isFinite(Number(shown)) ? Number(shown) : null,
    current: !!circle?.className.includes('--live'),
    votesUp: count(text(info?.querySelector('.icon-thumbs-up')?.parentElement)),
    votesDown: count(text(info?.querySelector('.icon-thumbs-down')?.parentElement)),
  }
}

function summaryOf(row: Element): GuideSummary | null {
  const href = row.getAttribute('href')
  const slug = slugOf(href)
  if (!slug) return null
  const picture = row.querySelector('.mf-listings__item__pic--large')
  const image = picture?.querySelector('img') ?? null
  return {
    path: `league-of-legends/build/${slug}`,
    slug,
    title: text(row.querySelector('.mf-listings__item__info__title')),
    champion: image?.getAttribute('title') || null,
    avatar: imageOf(image),
    role: roleFromClass(picture ?? null) ?? roleOf(row.querySelector('.mf-listings__item__info__title img')?.getAttribute('src')),
    ...ratingOf(row.querySelector('.mf-listings__item__rating')),
    author: text(row.querySelector('.mf-listings__item__info__meta .user-level')),
    updatedAt: timeOf(row.querySelector('.localized-datetime')),
    tags: [...row.querySelectorAll('.mf-listings__item__info__tags li')].map(tag => text(tag)).filter(Boolean),
    rank: row.className.match(/\bplayer-([a-z]+)\b/)?.[1] ?? null,
  }
}

/** The guide list: its sections under their dividers, its pages, the trending guides, and the site's champions. */
export function parseGuideList(html: string): GuideList {
  const doc = parse(html)
  const sections: GuideSection[] = []
  for (const child of doc.querySelector('.mf-listings')?.children ?? []) {
    if (child.classList.contains('mf-listings__divider')) {
      sections.push({ label: text(child).replace(/\s*\/\/\s*/, ' · '), guides: [] })
      continue
    }
    if (!child.classList.contains('mf-listings__item')) continue
    const guide = summaryOf(child)
    if (!guide) continue
    if (!sections.length) sections.push({ label: null, guides: [] })
    sections.at(-1)!.guides.push(guide)
  }
  const pager = [...doc.querySelectorAll('.browse-pager__pages a')]
  const page = Number(text(doc.querySelector('.browse-pager__pages .current'))) || 1
  const pages = Math.max(page, ...pager.map(link => Number(text(link)) || 0))
  const trending = [...doc.querySelectorAll('#trending-guides .sidebar-module__list__item')].flatMap((item): TrendingGuide[] => {
    const slug = slugOf(item.getAttribute('href'))
    if (!slug) return []
    return [{
      slug,
      title: text(item.querySelector('h4')),
      image: imageOf(item.querySelector('.sidebar-module__list__item__pic img')),
      author: text(item.querySelector('.user-level')),
      views: text(item.querySelector('p b')),
      votes: text(item.querySelector('.percentage')),
    }]
  })
  const champions = [...doc.querySelectorAll('[data-link^="/league-of-legends/build/"]')].flatMap((entry): GuideChampion[] => {
    const slug = entry.getAttribute('data-link')?.match(/\/league-of-legends\/build\/([a-z0-9-]+)/)?.[1]
    const name = text(entry.querySelector('span'))
    if (!slug || !name) return []
    let aliases: string[] = []
    try {
      const parsed: unknown = JSON.parse(entry.getAttribute('data-aliases') ?? '[]')
      if (Array.isArray(parsed)) aliases = parsed.filter((alias): alias is string => typeof alias === 'string')
    }
    catch {
      // An unreadable alias list leaves the name alone to match.
    }
    return [{ slug, name, image: imageOf(entry.querySelector('img')), aliases }]
  })
  return { sections, page, pages, trending, champions: [...new Map(champions.map(champion => [champion.slug, champion])).values()] }
}

/** A tooltip's text: the site keeps an author's notes in the `title` of its notes icon. */
const notesOf = (root: Element | null) => root?.querySelector('.view-guide__build__notes, .tooltip[title]')?.getAttribute('title')?.trim() || null

/** An item, a rune or a spell: its name beside its picture. */
function iconOf(element: Element): GuideIcon {
  return { name: text(element.querySelector('span, h4')), image: imageOf(element.querySelector('img')) }
}

function runePageOf(block: Element, title: string): GuideRunePage {
  const tree = (selector: string) => {
    const row = block.querySelector(selector)
    // The first circle is the tree's own emblem, named by its title above it.
    const runes = [...row?.querySelectorAll('.new-runes__item') ?? []].slice(1).map(iconOf).filter(rune => rune.name)
    return { tree: row?.getAttribute('path') ?? '', runes }
  }
  const shards = [...block.querySelectorAll('.new-runes__shards img')].map((image) => {
    const src = imageOf(image)
    return { name: src?.match(/\/shards\/([a-z-]+)\.png/)?.[1]?.replace(/-/g, ' ') ?? '', image: src }
  })
  const bonuses = (block.querySelector('.new-runes__bonuses p')?.innerHTML ?? '')
    .split(/<br\s*\/?>/i)
    .map(line => line.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return { title, notes: notesOf(block), primary: tree('.new-runes__primary'), secondary: tree('.new-runes__secondary'), shards, bonuses }
}

/** One switcher's titles, in order (`PTA / Bruiser Runes`, `Lethal / BRUISER OR CRIT`…). */
const switcherTitles = (section: Element | null) => [...section?.querySelectorAll('.view-guide__build__switcher span') ?? []].map(span => (span.getAttribute('title') ?? '').trim())

function buildOf(root: Element): GuideBuild {
  const runesSection = root.querySelector('.view-guide__build__runes')
  const runeTitles = switcherTitles(runesSection)
  const runeTitle = text(runesSection?.querySelector('h3 span'))
  const runes = [...runesSection?.querySelectorAll('.new-runes') ?? []].map((block, index) => runePageOf(block, runeTitles[index] || (index === 0 ? runeTitle : '')))
  const spellsSection = root.querySelector('.view-guide__build__spells')
  const spells = [...spellsSection?.querySelectorAll('.view-guide__spells') ?? []].map(block => ({
    title: text(block.querySelector(':scope > span')),
    notes: notesOf(block),
    spells: [...block.querySelectorAll('.view-guide__spells__row')].map(iconOf),
  }))
  const items = [...root.querySelectorAll('.view-guide__build__items .view-guide__items')].map(block => ({
    title: text(block.querySelector('.view-guide__items__bar > span')),
    notes: block.querySelector('.view-guide__items__bar .tooltip[title]')?.getAttribute('title')?.trim() || null,
    items: [...block.querySelectorAll('.view-guide__items__content > span')].map(iconOf).filter(item => item.name),
  }))
  const abilitySection = root.querySelector('.view-guide__build__abilities')
  const rows = [...abilitySection?.querySelectorAll('.champ-build__abilities__row') ?? []].map((row): GuideAbility => {
    const heading = row.querySelector('h4')
    const keyText = text(heading?.querySelector('span'))
    const passive = row.className.includes('--passive')
    const key = passive ? 'P' : keyText.match(/\(([QWER])\)/)?.[1] ?? ''
    const name = text(heading).replace(keyText, '').trim()
    const levels = [...row.querySelectorAll('li.lit')].map(level => Number(level.getAttribute('level'))).filter(level => level > 0)
    return { key, name, image: imageOf(row.querySelector('img')), levels }
  })
  return {
    recommended: [...root.querySelectorAll('.view-guide__build__core__inner > span')].map(iconOf).filter(item => item.name),
    runes,
    spells,
    items,
    abilities: rows.length ? { title: text(abilitySection?.querySelector('h3 span')) || null, notes: notesOf(abilitySection), rows } : null,
  }
}

function matchupsOf(side: Element | null): GuideMatchup[] {
  return [...side?.querySelectorAll('.row') ?? []].flatMap((row): GuideMatchup[] => {
    const champion = text(row.querySelector('h4'))
    if (!champion) return []
    const note = (row.querySelector('p')?.innerHTML ?? '')
      .split(/<br\s*\/?>/i)
      .map(line => new DOMParser().parseFromString(line, 'text/html').body.textContent?.trim() ?? '')
      .filter(Boolean)
      .join('\n')
    return [{ champion, image: imageOf(row.querySelector('.row__image img')), level: Number(row.getAttribute('level')) || 3, label: text(row.querySelector('label')), note }]
  })
}

/** One guide: its banner, each of its builds, its threats and synergies, and its chapters. */
export function parseGuide(html: string, slug: string): Guide {
  const doc = parse(html)
  const banner = doc.querySelector('.view-guide__banner')
  const heading = doc.querySelector('.view-guide__banner__title.tablet-up') ?? doc.querySelector('.view-guide__banner__title')
  const meta = [...doc.querySelectorAll('.view-guide__banner__meta--big > span')]
  const metaOf = (icon: string) => meta.find(span => span.querySelector(`img[src*="${icon}"]`))
  const viewsText = text(metaOf('views')).replace(/\s*Views?$/i, '')
  const comments = metaOf('comments')
  const authorLink = doc.querySelector('.view-guide__banner__author a')
  const champion = (doc.title.split(' Build Guide')[0] ?? '').trim() || null
  const builds = [...doc.querySelectorAll('.view-guide__build')].map(buildOf).filter(build => build.recommended.length || build.runes.length || build.items.length)
  return {
    path: `league-of-legends/build/${slug}`,
    slug,
    title: text(heading?.querySelector('span') ?? heading),
    champion,
    role: roleOf(heading?.querySelector('img')?.getAttribute('src')),
    banner: absolute(banner?.getAttribute('style')?.match(/url\(([^)]+)\)/)?.[1]?.replace(/['"]/g, '')),
    updatedAt: timeOf(doc.querySelector('.view-guide__banner__date .localized-datetime')),
    ...ratingOf(doc.querySelector('.view-guide__banner__ranking')),
    rank: text(doc.querySelector('.view-guide__banner__slash__elo__bar')).toLowerCase() || null,
    author: { name: text(authorLink), avatar: imageOf(doc.querySelector('.view-guide__banner__author img')) },
    views: viewsText || null,
    comments: comments ? count(text(comments)) : null,
    builds,
    threats: matchupsOf(doc.querySelector('.view-guide__tS__bot__left')),
    synergies: matchupsOf(doc.querySelector('.view-guide__tS__bot__right')),
    chapters: [...doc.querySelectorAll('.view-guide__chapter')].map(chapter => ({
      title: text(chapter.querySelector('.view-guide__chapter__top span')),
      html: sanitizeGuideHtml(chapter.querySelector('.view-guide__chapter__content')?.innerHTML ?? ''),
    })).filter(chapter => chapter.title || chapter.html),
  }
}

/** What an author's chapter keeps: its writing and its pictures, nothing that runs, loads a frame or styles the page. */
const KEPT_TAGS = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'h2', 'h3', 'h4', 'h5', 'ul', 'ol', 'li', 'blockquote', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'center'])
const DROPPED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'link', 'meta', 'noscript', 'svg', 'video', 'audio'])
/** A colour the author gave their words (`color:#ff0000`), the one style kept. */
const COLOR = /(?:^|;)\s*color\s*:\s*(#[0-9a-f]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|[a-z]+)\s*(?:;|$)/i

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
      const src = imageOf(element)
      if (src?.startsWith('https://')) {
        const image = doc.createElement('img')
        image.setAttribute('src', src)
        image.setAttribute('alt', element.getAttribute('alt') ?? '')
        image.setAttribute('loading', 'lazy')
        // The site's own icons inline in the text (an item, a rune, a champion) stay icon-sized.
        if (/mobafire\.com\/images\/(?:item|reforged-rune|champion\/square|ability|summoner-spell|shards)\//.test(src)) image.setAttribute('class', 'guide-icon')
        into.appendChild(image)
      }
      continue
    }
    if (!KEPT_TAGS.has(tag)) {
      clean(element, into, doc)
      continue
    }
    const copy = doc.createElement(tag === 'center' ? 'div' : tag)
    if (tag === 'center' || (element.getAttribute('class') ?? '').includes('bbcode_center')) copy.setAttribute('class', 'guide-center')
    const color = element.getAttribute('style')?.match(COLOR)?.[1]
    if (color && (tag === 'span' || tag === 'div')) copy.setAttribute('style', `color:${color}`)
    if ((tag === 'td' || tag === 'th') && element.getAttribute('colspan')) copy.setAttribute('colspan', String(Number(element.getAttribute('colspan')) || 1))
    clean(element, copy, doc)
    into.appendChild(copy)
  }
}

export function sanitizeGuideHtml(html: string): string {
  const doc = parse(`<body>${html}</body>`)
  const out = doc.createElement('div')
  clean(doc.body, out, doc)
  return out.innerHTML
}
