import type { DetailedStats, StatLine } from '~/utils/player-stats'
import type { PlayerGame } from '~/types/record'
import { counted } from '~/utils/player-form'

/**
 * What the dashboard reads out of a player's games beyond the figures: the
 * playstyle their play leans to, the lines they beat their lane opponents on
 * and the ones they lose them on (each with what to work on), the champions
 * they win most on and the allies they win most beside.
 *
 * Every verdict is measured against the lane opponents of the same games
 * (`DetailedStats`: same elo, same role), and the champions are ranked on the
 * lower bound of their win rate's Wilson interval, so three lucky wins do not
 * outrank twenty good ones. Nothing is said where nothing was measured.
 */

/** Under this, a gap to the opponents is within what twenty games can tell apart. */
export const MEANINGFUL_EDGE = 0.05

export type PlaystyleKey = 'carry' | 'farmer' | 'teamfighter' | 'visionary' | 'objectives' | 'frontline' | 'survivor' | 'balanced'

/** Each playstyle and the lines that show it, as the player beats their opponents on them. */
const PLAYSTYLES: { key: Exclude<PlaystyleKey, 'balanced'>, lines: string[] }[] = [
  { key: 'carry', lines: ['damagePerMinute', 'damageShare', 'soloKills'] },
  { key: 'farmer', lines: ['csPerMinute', 'csAt10', 'maxCsLead', 'goldPerMinute'] },
  { key: 'teamfighter', lines: ['killParticipation', 'kda', 'ccTime'] },
  { key: 'visionary', lines: ['visionPerMinute', 'wardsPlaced', 'wardsKilled', 'controlWards'] },
  { key: 'objectives', lines: ['dragons', 'barons', 'heralds', 'turrets', 'objectiveDamage', 'teamTurretPlates'] },
  { key: 'frontline', lines: ['ccTime', 'skillshotsDodged'] },
  { key: 'survivor', lines: ['deaths', 'timeDead'] },
]

export interface Playstyle {
  key: PlaystyleKey
  /** The next strongest lean, when it is one too. */
  second: PlaystyleKey | null
}

const linesOf = (stats: DetailedStats) => stats.groups.flatMap(group => group.lines)

export function playstyleOf(stats: DetailedStats): Playstyle {
  const edges = new Map(linesOf(stats).map(line => [line.key, line.edge]))
  // A frontliner takes the team's damage: that line reads "worse" against the
  // opponents (less is better for survival), so it counts here the other way.
  const taken = edges.get('damageTakenShare')
  const scored = PLAYSTYLES.map((style) => {
    const values = style.lines.map(key => edges.get(key)).filter((edge): edge is number => edge !== null && edge !== undefined)
    if (style.key === 'frontline' && taken !== null && taken !== undefined) values.push(-taken)
    return { key: style.key, score: values.length ? values.reduce((sum, edge) => sum + edge, 0) / values.length : -Infinity }
  }).sort((a, b) => b.score - a.score)
  const [first, second] = scored
  if (!first || first.score < MEANINGFUL_EDGE) return { key: 'balanced', second: null }
  return { key: first.key, second: second && second.score >= MEANINGFUL_EDGE ? second.key : null }
}

/** The lines the player clearly beats their opponents on, the widest gap first. */
export function strengthsOf(stats: DetailedStats, count = 3): StatLine[] {
  return linesOf(stats).filter(line => (line.edge ?? 0) >= MEANINGFUL_EDGE).sort((a, b) => b.edge! - a.edge!).slice(0, count)
}

/** The lines the player clearly loses to their opponents on, the widest gap first: what to work on. */
export function improvementsOf(stats: DetailedStats, count = 3): StatLine[] {
  return linesOf(stats).filter(line => (line.edge ?? 0) <= -MEANINGFUL_EDGE).sort((a, b) => a.edge! - b.edge!).slice(0, count)
}

export interface ChampionPick {
  championId: number
  games: number
  wins: number
  /** The raw win rate, 0–1. */
  winRate: number
  /** Kills and assists per death; null for an ally. */
  kda: number | null
}

/** Lower bound of the 95% Wilson interval: "at worst this champion wins this much" — a big sample over a lucky one. */
function wilsonLower(wins: number, games: number): number {
  const z = 1.96
  const rate = wins / games
  const spread = z * Math.sqrt((rate * (1 - rate) + (z * z) / (4 * games)) / games)
  return (rate + (z * z) / (2 * games) - spread) / (1 + (z * z) / games)
}

function ranked(lines: { championId: number, games: number, wins: number, kda: number | null }[], overall: number, min: number, count: number): ChampionPick[] {
  return lines
    .filter(line => line.games >= min && line.wins / line.games > overall)
    .sort((a, b) => wilsonLower(b.wins, b.games) - wilsonLower(a.wins, a.games) || b.games - a.games)
    .slice(0, count)
    .map(line => ({ ...line, winRate: line.wins / line.games }))
}

/** The champions the player wins most on — above their own win rate, at least `min` games each. */
export function bestChampions(newestFirst: PlayerGame[], min = 3, count = 3): ChampionPick[] {
  const games = counted(newestFirst)
  if (!games.length) return []
  const overall = games.filter(game => game.win).length / games.length
  const byChampion = new Map<number, PlayerGame[]>()
  for (const game of games) byChampion.set(game.championId, [...(byChampion.get(game.championId) ?? []), game])
  return ranked([...byChampion].map(([championId, played]) => {
    const kills = played.reduce((sum, game) => sum + game.kills + game.assists, 0)
    const deaths = played.reduce((sum, game) => sum + game.deaths, 0)
    return { championId, games: played.length, wins: played.filter(game => game.win).length, kda: kills / Math.max(1, deaths) }
  }), overall, min, count)
}

/** The allied champions the player wins most beside — read from the games whose scoreboard was read. */
export function bestAllies(newestFirst: PlayerGame[], min = 3, count = 3): ChampionPick[] {
  const games = counted(newestFirst).filter(game => game.participants.length)
  if (!games.length) return []
  const overall = games.filter(game => game.win).length / games.length
  const byAlly = new Map<number, { games: number, wins: number }>()
  for (const game of games) {
    for (const ally of game.participants) {
      if (ally.teamId !== game.teamId || ally.participantId === game.participantId) continue
      const line = byAlly.get(ally.championId) ?? { games: 0, wins: 0 }
      byAlly.set(ally.championId, { games: line.games + 1, wins: line.wins + (game.win ? 1 : 0) })
    }
  }
  return ranked([...byAlly].map(([championId, line]) => ({ championId, ...line, kda: null })), overall, min, count)
}
