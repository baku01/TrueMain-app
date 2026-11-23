import type { GroupRate, MetricAssociation, NerdReport } from './analysis'
import type { MetricKey } from './features'
import { metricSplit } from './insights'

export type CoachPillar = 'survive' | 'lane' | 'farm' | 'fight' | 'damage' | 'vision'

export interface CoachLever {
  pillar: CoachPillar
  entry: MetricAssociation
  /** Win rate when the player hits the favourable side of this metric. */
  goodRate: number
  /** Win rate when the player lands on the unfavourable side. */
  badRate: number
  /** Always positive: how many win-rate points separate good games from bad ones. */
  gap: number
  /** Player's own mean in wins — used as a realistic personal target. */
  winMean: number
  /** Player's own mean in losses. */
  lossMean: number
  higherIsBetter: boolean
}

export interface CoachChampions {
  climb: GroupRate[]
  avoid: GroupRate[]
}

export interface CoachPositions {
  best: GroupRate
  worst: GroupRate | null
}

export interface CoachPace {
  kind: 'early' | 'mid' | 'late' | 'balanced'
  bestRate: number
  worstRate: number
  bestGames: number
}

export interface CoachRoutine {
  /** Noticeable drop in win rate right after a loss vs right after a win. */
  tiltDrop: { afterWin: number, afterLoss: number, gamesAfterLoss: number } | null
  /** Noticeable drop in win rate in long sessions (3rd/4th+ game in a row). */
  fatigueDrop: { earlyRate: number, lateRate: number, lateGames: number } | null
}

export interface CoachReport {
  levers: CoachLever[]
  champions: CoachChampions
  positions: CoachPositions | null
  pace: CoachPace | null
  routine: CoachRoutine
}

const PILLAR_KEYS: Record<CoachPillar, readonly MetricKey[]> = {
  survive: ['deathsPerMin', 'deaths', 'deathShare'],
  lane: ['goldDiff15', 'csDiff15', 'xpDiff15', 'goldDiff10', 'csDiff10', 'xpDiff10', 'firstBlood'],
  farm: ['csPerMin', 'goldShare'],
  fight: ['killParticipation', 'kda', 'assists', 'kills'],
  damage: ['damagePerMin', 'damageShare'],
  vision: ['visionPerMin', 'visionScore'],
}

const MIN_CHAMP_GAMES = 3
const MIN_AVOID_GAMES = 4
const MIN_POS_GAMES = 3
const MIN_PACE_GAMES = 4

function buildLevers(metrics: readonly MetricAssociation[]): CoachLever[] {
  const byKey = new Map(metrics.map(m => [m.definition.key, m]))
  const levers: CoachLever[] = []

  for (const [pillar, keys] of Object.entries(PILLAR_KEYS) as [CoachPillar, readonly MetricKey[]][]) {
    let best: CoachLever | null = null
    for (const key of keys) {
      const entry = byKey.get(key)
      if (!entry || !entry.effect || entry.definition.higherIsBetter === null) continue
      const split = metricSplit(entry)
      if (!split) continue
      const higher = entry.definition.higherIsBetter
      const goodRate = higher ? split.high.rate : split.low.rate
      const badRate = higher ? split.low.rate : split.high.rate
      const gap = goodRate - badRate
      if (gap < 0.04) continue
      const candidate: CoachLever = {
        pillar,
        entry,
        goodRate,
        badRate,
        gap,
        winMean: entry.effect.meanA,
        lossMean: entry.effect.meanB,
        higherIsBetter: higher,
      }
      if (!best || candidate.gap > best.gap) best = candidate
    }
    if (best) levers.push(best)
  }

  return levers.sort((a, b) => b.gap - a.gap).slice(0, 3)
}

function buildChampions(groups: readonly GroupRate[], overallRate: number): CoachChampions {
  const eligible = groups.filter(g => g.games >= MIN_CHAMP_GAMES)
  const climb = [...eligible]
    .filter(g => g.shrunk.rate >= Math.max(0.5, overallRate))
    .sort((a, b) => b.shrunk.rate - a.shrunk.rate || b.games - a.games)
    .slice(0, 3)

  const climbKeys = new Set(climb.map(c => c.key))
  const avoid = [...groups]
    .filter(g => g.games >= MIN_AVOID_GAMES && !climbKeys.has(g.key) && g.raw.rate <= 0.45)
    .sort((a, b) => a.raw.rate - b.raw.rate || b.games - a.games)
    .slice(0, 2)

  return { climb, avoid }
}

function buildPositions(groups: readonly GroupRate[]): CoachPositions | null {
  const eligible = groups.filter(g => g.games >= MIN_POS_GAMES)
  if (!eligible.length) return null
  const byRate = [...eligible].sort((a, b) => b.shrunk.rate - a.shrunk.rate || b.games - a.games)
  const best = byRate[0]!
  const last = byRate.length >= 2 ? byRate.at(-1)! : null
  const worst = last && last.key !== best.key && best.shrunk.rate - last.shrunk.rate >= 0.04 ? last : null
  return { best, worst }
}

function buildPace(report: NerdReport): CoachPace | null {
  const bins = report.duration.bins
  const bucket = (pred: (from: number, to: number) => boolean) => {
    let games = 0
    let wins = 0
    for (const bin of bins) {
      if (pred(bin.from, bin.to)) {
        games += bin.games
        wins += bin.wins
      }
    }
    return games >= MIN_PACE_GAMES ? { games, rate: wins / games } : null
  }
  const early = bucket((_from, to) => to <= 25)
  const mid = bucket((from, to) => from >= 25 && to <= 35)
  const late = bucket((from) => from >= 35)
  const candidates = [
    early && { kind: 'early' as const, ...early },
    mid && { kind: 'mid' as const, ...mid },
    late && { kind: 'late' as const, ...late },
  ].filter((c): c is { kind: 'early' | 'mid' | 'late', games: number, rate: number } => Boolean(c))

  if (candidates.length < 2) return null
  candidates.sort((a, b) => b.rate - a.rate)
  const best = candidates[0]!
  const worst = candidates.at(-1)!
  if (best.rate - worst.rate < 0.07) {
    return { kind: 'balanced', bestRate: best.rate, worstRate: worst.rate, bestGames: best.games }
  }
  return { kind: best.kind, bestRate: best.rate, worstRate: worst.rate, bestGames: best.games }
}

function buildRoutine(report: NerdReport): CoachRoutine {
  const { afterWin, afterLoss } = report.sequence.transitions
  let tiltDrop: CoachRoutine['tiltDrop'] = null
  if (afterWin.games >= 5 && afterLoss.games >= 5) {
    const rateWin = afterWin.wins / afterWin.games
    const rateLoss = afterLoss.wins / afterLoss.games
    if (rateWin - rateLoss >= 0.08) {
      tiltDrop = { afterWin: rateWin, afterLoss: rateLoss, gamesAfterLoss: afterLoss.games }
    }
  }

  let fatigueDrop: CoachRoutine['fatigueDrop'] = null
  const earlySessions = report.sequence.sessions.filter(s => s.position <= 2)
  const lateSessions = report.sequence.sessions.filter(s => s.position >= 3)
  const earlyGames = earlySessions.reduce((sum, s) => sum + s.games, 0)
  const earlyWins = earlySessions.reduce((sum, s) => sum + s.wins, 0)
  const lateGames = lateSessions.reduce((sum, s) => sum + s.games, 0)
  const lateWins = lateSessions.reduce((sum, s) => sum + s.wins, 0)
  if (earlyGames >= 5 && lateGames >= 5) {
    const earlyRate = earlyWins / earlyGames
    const lateRate = lateWins / lateGames
    if (earlyRate - lateRate >= 0.08) {
      fatigueDrop = { earlyRate, lateRate, lateGames }
    }
  }

  return { tiltDrop, fatigueDrop }
}

/** Synthesizes the full statistical report into a plain, actionable coaching plan. */
export function buildCoachReport(report: NerdReport): CoachReport {
  return {
    levers: buildLevers(report.metrics),
    champions: buildChampions(report.champions.groups, report.overview.rate),
    positions: buildPositions(report.positions.groups),
    pace: buildPace(report),
    routine: buildRoutine(report),
  }
}
