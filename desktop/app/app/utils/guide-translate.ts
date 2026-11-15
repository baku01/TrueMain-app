import type { Guide, GuideList } from '~/utils/mobafire'
import { sanitizeGuideHtml } from '~/utils/mobafire'
import { translateTexts } from '~/utils/translate'

/** The most of a chapter one piece carries (`htmlPieces`). */
const PIECE_CHARS = 4000

/**
 * A chapter's HTML cut between its top-level nodes into pieces of at most
 * `limit` characters — never inside a tag, so each translates as whole HTML;
 * a node longer than the limit is a piece of its own.
 */
export function htmlPieces(html: string, limit = PIECE_CHARS): string[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const pieces: string[] = []
  let current = ''
  for (const node of Array.from(doc.body.childNodes)) {
    const holder = doc.createElement('div')
    holder.appendChild(node.cloneNode(true))
    const part = holder.innerHTML
    if (current && current.length + part.length > limit) {
      pieces.push(current)
      current = ''
    }
    current += part
  }
  if (current) pieces.push(current)
  return pieces
}

/**
 * Every word of a guide its author wrote, in `target`: the title, each
 * build's titles and notes, the matchups' notes, the chapters' titles and
 * writing — the last translated as HTML and sanitized again, as anything
 * shown with `v-html` is. What the game names (items, runes, spells,
 * abilities, champions) is not here: the app draws those from its own data,
 * already in the player's language.
 */
export async function translateGuide(guide: Guide, target: string): Promise<Guide> {
  const texts: string[] = [guide.title]
  for (const build of guide.builds) {
    for (const page of build.runes) texts.push(page.title, page.notes ?? '')
    for (const set of build.spells) texts.push(set.title, set.notes ?? '')
    for (const section of build.items) texts.push(section.title, section.notes ?? '')
    if (build.abilities) texts.push(build.abilities.title ?? '', build.abilities.notes ?? '')
  }
  for (const matchup of [...guide.threats, ...guide.synergies]) texts.push(matchup.note)
  for (const chapter of guide.chapters) texts.push(chapter.title)
  const pieces = guide.chapters.map(chapter => htmlPieces(chapter.html))

  const [plain, html] = await Promise.all([translateTexts(texts, target), translateTexts(pieces.flat(), target, true)])
  let at = 0
  const next = () => plain[at++] ?? ''
  const orNull = (value: string) => value || null
  const title = next()
  const builds = guide.builds.map(build => ({
    ...build,
    runes: build.runes.map(page => ({ ...page, title: next(), notes: orNull(next()) })),
    spells: build.spells.map(set => ({ ...set, title: next(), notes: orNull(next()) })),
    items: build.items.map(section => ({ ...section, title: next(), notes: orNull(next()) })),
    abilities: build.abilities ? { ...build.abilities, title: orNull(next()), notes: orNull(next()) } : null,
  }))
  const threats = guide.threats.map(matchup => ({ ...matchup, note: next() }))
  const synergies = guide.synergies.map(matchup => ({ ...matchup, note: next() }))
  let piece = 0
  const chapters = guide.chapters.map((_, index) => {
    const translated = pieces[index]!.map(() => html[piece++] ?? '').join('')
    return { title: next(), html: sanitizeGuideHtml(translated) }
  })
  return { ...guide, title, builds, threats, synergies, chapters }
}

/** The list's words in `target`: the guides' titles and tags, the dividers, the trending guides' titles. */
export async function translateList(list: GuideList, target: string): Promise<GuideList> {
  const guides = list.sections.flatMap(section => section.guides)
  const texts = [
    ...list.sections.map(section => section.label ?? ''),
    ...guides.flatMap(guide => [guide.title, ...guide.tags]),
    ...list.trending.map(guide => guide.title),
  ]
  const translated = await translateTexts(texts, target)
  let at = 0
  const next = () => translated[at++] ?? ''
  const labels = list.sections.map(() => next())
  const sections = list.sections.map((section, index) => ({
    label: section.label ? labels[index] ?? section.label : null,
    guides: section.guides.map(guide => ({ ...guide, title: next(), tags: guide.tags.map(() => next()) })),
  }))
  const trending = list.trending.map(guide => ({ ...guide, title: next() }))
  return { ...list, sections, trending }
}
