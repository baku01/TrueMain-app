import type { GuideIndex } from '~/utils/guide-entities'
import type { NamedItemBlock } from '~/utils/item-set'
import type { GuideAbility, GuideBuild, GuideIcon, GuideRunePage } from '~/utils/mobafire'
import type { SkillKey } from '~/utils/skill-grid'
import { idOf, nameKey } from '~/utils/guide-entities'

/**
 * A MOBAFire guide's build in the app's terms: its itemization as one item
 * set for the shop, its ability order as the levels' points and the order the
 * basic abilities are maxed in, and what keeps a rune page from importing.
 */

/** The longest block title the shop shows whole (`lcu::item_sets` `MAX_BLOCK_TITLE`). */
const BLOCK_TITLE = 40
/** The most blocks a set carries (`lcu::item_sets` `MAX_BLOCKS`): the last sections give way. */
const MAX_BLOCKS = 16
/** How long the set's own name runs after "TrueMain ", champion and guide together: the shop's list cuts a longer one off. */
const SET_TITLE = 48

/**
 * An author's words as the shop can show them: no emoji (the game's font
 * draws none, a box for each), no doubled spaces, and cut at a word within
 * `max` characters, an ellipsis saying so.
 */
export function shopText(text: string, max: number): string {
  const clean = text.replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u{FE0F}|\u{200D}|\u{20E3}/gu, '').replace(/\s+/g, ' ').trim()
  const chars = [...clean]
  if (chars.length <= max) return clean
  const cut = chars.slice(0, max - 1).join('')
  const space = cut.lastIndexOf(' ')
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:/|·–—-]+$/, '')}…`
}

/** The set's name in the shop, after "TrueMain ": the champion, then the guide (`Briar · {26.22} Rank 1 Briar / All…`). */
export function guideSetTitle(champion: string, guide: string): string {
  return shopText(guide, SET_TITLE) ? shopText(`${champion} · ${guide}`, SET_TITLE) : champion
}

/** The game's ids of a row of a guide's items, each once, in the author's order; an item the index does not know is left out. */
export function guideItemIds(icons: GuideIcon[], index: GuideIndex): number[] {
  return [...new Set(icons.map(icon => idOf(index.items, icon.name, icon.image)).filter((id): id is number => id !== null))]
}

/**
 * The guide's whole itemization as one item set's blocks: its recommended
 * items first, under `recommended`, then each of the author's sections under
 * its own title, in the guide's order — the starting items, the boots, each
 * build the author offers, the situational ones, as they wrote them. A title
 * is kept within the shop's 40 characters; a section with no item the index
 * knows is left out, and past the shop's 16 blocks the last ones give way.
 */
export function guideItemBlocks(build: GuideBuild, index: GuideIndex, titles: { recommended: string, untitled: string }): NamedItemBlock[] {
  return buildBlocks(build, index, titles, '').slice(0, MAX_BLOCKS)
}

/** One build's blocks, every title after `prefix` (`Build 2 — `) and within the shop's 40 characters. */
function buildBlocks(build: GuideBuild, index: GuideIndex, titles: { recommended: string, untitled: string }, prefix: string): NamedItemBlock[] {
  const title = (text: string) => shopText(`${prefix}${shopText(text, BLOCK_TITLE)}`, BLOCK_TITLE)
  return [
    { title: title(titles.recommended), items: guideItemIds(build.recommended, index) },
    ...build.items.map(section => ({ title: title(shopText(section.title, BLOCK_TITLE) || titles.untitled), items: guideItemIds(section.items, index) })),
  ].filter(block => block.items.length > 0)
}

/** What `guideItemSetBlocks` titles its blocks with, in the player's language. */
export interface GuideSetTitles {
  recommended: string
  untitled: string
  /** A build's name before each of its blocks' titles (`Build 2`). */
  build: (number: number) => string
  /** The block a build's last sections are gathered in, past its share of the shop's blocks. */
  more: string
}

/**
 * Every build of a guide in one item set: a guide of several builds (a tank
 * and a lethality one, a jungle and a top one) gives the shop a single set
 * holding them all, each build's blocks in turn under its name (`Build 2 —
 * Core items`) — its recommended items, then each of its sections —, rather
 * than a set per build or only the build on show. A guide of one build is
 * `guideItemBlocks`.
 *
 * The shop's set holds 16 blocks: past them, a block that only repeats one of
 * an earlier build (the same starting items in every build) is left out
 * first; then each build is given an even share of the blocks, the sections
 * past its share gathered into one last block of its own, so no build and no
 * item is lost.
 */
export function guideItemSetBlocks(builds: GuideBuild[], index: GuideIndex, titles: GuideSetTitles): NamedItemBlock[] {
  if (builds.length <= 1) return builds[0] ? guideItemBlocks(builds[0], index, titles) : []
  let groups = builds.map((build, at) => ({ prefix: `${titles.build(at + 1)} — `, blocks: buildBlocks(build, index, titles, `${titles.build(at + 1)} — `) }))
    .filter(group => group.blocks.length > 0)
  const total = () => groups.reduce((sum, group) => sum + group.blocks.length, 0)
  if (total() > MAX_BLOCKS) {
    const seen = new Set<string>()
    const key = (block: NamedItemBlock) => [...block.items].sort((a, b) => a - b).join(',')
    groups = groups.map(group => ({
      ...group,
      blocks: group.blocks.filter((block, at) => {
        const known = seen.has(key(block))
        seen.add(key(block))
        // A build keeps its first block whatever it repeats: its name stays in the shop.
        return at === 0 || !known
      }),
    }))
  }
  if (total() > MAX_BLOCKS) {
    // Each build's share, one block at a time round the builds, as long as it has blocks to fill it.
    const shares = groups.map(() => 0)
    for (let left = MAX_BLOCKS; left > 0;) {
      const before = left
      groups.forEach((group, at) => {
        if (left > 0 && shares[at]! < group.blocks.length) {
          shares[at]!++
          left--
        }
      })
      if (left === before) break
    }
    groups = groups.map((group, at) => {
      const share = shares[at]!
      if (group.blocks.length <= share || share === 0) return { ...group, blocks: group.blocks.slice(0, share) }
      const rest = group.blocks.slice(share - 1)
      return {
        ...group,
        blocks: [...group.blocks.slice(0, share - 1), { title: shopText(`${group.prefix}${titles.more}`, BLOCK_TITLE), items: [...new Set(rest.flatMap(block => block.items))] }],
      }
    })
  }
  return groups.flatMap(group => group.blocks).slice(0, MAX_BLOCKS)
}

const BASIC: SkillKey[] = ['Q', 'W', 'E']
const SKILLS: SkillKey[] = ['Q', 'W', 'E', 'R']
const isSkill = (key: string): key is SkillKey => (SKILLS as string[]).includes(key)

/** The ability the guide ranks at each level, 1 to 18 (`Q`, `W`, `E`, `R`); a level the guide leaves blank is missing. */
export function abilityPoints(rows: GuideAbility[]): Record<number, SkillKey> {
  const points: Record<number, SkillKey> = {}
  for (const row of rows) {
    if (!isSkill(row.key)) continue
    for (const level of row.levels) {
      if (level >= 1 && level <= 18) points[level] = row.key
    }
  }
  return points
}

/**
 * The order the guide maxes its basic abilities in: each by the level it
 * takes its fifth point at (its last one so far, for an order the guide
 * leaves short), the most points first on a tie. An ability never ranked is
 * left out.
 */
export function maxOrder(rows: GuideAbility[]): SkillKey[] {
  const levelsOf = (key: SkillKey) => rows.filter(row => row.key === key).flatMap(row => row.levels).sort((a, b) => a - b)
  return BASIC
    .map(key => ({ key, levels: levelsOf(key) }))
    .filter(entry => entry.levels.length > 0)
    .sort((a, b) => (a.levels[4] ?? 99) - (b.levels[4] ?? 99) || b.levels.length - a.levels.length || a.levels.at(-1)! - b.levels.at(-1)!)
    .map(entry => entry.key)
}

/**
 * What keeps a rune page from importing: the trees, runes and shards the
 * index does not know, by the site's names. Empty for a page whose every
 * piece is known — one that still does not import is incomplete
 * (`runePageOf`).
 */
export function unresolvedRunes(page: GuideRunePage, index: GuideIndex): string[] {
  const trees = [page.primary.tree, page.secondary.tree].filter(tree => !index.styles.get(nameKey(tree)))
  const runes = [...page.primary.runes, ...page.secondary.runes, ...page.shards].filter(rune => idOf(index.runes, rune.name, rune.image) === null)
  return [...new Set([...trees, ...runes.map(rune => rune.name)].filter(Boolean))]
}
