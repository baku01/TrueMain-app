import type { MatchAnswer, Participant } from '~/utils/blitz/player'

/**
 * A player's play in detail, over their recent games (Riot's match data, read
 * from Blitz): what the scoreboard shows — kills, CS, vision — and what only
 * the game's own measures (`challenges`) carry — the share of the team's
 * damage, CS at ten minutes, solo kills, plates, objectives, skillshots. Per
 * game unless named a share; remakes left out.
 *
 * A figure alone says nothing of whether it is good: each is set against the
 * player's lane opponents in the same games — the same elo, the same role,
 * the same game length — and read over the games won and the games lost.
 */
export interface StatLine {
  key: string
  /** The figure over every game, and over the wins and the losses alone; null where never measured. */
  all: number | null
  wins: number | null
  losses: number | null
  /** The same figure for the lane opponents of those games; null where none was found. */
  opponents: number | null
  /** The player against the opponents, as a fraction: +0.2 is 20% better, whichever way better reads. */
  edge: number | null
  /** How the figure reads: a count per game, a share, per minute, seconds. */
  unit: 'count' | 'share' | 'perMinute' | 'number'
}

export interface StatGroup {
  key: string
  lines: StatLine[]
  /** The group's lines' edges together: how the player does in it against their opponents. */
  edge: number | null
}

/** Figures where less is better. */
export const LOWER_IS_BETTER = new Set(['deaths', 'timeDead', 'damageTakenShare'])

export interface DetailedStats {
  games: number
  wins: number
  groups: StatGroup[]
  /** Multi-kills over the games, counted. */
  multiKills: { double: number, triple: number, quadra: number, penta: number }
}

interface Game { me: Participant, team: Participant[], minutes: number, win: boolean }

type Measure = (game: Game) => number | null | undefined

const challenge = (key: string): Measure => game => game.me.challenges?.[key]
const perMinute = (pick: (p: Participant) => number | undefined): Measure => game => ((pick(game.me) ?? 0) / game.minutes)
const share = (pick: (p: Participant) => number | undefined): Measure => (game) => {
  const team = game.team.reduce((sum, p) => sum + (pick(p) ?? 0), 0)
  return team > 0 ? (pick(game.me) ?? 0) / team : null
}

const GROUPS: { key: string, lines: { key: string, unit: StatLine['unit'], measure: Measure }[] }[] = [
  { key: 'combat', lines: [
    { key: 'kda', unit: 'number', measure: game => (game.me.kills + game.me.assists) / Math.max(1, game.me.deaths) },
    { key: 'killParticipation', unit: 'share', measure: challenge('killParticipation') },
    { key: 'damagePerMinute', unit: 'perMinute', measure: perMinute(p => p.totalDamageDealtToChampions) },
    { key: 'damageShare', unit: 'share', measure: share(p => p.totalDamageDealtToChampions) },
    { key: 'soloKills', unit: 'count', measure: challenge('soloKills') },
    { key: 'skillshotsHit', unit: 'count', measure: challenge('skillshotsHit') },
    { key: 'skillshotsDodged', unit: 'count', measure: challenge('skillshotsDodged') },
  ] },
  { key: 'laning', lines: [
    { key: 'csPerMinute', unit: 'perMinute', measure: perMinute(p => (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0)) },
    { key: 'csAt10', unit: 'count', measure: challenge('laneMinionsFirst10Minutes') },
    { key: 'maxCsLead', unit: 'count', measure: challenge('maxCsAdvantageOnLaneOpponent') },
    { key: 'goldPerMinute', unit: 'perMinute', measure: perMinute(p => p.goldEarned) },
    { key: 'firstBlood', unit: 'share', measure: game => (game.me.firstBloodKill || game.me.firstBloodAssist ? 1 : 0) },
    { key: 'teamTurretPlates', unit: 'count', measure: challenge('turretPlatesTaken') },
  ] },
  { key: 'vision', lines: [
    { key: 'visionPerMinute', unit: 'perMinute', measure: perMinute(p => p.visionScore) },
    { key: 'wardsPlaced', unit: 'count', measure: game => game.me.wardsPlaced },
    { key: 'wardsKilled', unit: 'count', measure: game => game.me.wardsKilled },
    { key: 'controlWards', unit: 'count', measure: game => game.me.visionWardsBoughtInGame },
  ] },
  { key: 'objectives', lines: [
    { key: 'dragons', unit: 'count', measure: challenge('dragonTakedowns') },
    { key: 'barons', unit: 'count', measure: challenge('baronTakedowns') },
    { key: 'heralds', unit: 'count', measure: challenge('riftHeraldTakedowns') },
    { key: 'turrets', unit: 'count', measure: challenge('turretTakedowns') },
    { key: 'objectiveDamage', unit: 'perMinute', measure: perMinute(p => p.damageDealtToObjectives) },
  ] },
  { key: 'survival', lines: [
    { key: 'deaths', unit: 'count', measure: game => game.me.deaths },
    { key: 'timeDead', unit: 'share', measure: game => (game.me.totalTimeSpentDead ?? 0) / (game.minutes * 60) },
    { key: 'damageTakenShare', unit: 'share', measure: challenge('damageTakenOnTeamPercentage') },
    { key: 'ccTime', unit: 'count', measure: game => game.me.timeCCingOthers },
  ] },
]

const average = (values: (number | null | undefined)[]) => {
  const known = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null
}

/**
 * How much better the player's figure is than the opponents', as a fraction,
 * capped at ±100%: (player − opponents) / opponents, turned round where less
 * is better. Null when the opponents' figure is 0 or unknown.
 */
export function edgeOf(key: string, mine: number | null, theirs: number | null): number | null {
  if (mine === null || theirs === null || theirs === 0) return null
  const raw = (mine - theirs) / Math.abs(theirs)
  return Math.max(-1, Math.min(1, LOWER_IS_BETTER.has(key) ? -raw : raw))
}

export function detailedStats(answers: MatchAnswer[], puuid: string): DetailedStats | null {
  const games: Game[] = []
  /** The lane opponent of each game, measured as the player is: their own team as their team. */
  const opponents: Game[] = []
  for (const answer of answers) {
    const info = answer.info
    const me = info?.participants.find(p => p.puuid === puuid)
    if (!info || !me || info.gameDuration < 300) continue
    const minutes = info.gameDuration / 60
    games.push({ me, team: info.participants.filter(p => p.teamId === me.teamId), minutes, win: me.win })
    const rival = me.teamPosition ? info.participants.find(p => p.teamId !== me.teamId && p.teamPosition === me.teamPosition) : undefined
    if (rival) opponents.push({ me: rival, team: info.participants.filter(p => p.teamId === rival.teamId), minutes, win: rival.win })
  }
  if (!games.length) return null
  const wins = games.filter(game => game.win)
  const losses = games.filter(game => !game.win)
  return {
    games: games.length,
    wins: wins.length,
    groups: GROUPS.map((group) => {
      const lines = group.lines.map((line) => {
        const all = average(games.map(line.measure))
        const rivals = average(opponents.map(line.measure))
        return {
          key: line.key,
          unit: line.unit,
          all,
          wins: average(wins.map(line.measure)),
          losses: average(losses.map(line.measure)),
          opponents: rivals,
          edge: edgeOf(line.key, all, rivals),
        }
      }).filter(line => line.all !== null)
      return { key: group.key, lines, edge: average(lines.map(line => line.edge)) }
    }).filter(group => group.lines.length > 0),
    multiKills: {
      double: games.reduce((sum, game) => sum + (game.me.doubleKills ?? 0), 0),
      triple: games.reduce((sum, game) => sum + (game.me.tripleKills ?? 0), 0),
      quadra: games.reduce((sum, game) => sum + (game.me.quadraKills ?? 0), 0),
      penta: games.reduce((sum, game) => sum + (game.me.pentaKills ?? 0), 0),
    },
  }
}
