import type { RankHistoryEntry } from '#shared/types/rank-history'
import type { GameParticipant, PlayerGame } from '~/types/record'
import { gameScore } from '~/utils/match-summary'
import { lpDeltaOf } from '~/utils/lp-history'
import { sessionPositions } from './sequence'

/**
 * Every figure the app holds about one of the player's games, as the numbers
 * the nerd page correlates with winning.
 *
 * All of it comes from the client's own record (`PlayerGame`), nothing is
 * fetched: the player's scoreboard line, the ten players' lines (shares of the
 * team's gold, damage and deaths), the timeline marks every participant
 * carries at 5/10/15/20/30 minutes (gold, CS and XP against the lane
 * opponent, the team's gold against the other team's), the teams' objectives,
 * the game's grade (`gameScore`), its LP (`lpDeltaOf`), when it was played and
 * where it sat in its session.
 *
 * A figure the game did not carry — an unread scoreboard, a timeline that
 * could not be read, a lane without exactly one opponent — is left out of the
 * row, never set to zero: the analysis then counts that game out of that
 * metric only.
 */

export type MetricKey =
  | 'duration'
  | 'kills' | 'deaths' | 'assists' | 'kda' | 'killParticipation' | 'deathsPerMin' | 'deathShare' | 'largestMultiKill' | 'multiKills' | 'firstBlood'
  | 'cs' | 'csPerMin' | 'gold' | 'goldPerMin' | 'goldShare' | 'level'
  | 'damage' | 'damagePerMin' | 'damageShare' | 'mitigatedPerMin' | 'turretDamage'
  | 'visionScore' | 'visionPerMin'
  | 'goldDiff10' | 'csDiff10' | 'xpDiff10' | 'goldDiff15' | 'csDiff15' | 'xpDiff15' | 'teamGoldDiff15'
  | 'towerDiff' | 'dragonDiff' | 'baronDiff' | 'heraldDiff' | 'grubDiff'
  | 'performance' | 'blueSide'

export type MetricGroup = 'context' | 'combat' | 'economy' | 'damage' | 'vision' | 'lane' | 'objectives'

/**
 * When in the game a metric is settled, which is how much of it can be a cause
 * of the result rather than its consequence:
 * - `pregame`: fixed before the game starts (the side);
 * - `early`: settled in the first fifteen minutes, long before the result;
 * - `performance`: the player's whole game — partly cause, partly the
 *   snowball of a game already being won;
 * - `outcome`: what winning itself produces (towers, barons, level, length,
 *   the gold the objectives and the kills of a won game pay out): a
 *   correlation that says the game was won, not why.
 */
export type MetricTiming = 'pregame' | 'early' | 'performance' | 'outcome'

/** How a metric's value reads: the page formats it from this. */
export type MetricFormat = 'count' | 'decimal' | 'ratio' | 'percent' | 'perMin' | 'gold' | 'signed' | 'minutes' | 'binary' | 'score'

export interface MetricDefinition {
  key: MetricKey
  group: MetricGroup
  timing: MetricTiming
  format: MetricFormat
  /** Whether more of it is the player doing better (deaths: no); null where neither reads as better. */
  higherIsBetter: boolean | null
}

const metric = (key: MetricKey, group: MetricGroup, timing: MetricTiming, format: MetricFormat, higherIsBetter: boolean | null = true): MetricDefinition =>
  ({ key, group, timing, format, higherIsBetter })

/** Every metric, in the order the page groups them. */
export const METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  metric('blueSide', 'context', 'pregame', 'binary', null),
  metric('duration', 'context', 'outcome', 'minutes', null),
  metric('kills', 'combat', 'performance', 'count'),
  metric('deaths', 'combat', 'performance', 'count', false),
  metric('assists', 'combat', 'performance', 'count'),
  metric('kda', 'combat', 'performance', 'ratio'),
  metric('killParticipation', 'combat', 'performance', 'percent'),
  metric('deathsPerMin', 'combat', 'performance', 'perMin', false),
  metric('deathShare', 'combat', 'performance', 'percent', false),
  metric('largestMultiKill', 'combat', 'performance', 'count'),
  metric('multiKills', 'combat', 'performance', 'count'),
  metric('firstBlood', 'combat', 'early', 'binary'),
  metric('cs', 'economy', 'performance', 'count'),
  metric('csPerMin', 'economy', 'performance', 'perMin'),
  metric('gold', 'economy', 'outcome', 'gold'),
  metric('goldPerMin', 'economy', 'outcome', 'perMin'),
  metric('goldShare', 'economy', 'performance', 'percent'),
  metric('level', 'economy', 'outcome', 'count'),
  metric('damage', 'damage', 'performance', 'gold'),
  metric('damagePerMin', 'damage', 'performance', 'perMin'),
  metric('damageShare', 'damage', 'performance', 'percent'),
  metric('mitigatedPerMin', 'damage', 'performance', 'perMin'),
  metric('turretDamage', 'damage', 'outcome', 'gold'),
  metric('visionScore', 'vision', 'performance', 'count'),
  metric('visionPerMin', 'vision', 'performance', 'perMin'),
  metric('goldDiff10', 'lane', 'early', 'signed'),
  metric('csDiff10', 'lane', 'early', 'signed'),
  metric('xpDiff10', 'lane', 'early', 'signed'),
  metric('goldDiff15', 'lane', 'early', 'signed'),
  metric('csDiff15', 'lane', 'early', 'signed'),
  metric('xpDiff15', 'lane', 'early', 'signed'),
  metric('teamGoldDiff15', 'lane', 'early', 'signed'),
  metric('towerDiff', 'objectives', 'outcome', 'signed'),
  metric('dragonDiff', 'objectives', 'outcome', 'signed'),
  metric('baronDiff', 'objectives', 'outcome', 'signed'),
  metric('heraldDiff', 'objectives', 'outcome', 'signed'),
  metric('grubDiff', 'objectives', 'outcome', 'signed'),
  metric('performance', 'combat', 'performance', 'score'),
]

export const DEFINITION_BY_KEY = new Map(METRIC_DEFINITIONS.map(definition => [definition.key, definition]))

export type QueueGroup = 'solo' | 'flex' | 'normal' | 'aram' | 'arena' | 'other'

const QUEUE_GROUPS: Record<number, QueueGroup> = {
  420: 'solo', 440: 'flex', 400: 'normal', 430: 'normal', 480: 'normal', 490: 'normal', 450: 'aram', 1700: 'arena', 1710: 'arena',
}

export const queueGroup = (queueId: number): QueueGroup => QUEUE_GROUPS[queueId] ?? 'other'

/** One game, read for the analysis. */
export interface GameRow {
  game: PlayerGame
  win: boolean
  queue: QueueGroup
  /** Every metric the game carries; a missing key is a figure the game did not measure. */
  values: Partial<Record<MetricKey, number>>
  /** The LP the game moved, when the rank history could measure it (Solo/Duo only). */
  lpDelta: number | null
  /** Local hour 0..23 and weekday 0 (Sunday)..6 the game started at. */
  hour: number
  weekday: number
  /** Its place in the sitting it was played in, 1 for the first game (`sessionPositions`). */
  session: number
}

const SUMMONERS_RIFT = 11

/** The lane's marks read against the opponent: the minute, then its gold, CS and XP leads. */
const LANE_MARKS: [number, MetricKey, MetricKey, MetricKey][] = [
  [10, 'goldDiff10', 'csDiff10', 'xpDiff10'],
  [15, 'goldDiff15', 'csDiff15', 'xpDiff15'],
]

function markAt(participant: GameParticipant | undefined, minute: number) {
  return participant?.marks.find(mark => mark.minute === minute)
}

/** The one participant of the other side on the player's lane; none when the pairing is ambiguous, as the grader reads it. */
function laneOpponent(game: PlayerGame, self: GameParticipant): GameParticipant | undefined {
  if (!self.position) return undefined
  const foes = game.participants.filter(other => other.teamId !== self.teamId && other.position === self.position)
  return foes.length === 1 ? foes[0] : undefined
}

/** The team's gold at a mark against the other team's, only when all ten players have that mark. */
function teamGoldDiff(game: PlayerGame, minute: number): number | undefined {
  if (game.participants.length !== 10) return undefined
  let diff = 0
  for (const participant of game.participants) {
    const mark = markAt(participant, minute)
    if (!mark) return undefined
    diff += participant.teamId === game.teamId ? mark.gold : -mark.gold
  }
  return diff
}

/** Every metric of one game. */
export function gameValues(game: PlayerGame): Partial<Record<MetricKey, number>> {
  const minutes = Math.max(game.durationSeconds, 60) / 60
  const values: Partial<Record<MetricKey, number>> = {
    blueSide: game.teamId === 100 ? 1 : 0,
    duration: minutes,
    kills: game.kills,
    deaths: game.deaths,
    assists: game.assists,
    kda: (game.kills + game.assists) / Math.max(game.deaths, 1),
    deathsPerMin: game.deaths / minutes,
    largestMultiKill: game.largestMultiKill,
    cs: game.cs,
    csPerMin: game.cs / minutes,
    gold: game.gold,
    goldPerMin: game.gold / minutes,
    level: game.championLevel,
    damage: game.damageToChampions,
    damagePerMin: game.damageToChampions / minutes,
    visionScore: game.visionScore,
    visionPerMin: game.visionScore / minutes,
  }
  if (game.multiKills) values.multiKills = game.multiKills.double + game.multiKills.triple + game.multiKills.quadra + game.multiKills.penta
  if (game.firstBlood !== undefined) values.firstBlood = game.firstBlood ? 1 : 0
  if (game.teamKills) values.killParticipation = Math.min((game.kills + game.assists) / game.teamKills, 1)
  if (game.teamDamageToChampions) values.damageShare = game.damageToChampions / game.teamDamageToChampions

  const self = game.participants.find(p => p.participantId === game.participantId)
  if (self) {
    const team = game.participants.filter(p => p.teamId === self.teamId)
    const enemyKills = game.participants.filter(p => p.teamId !== self.teamId).reduce((total, p) => total + p.kills, 0)
    const teamGold = team.reduce((total, p) => total + p.goldEarned, 0)
    if (teamGold > 0) values.goldShare = self.goldEarned / teamGold
    if (enemyKills > 0) values.deathShare = Math.min(self.deaths / enemyKills, 1)
    if (self.damageSelfMitigated !== undefined) values.mitigatedPerMin = self.damageSelfMitigated / minutes
    if (self.damageToTurrets !== undefined) values.turretDamage = self.damageToTurrets
    const foe = laneOpponent(game, self)
    for (const [minute, gold, cs, xp] of LANE_MARKS) {
      const mine = markAt(self, minute)
      const theirs = markAt(foe, minute)
      if (!mine || !theirs) continue
      values[gold] = mine.gold - theirs.gold
      values[cs] = mine.cs - theirs.cs
      values[xp] = mine.xp - theirs.xp
    }
    const team15 = teamGoldDiff(game, 15)
    if (team15 !== undefined) values.teamGoldDiff15 = team15
  }

  const ours = game.teams?.find(team => team.teamId === game.teamId)
  const theirs = game.teams?.find(team => team.teamId !== game.teamId)
  if (ours && theirs) {
    values.towerDiff = ours.towers - theirs.towers
    values.dragonDiff = ours.dragons - theirs.dragons
    values.baronDiff = ours.barons - theirs.barons
    values.heraldDiff = ours.heralds - theirs.heralds
    if (ours.grubs !== null && theirs.grubs !== null) values.grubDiff = ours.grubs - theirs.grubs
  }

  const score = gameScore(game).performanceScore
  if (score > 0) values.performance = score
  return values
}

/**
 * The player's games as rows, oldest first, remakes left out (they measure
 * nothing). Sessions are counted over every game, remakes and other queues
 * included — a sitting is a sitting whatever was queued — before any filter.
 */
export function gameRows(newestFirst: readonly PlayerGame[], history: readonly RankHistoryEntry[] = []): GameRow[] {
  const oldestFirst = [...newestFirst].sort((a, b) => a.playedAt - b.playedAt)
  const sessions = sessionPositions(oldestFirst)
  const all = [...newestFirst]
  const snapshots = [...history]
  const rows: GameRow[] = []
  oldestFirst.forEach((game, index) => {
    if (game.remake) return
    const at = new Date(game.playedAt)
    rows.push({
      game,
      win: game.win,
      queue: queueGroup(game.queueId),
      values: gameValues(game),
      lpDelta: lpDeltaOf(game, all, snapshots),
      hour: at.getHours(),
      weekday: at.getDay(),
      session: sessions[index]!,
    })
  })
  return rows
}

/** The page's queue filter. Summoner's Rift is the default: ARAM's and Arena's numbers mean other things. */
export type NerdQueueFilter = 'rift' | 'ranked' | 'solo' | 'flex' | 'normal' | 'aram' | 'all'

export function filterRows(rows: readonly GameRow[], filter: NerdQueueFilter): GameRow[] {
  switch (filter) {
    case 'rift': return rows.filter(row => row.game.mapId === SUMMONERS_RIFT)
    case 'ranked': return rows.filter(row => row.queue === 'solo' || row.queue === 'flex')
    case 'all': return [...rows]
    default: return rows.filter(row => row.queue === filter)
  }
}
