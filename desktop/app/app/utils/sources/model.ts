import type { RuneTreeResponse } from '#shared/types/static-data'
import { fetchRuneTree } from '~/utils/static-data'
import type { BuildRunePage, BuildTreeNode, ChampionBuild, ChampionBuildResponse } from '~/types/build'
import { isBoots, maxOrder } from '~/utils/blitz/builds'

/**
 * Every choice a source measured on a champion's lane, in one shape whatever
 * the source (`utils/sources/*`): what the build panel (`BuildSourcePanel`)
 * lists — rune pages, spell pairs, starters, boots, cores, the items after
 * them, skill orders — each with its games, its share and its win rate. Rates
 * are fractions (0.53), shares of the lane's games.
 */
export interface Measure { games: number, pickRate: number, winRate: number }

export interface ItemOption extends Measure {
  itemIds: number[]
  /** Why the draft recommends this option (`useDraftItemAdvice`), when it does. */
  note?: string
}

export interface SpellOption extends Measure { spellIds: number[] }

export interface SkillOption extends Measure {
  /** The skill taken at each level, 1 Q … 4 R. */
  points: number[]
  /** The max order of the basic abilities. */
  order: string[]
  /** The first three levels: orders that max alike differ there. */
  opening: string[]
}

export type RunePageIds = Omit<BuildRunePage, keyof Measure>
export interface RunePageOption extends Measure { page: RunePageIds }

/** Each rune's share on the lane, when a source measures runes one by one. */
export interface RuneShares {
  primary: Map<number, Measure>
  secondary: Map<number, Measure>
  /** Offense, flex, defense — the order of `RuneTreeResponse.shardSlots`. */
  shards: [Map<number, Measure>, Map<number, Measure>, Map<number, Measure>]
}

export interface SlotGroup { slot: number, options: ItemOption[] }

export interface BuildOptions {
  patch: string | null
  games: number
  pages: RunePageOption[]
  /** By the page's primary tree; null when the source measures whole pages only. */
  shares: ((primaryStyleId: number) => RuneShares) | null
  spells: SpellOption[]
  starters: ItemOption[]
  boots: ItemOption[]
  cores: ItemOption[]
  /** The fourth item onward: after that core when the source measures it so, else the lane's. */
  followUps: (core: ItemOption | null) => SlotGroup[]
  skills: SkillOption[]
  /** The max orders over every game, when the source measures them apart from whole sequences (lolalytics). */
  priorities?: SkillPriority[]
}

/** A max order (`Q › W › E`) over the games it was played in, however the points were spent on the way. */
export interface SkillPriority extends Measure { order: string[] }

/**
 * The max orders to headline the skills with: the source's own, else the
 * sequences' added up by the order they max — a whole sequence only counts
 * the games that got to its end, which run longer and win more than the
 * champion's games do, so it is no headline itself when better is measured.
 */
export function prioritiesOf(options: Pick<BuildOptions, 'skills' | 'priorities'>): SkillPriority[] {
  if (options.priorities?.length) return options.priorities
  const byOrder = new Map<string, SkillPriority>()
  for (const skill of options.skills) {
    const key = skill.order.join('')
    const known = byOrder.get(key)
    if (!known) {
      byOrder.set(key, { order: skill.order, games: skill.games, pickRate: skill.pickRate, winRate: skill.winRate })
      continue
    }
    const games = known.games + skill.games
    known.winRate = games ? (known.winRate * known.games + skill.winRate * skill.games) / games : 0
    known.games = games
    known.pickRate += skill.pickRate
  }
  return [...byOrder.values()].sort((a, b) => b.games - a.games)
}

/**
 * Each sequence's label: its first levels, as many as it takes for no two of
 * them to read alike (three at least) — two orders that max alike often only
 * part at level four or five.
 */
export function skillOpenings(skills: Pick<SkillOption, 'points'>[]): string[][] {
  const letters = (points: number[], length: number) => points.slice(0, length).map(slot => 'QWER'[slot - 1] ?? '?')
  let length = 3
  while (length < 10 && new Set(skills.map(skill => letters(skill.points, length).join(''))).size < skills.length) length++
  return skills.map(skill => letters(skill.points, length))
}

export const measure = (games: number, winRate: number, pickRate: number): Measure => ({ games, winRate, pickRate })

/**
 * A win rate weighed by its games: the lower end of its 95% Wilson interval.
 * What "wins most" ranks by, so a choice won 70% of 30 games (≈ 0.52) does not
 * outrank one won 56% of 30 000 (≈ 0.555) — few games, wide interval, low bound.
 */
export function weighedWinRate({ winRate, games }: { winRate: number, games: number }): number {
  if (games <= 0) return 0
  const z = 1.96
  const p = Math.min(Math.max(winRate, 0), 1)
  const denominator = 1 + z * z / games
  const centre = p + z * z / (2 * games)
  const spread = z * Math.sqrt(p * (1 - p) / games + z * z / (4 * games * games))
  return (centre - spread) / denominator
}

export function skillOption(points: number[], measured: Measure): SkillOption {
  return { ...measured, points, order: maxOrder(points), opening: points.slice(0, 3).map(slot => 'QWER'[slot - 1] ?? '?') }
}

const best = (row: number[], from: Map<number, Measure> | undefined) =>
  row.reduce<number | null>((top, id) => ((from?.get(id)?.games ?? 0) > (top === null ? 0 : from?.get(top)?.games ?? 0) ? id : top), null)

/**
 * A full rune page for a keystone, from runes measured one by one: the
 * keystone's tree, its most taken rune on each row; the secondary tree the
 * secondary slots were spent in most, its two most taken runes on two
 * different rows; the most taken shard on each row.
 */
export function assemblePage(keystoneId: number, shares: (primaryStyleId: number) => RuneShares, tree: RuneTreeResponse): RunePageIds | null {
  const primary = tree.styles.find(style => style.keystones.includes(keystoneId))
  if (!primary) return null
  const measured = shares(primary.styleId)
  const [perk1, perk2, perk3] = primary.subRows.map(row => best(row, measured.primary) ?? 0)
  const secondary = tree.styles
    .filter(style => style.styleId !== primary.styleId)
    .map(style => ({ style, games: style.subRows.flat().reduce((sum, id) => sum + (measured.secondary.get(id)?.games ?? 0), 0) }))
    .sort((a, b) => b.games - a.games)[0]?.style
  const picks = (secondary?.subRows ?? [])
    .map(row => best(row, measured.secondary))
    .filter((id): id is number => id !== null && (measured.secondary.get(id)?.games ?? 0) > 0)
    .sort((a, b) => measured.secondary.get(b)!.games - measured.secondary.get(a)!.games)
  const [offense, flex, defense] = tree.shardSlots.map((row, index) => best(row, measured.shards[index]) ?? 0)
  return {
    primaryStyleId: primary.styleId,
    primaryKeystoneId: keystoneId,
    primaryPerk1Id: perk1 ?? 0,
    primaryPerk2Id: perk2 ?? 0,
    primaryPerk3Id: perk3 ?? 0,
    secondaryStyleId: secondary?.styleId ?? 0,
    secondaryPerk1Id: picks[0] ?? 0,
    secondaryPerk2Id: picks[1] ?? 0,
    statOffense: offense ?? 0,
    statFlex: flex ?? 0,
    statDefense: defense ?? 0,
  }
}

/** The most played first, at most `count`. */
export const ranked = <T extends { games: number }>(list: T[], count: number) => [...list].sort((a, b) => b.games - a.games).slice(0, count)

const BUILDS_SHOWN = 4

/**
 * The options in the shape of TrueMain's champion endpoint, so every build
 * view draws a source's lane builds unchanged: one build per most played
 * core, its boots apart, what follows it under its last item, and the lane's
 * most played page, spells, starter and skills on each.
 */
export function buildsFromOptions(championId: number, position: string, options: BuildOptions | null): ChampionBuildResponse {
  if (!options) return { championId, patch: null, position, totalGames: 0, builds: [] }
  const top = <T>(list: T[]) => list[0] ?? null
  const page = top(options.pages)
  const spells = top(options.spells)
  const skill = top(options.skills)
  const starter = top(options.starters)
  const shared = {
    runePage: page ? { ...page.page, games: page.games, pickRate: page.pickRate, winRate: page.winRate } : null,
    summonerSpells: spells && spells.spellIds.length >= 2 ? { spell1Id: spells.spellIds[0]!, spell2Id: spells.spellIds[1]!, games: spells.games, pickRate: spells.pickRate, winRate: spells.winRate } : null,
    skillOrder: skill ? { sequence: skill.order, games: skill.games, pickRate: skill.pickRate, winRate: skill.winRate } : null,
    starterItems: starter ? { itemIds: starter.itemIds, games: starter.games, pickRate: starter.pickRate, winRate: starter.winRate } : null,
  }
  const laneBoots = top(options.boots)
  // Cores equal once their boots are drawn apart are one build: games summed, wins weighted.
  const merged = new Map<string, ItemOption>()
  for (const core of options.cores) {
    const key = `${core.itemIds.filter(id => !isBoots(id)).join(',')}|${core.itemIds.filter(isBoots).join(',')}`
    const known = merged.get(key)
    if (!known) merged.set(key, core)
    else {
      const games = known.games + core.games
      merged.set(key, { ...(core.games > known.games ? core : known), games, pickRate: known.pickRate + core.pickRate, winRate: games > 0 ? (known.winRate * known.games + core.winRate * core.games) / games : 0 })
    }
  }
  const builds: ChampionBuild[] = ranked([...merged.values()], BUILDS_SHOWN).flatMap((core) => {
    const path = core.itemIds.filter(id => !isBoots(id))
    const boots = core.itemIds.find(isBoots)
    if (path.length === 0) return []
    const followUps: BuildTreeNode[] = (options.followUps(core)[0]?.options ?? []).slice(0, 4)
      .map(option => ({ itemId: option.itemIds.at(-1)!, games: option.games, wins: Math.round(option.games * option.winRate), pickRate: option.pickRate, children: [] }))
    // The view draws the first item as the tree's root: the tree is what follows it.
    const buildTree = path.slice(1).reduceRight<BuildTreeNode[]>((children, itemId) => [{
      itemId,
      games: core.games,
      wins: Math.round(core.games * core.winRate),
      pickRate: 1,
      children,
    }], followUps)
    return [{
      firstItemId: path[0]!,
      buildTree,
      primaryKeystoneId: page?.page.primaryKeystoneId ?? 0,
      games: core.games,
      pickRate: core.pickRate,
      winRate: core.winRate,
      core: {
        ...shared,
        itemPath: { itemIds: path, games: core.games, pickRate: core.pickRate, winRate: core.winRate },
        boots: boots ? { itemIds: [boots], games: core.games, pickRate: core.pickRate, winRate: core.winRate } : laneBoots && { itemIds: laneBoots.itemIds, games: laneBoots.games, pickRate: laneBoots.pickRate, winRate: laneBoots.winRate },
      },
    }]
  })
  return { championId, patch: options.patch, position, totalGames: options.games, builds }
}

let runeTree: Promise<RuneTreeResponse> | null = null

/** The live rune tree, read once for the session: every page a source's runes are assembled into needs it. */
export function liveRuneTree(): Promise<RuneTreeResponse> {
  runeTree ??= fetchRuneTree(null).catch((error) => {
    runeTree = null
    throw error
  })
  return runeTree
}
