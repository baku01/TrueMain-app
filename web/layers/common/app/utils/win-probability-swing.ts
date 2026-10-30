import type {
  MatchWinProbability,
  WinProbabilityObjective,
  WinProbabilitySwing,
} from '#shared/types/win-probability'
import type { MatchDetailResponse } from '#shared/types/match-detail'
import { formatPointDelta } from '#shared/utils/deltas'
import { buildWinProbability } from './win-probability-timeline'
import { formatDuration } from './relativeTime'
import { tr } from './i18n'

/**
 * How the post-game curve's turning points read (#1911), shared by the desktop
 * dashboard's match detail and the recording recap. Everything the
 * curve stores reads for team 100; these turn it to the viewer's side.
 */

/** How many turning points are listed. */
export const SWINGS_SHOWN = 5

/**
 * The detail's curve, built from the client's timeline the desktop app attaches;
 * null on the site (the API sends none, #2009) and for a game that gets none.
 */
export function resolveWinProbability(detail: Pick<MatchDetailResponse, 'winProbabilityTimeline'>): MatchWinProbability | null {
  return detail.winProbabilityTimeline ? buildWinProbability(detail.winProbabilityTimeline) : null
}

/** A team-100 chance or delta, read for `teamId`. */
export function forTeam(value: number, teamId: number, kind: 'probability' | 'delta'): number {
  if (teamId === 100) return value
  return kind === 'probability' ? 1 - value : -value
}

/**
 * A swing as signed points, without the unit (the lists say it once): `+7`, `−4`,
 * and one decimal under a point (`+0.6`), where a whole number would round a
 * real if small swing to nothing.
 */
export function formatSwingPoints(delta: number): string {
  return formatPointDelta(delta, { digits: Math.abs(delta * 100) < 0.95 ? 1 : 0, unit: false })
}

/** Game time in milliseconds as `m:ss`. */
export function formatGameClock(ms: number): string {
  return formatDuration(ms / 1000)
}

const LANES: Record<string, string> = { TOP_LANE: 'match.swing.lane.top', MID_LANE: 'match.swing.lane.mid', BOT_LANE: 'match.swing.lane.bot' }
const TOWERS: Record<string, string> = {
  OUTER_TURRET: 'match.swing.tower.outer',
  INNER_TURRET: 'match.swing.tower.inner',
  BASE_TURRET: 'match.swing.tower.base',
  NEXUS_TURRET: 'match.swing.tower.nexus',
}
const DRAKES: Record<string, string> = {
  AIR_DRAGON: 'match.swing.drake.air',
  CHEMTECH_DRAGON: 'match.swing.drake.chemtech',
  EARTH_DRAGON: 'match.swing.drake.mountain',
  MOUNTAIN_DRAGON: 'match.swing.drake.mountain',
  FIRE_DRAGON: 'match.swing.drake.fire',
  HEXTECH_DRAGON: 'match.swing.drake.hextech',
  WATER_DRAGON: 'match.swing.drake.water',
  ELDER_DRAGON: 'match.swing.drake.elder',
}
const MONSTERS: Record<string, string> = {
  BARON_NASHOR: 'match.swing.monster.baron',
  RIFTHERALD: 'match.swing.monster.herald',
  HORDE: 'match.swing.monster.grubs',
  ATAKHAN: 'match.swing.monster.atakhan',
}

/** `name` from the viewer's side: "Your Baron", "Enemy Voidgrubs". */
export function sideLabel(ours: boolean, name: string): string {
  return tr(ours ? 'match.side.yours' : 'match.side.enemy', { name })
}

/** An epic monster's name, as a player says it. */
export function monsterLabel(monsterType: string, monsterSubType: string | null): string {
  if (monsterType === 'DRAGON') return tr((monsterSubType && DRAKES[monsterSubType]) || 'match.swing.drake.plain')
  const key = MONSTERS[monsterType]
  return key ? tr(key) : monsterType
}

/**
 * A turret or an inhibitor in words, from the viewer's side: "Took the outer
 * turret, mid", "Lost the bot inhibitor".
 */
export function structureLabel(
  kind: 'turret' | 'inhibitor',
  building: { ours: boolean, lane: string | null, towerType: string | null },
): string {
  const verb = building.ours ? 'took' : 'lost'
  const laneKey = building.lane ? LANES[building.lane] ?? null : null
  const lane = laneKey ? tr(laneKey) : null
  if (kind === 'inhibitor') {
    return lane
      ? tr(`match.swing.${verb}.inhibitorLane`, { lane })
      : tr(`match.swing.${verb}.inhibitor`)
  }
  const tower = tr((building.towerType && TOWERS[building.towerType]) || 'match.swing.tower.plain')
  return lane
    ? tr(`match.swing.${verb}.towerLane`, { tower, lane })
    : tr(`match.swing.${verb}.tower`, { tower })
}

export interface SwingContext {
  /** The side the viewer reads the game for. */
  perspectiveTeamId: number
  /** A participant's champion name. */
  championName: (participantId: number) => string
}

export interface DescribedSwing {
  /** What happened, from the viewer's side: "Your Ahri killed Zed (+2 assists)", "Enemy Baron". */
  label: string
  /** The event was for the viewer's side. */
  ours: boolean
  /** The change in the viewer's chance, −1..1. */
  delta: number
  /** Kills: the gold the kill gave, when the timeline carries it. */
  gold: number | null
}

/** A turning point in words, from the viewer's side. */
export function describeSwing(swing: WinProbabilitySwing, context: SwingContext): DescribedSwing {
  const ours = swing.teamId === context.perspectiveTeamId
  const sided = (name: string) => sideLabel(ours, name)
  let label: string
  switch (swing.kind) {
    case 'kill': {
      const assists = swing.assists > 0 ? tr(swing.assists > 1 ? 'match.swing.assists.other' : 'match.swing.assists.one', { count: swing.assists }) : ''
      label = tr(ours ? 'match.swing.kill.yours' : 'match.swing.kill.enemy', {
        killer: context.championName(swing.killerId),
        victim: context.championName(swing.victimId),
        assists,
      })
      break
    }
    case 'turret':
    case 'inhibitor':
      label = structureLabel(swing.kind, { ours, lane: swing.lane, towerType: swing.towerType })
      break
    case 'dragon':
      label = sided(monsterLabel('DRAGON', swing.monsterSubType))
      break
    case 'elder':
      label = sided(monsterLabel('DRAGON', 'ELDER_DRAGON'))
      break
    case 'baron':
      label = sided(monsterLabel('BARON_NASHOR', null))
      break
  }
  return {
    label,
    ours,
    delta: forTeam(swing.delta, context.perspectiveTeamId, 'delta'),
    gold: swing.kind === 'kill' ? swing.bounty : null,
  }
}

/** An epic monster in words, from the viewer's side: "Enemy Voidgrubs". */
export function describeObjective(objective: WinProbabilityObjective, perspectiveTeamId: number): string {
  return sideLabel(objective.teamId === perspectiveTeamId, monsterLabel(objective.monsterType, objective.monsterSubType))
}
