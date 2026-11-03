import type { BuildOptions, ItemOption, Measure, RunePageIds } from '~/utils/sources/model'
import { weighedWinRate } from '~/utils/sources/model'

/**
 * Everything a source tells about one champion on one lane, for the Analytics
 * page (`pages/analytics.vue`), section by section. Each source fills the
 * sections it measures and leaves the others null or empty — the page says a
 * section is not this source's rather than borrow it from another. Rates are
 * fractions (0.53).
 */
export interface AnalyticsHeader {
  games: number
  winRate: number
  pickRate: number
  banRate: number | null
  /** The source's own grade, as it writes it (`S+`, `A`, `2`…). */
  tier: string | null
  rank: number | null
  rankTotal: number | null
  /** The bracket's average win rate, the line the champion's is read against. */
  averageWinRate: number | null
  /** The patch before, when the source keeps it: what moved since. */
  previous: { patch: string, winRate: number, pickRate: number, banRate: number | null, games: number } | null
}

export interface ItemSlot {
  /** 1–6 a build's nth completed item, 0 the boots. */
  slot: number
  options: (ItemOption & { minute?: number })[]
}

/** One level of the skill order: how often, and how well, each skill was taken at it. */
export interface SkillLevel { level: number, skills: (Measure | null)[] }

export interface MatchupRow {
  championId: number
  /** The champion's win rate against this one. */
  winRate: number
  pickRate: number | null
  games: number
  /** The source's own adjustments, when it has them (lolalytics' delta 1 and 2). */
  delta1?: number
  delta2?: number
}

export interface LaneRows { position: string, rows: MatchupRow[] }

export interface Objective {
  key: string
  /** Share of games the champion's team took it first, and its win rate then. */
  secure: Measure | null
  /** Share of games the enemy took it, and the champion's win rate then. */
  conceded: Measure | null
}

export interface TopPlayer {
  name: string
  region: string | null
  winRate: number | null
  games: number
  rank: string | null
  team?: string | null
  portraitUrl?: string | null
}

export interface TrendSeries {
  label: string
  points: { label: string, value: number }[]
}

/**
 * One build as a whole — the one most played, or the one that wins most —
 * skill priority and order, spells, the full rune page, starting items, the
 * core, and the options for each item after it, each with games and win rate.
 */
export interface SummaryBuild {
  skillPriority: (Measure & { order: string[] }) | null
  skillOrder: (Measure & { points: number[] }) | null
  spells: (Measure & { spellIds: number[] }) | null
  runes: (Measure & { page: RunePageIds }) | null
  starters: (Measure & { itemIds: number[] }) | null
  core: (Measure & { itemIds: number[] }) | null
  /** Slot 4, 5, 6: the options for each, most played (or best) first. */
  after: { slot: number, options: (Measure & { itemId: number })[] }[]
}

/** A skill path as the source measures it: a max order, or the skills taken up to a level. */
export interface SkillPath extends Measure { order: string[], points: number[] }

/** Each rune and shard on its own: taken as a primary rune (or a shard), and as a secondary one. */
export interface RuneStat { primary: Measure | null, secondary: Measure | null }

export interface ChampionAnalytics {
  patch: string | null
  header: AnalyticsHeader | null
  /** The lanes the champion is played on, with the share of its games on each. */
  lanes: { position: string, share: number }[]
  options: BuildOptions | null
  /** The two builds the page opens on: the most played, and the one that wins most. */
  summary: { common: SummaryBuild | null, winning: SummaryBuild | null }
  /** Skill max orders, and the full paths up to levels 6, 10 and 15. */
  skillPaths: { priority: SkillPath[], level6: SkillPath[], level10: SkillPath[], level15: SkillPath[] }
  /** Every rune and shard by id, when the source counts them one by one. */
  runeStats: Map<number, RuneStat>
  itemSlots: ItemSlot[]
  skillLevels: SkillLevel[]
  /** Its opponents, lane by lane — the lane it plays first. */
  matchups: LaneRows[]
  /** The allies it does best with, lane by lane. */
  synergies: LaneRows[]
  objectives: Objective[]
  /** Win rate by game length, shortest games first. */
  gameLength: Measure[]
  /** Win rate, pick rate, ban rate and games over time. */
  trend: { winRate: TrendSeries[], pickRate: TrendSeries[], banRate: TrendSeries[], games: TrendSeries[] }
  topPlayers: TopPlayer[]
  /** The champion's damage, by type, as shares of its total. */
  damage: { physical: number, magic: number, true: number } | null
  /** How the champion is played: by how many players (breadth) and how much by each (depth), 1 being the average. */
  playerBase: { breadth: number, depth: number, players: number, label: string } | null
  /** Per-game averages (kills, gold, damage…) and the champion's rank among all on each. */
  stats: { key: string, value: number, rank: number | null }[]
}

export const emptyAnalytics = (): ChampionAnalytics => ({
  patch: null,
  header: null,
  lanes: [],
  options: null,
  summary: { common: null, winning: null },
  skillPaths: { priority: [], level6: [], level10: [], level15: [] },
  runeStats: new Map(),
  itemSlots: [],
  skillLevels: [],
  matchups: [],
  synergies: [],
  objectives: [],
  gameLength: [],
  trend: { winRate: [], pickRate: [], banRate: [], games: [] },
  topPlayers: [],
  damage: null,
  playerBase: null,
  stats: [],
})

const LETTERS = 'QWER'
/** A skill path written as digits (`213114`, 1 Q … 4 R) as levels. */
export const pointsOf = (code: number | string) => String(code).split('').map(Number).filter(slot => slot >= 1 && slot <= 4)
export const lettersOf = (points: number[]) => points.map(slot => LETTERS[slot - 1] ?? '?')

/**
 * The two builds from a source's options, for a source that does not name
 * them: the most played choice of each block, and the one that wins most —
 * its win rate weighed by its games (`weighedWinRate`), so a handful of lucky
 * games never makes the winning build.
 */
export function summaryFromOptions(options: BuildOptions, winning: boolean): SummaryBuild {
  const pick = <T extends Measure>(list: T[]): T | null => {
    if (!winning) return list[0] ?? null
    return [...list].sort((a, b) => weighedWinRate(b) - weighedWinRate(a))[0] ?? null
  }
  const core = pick(options.cores)
  const skill = pick(options.skills)
  return {
    skillPriority: skill ? { ...skill, order: skill.order } : null,
    skillOrder: skill?.points.length ? { ...skill, points: skill.points } : null,
    spells: pick(options.spells),
    runes: pick(options.pages),
    starters: pick(options.starters),
    core,
    after: options.followUps(core).map(group => ({
      slot: group.slot,
      options: (winning ? [...group.options].sort((a, b) => weighedWinRate(b) - weighedWinRate(a)) : group.options).slice(0, 3).map(option => ({ ...option, itemId: option.itemIds.at(-1)! })),
    })),
  }
}

/** Damage amounts as shares of their sum; null with nothing dealt. */
export function damageShares(physical: number, magic: number, trueDamage: number): ChampionAnalytics['damage'] {
  const total = physical + magic + trueDamage
  return total > 0 ? { physical: physical / total, magic: magic / total, true: trueDamage / total } : null
}
