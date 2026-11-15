import { describe, expect, it } from 'vitest'
import type { GameParticipant } from '~/types/record'
import { filterRows, gameRows, gameValues } from '~/utils/nerd-stats/features'
import { analyse, MODEL_CANDIDATES, victoryModel } from '~/utils/nerd-stats/analysis'
import { syntheticHistory } from '~/fixtures/synthetic-history'
import { game, MINUTE } from './fixtures'

const participant = (overrides: Partial<GameParticipant>): GameParticipant => ({
  participantId: 1,
  championId: 1,
  teamId: 100,
  position: 'MIDDLE',
  gameName: null,
  tagLine: null,
  win: true,
  kills: 2,
  deaths: 2,
  assists: 2,
  cs: 200,
  goldEarned: 10_000,
  damageToChampions: 15_000,
  visionScore: 20,
  marks: [],
  ...overrides,
})

/** Ten players, the player (id 3) on blue's mid, every one with the same marks but the player and their opponent. */
function scoreboard(): GameParticipant[] {
  const lanes = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
  const mark = (minute: number, gold: number) => ({ minute, gold, cs: minute * 7, xp: minute * 400 })
  return [100, 200].flatMap(teamId => lanes.map((position, index) => {
    const participantId = (teamId === 100 ? 0 : 5) + index + 1
    const marks = participantId === 3
      ? [mark(10, 4_000), { minute: 15, gold: 6_500, cs: 120, xp: 6_300 }]
      : participantId === 8
        ? [mark(10, 3_500), { minute: 15, gold: 5_700, cs: 100, xp: 6_000 }]
        : [mark(10, 3_600), mark(15, 5_800)]
    return participant({ participantId, teamId, position, win: teamId === 100, kills: participantId === 3 ? 5 : 3, goldEarned: participantId === 3 ? 12_000 : 10_000, marks })
  }))
}

describe('a game\'s metrics', () => {
  it('reads the lane against the one opponent and the team against the other team', () => {
    const values = gameValues(game({ participants: scoreboard(), kills: 5, deaths: 2, assists: 7, durationSeconds: 1800, teamKills: 20 }))
    expect(values.goldDiff10).toBe(500)
    expect(values.goldDiff15).toBe(800)
    expect(values.csDiff15).toBe(20)
    expect(values.xpDiff15).toBe(300)
    // Blue: 6 500 + 4 × 5 800; red: 5 700 + 4 × 5 800.
    expect(values.teamGoldDiff15).toBe(800)
    expect(values.killParticipation).toBe(0.6)
    expect(values.kda).toBe(6)
    expect(values.deathsPerMin).toBeCloseTo(2 / 30, 12)
    expect(values.goldShare).toBeCloseTo(12_000 / 52_000, 12)
    // Red's five scored 3 kills each: 15 deaths for blue, 2 of them the player's.
    expect(values.deathShare).toBeCloseTo(2 / 15, 12)
    expect(values.blueSide).toBe(1)
  })

  it('leaves out what the game did not measure instead of reading it as zero', () => {
    const values = gameValues(game({ teamKills: null, teamDamageToChampions: null, participants: [] }))
    expect(values).not.toHaveProperty('killParticipation')
    expect(values).not.toHaveProperty('damageShare')
    expect(values).not.toHaveProperty('goldDiff15')
    expect(values).not.toHaveProperty('performance')
    expect(values).not.toHaveProperty('firstBlood')
    expect(values.kills).toBe(5)
  })

  it('has no lane lead where the lane has no single opponent', () => {
    const board = scoreboard().map(p => (p.participantId === 9 ? { ...p, position: 'MIDDLE' } : p))
    expect(gameValues(game({ participants: board }))).not.toHaveProperty('goldDiff15')
  })
})

describe('the games as rows', () => {
  it('runs oldest first, leaves remakes out, and counts sittings over every game', () => {
    const games = [
      game({ gameId: 4, playedAt: 200 * MINUTE }),
      game({ gameId: 3, playedAt: 70 * MINUTE, remake: true, durationSeconds: 200 }),
      game({ gameId: 2, playedAt: 35 * MINUTE }),
      game({ gameId: 1, playedAt: 0, queueId: 450, mapId: 12 }),
    ]
    const rows = gameRows(games)
    expect(rows.map(row => row.game.gameId)).toEqual([1, 2, 4])
    expect(rows.map(row => row.session)).toEqual([1, 2, 1])
    expect(filterRows(rows, 'rift').map(row => row.game.gameId)).toEqual([2, 4])
    expect(filterRows(rows, 'aram').map(row => row.game.gameId)).toEqual([1])
  })
})

describe('the analysis of a made-up history', () => {
  const template = [game({ gameId: 7_212_000_001, championId: 103, playedAt: Date.UTC(2026, 8, 1, 20) })]
  const rows = filterRows(gameRows(syntheticHistory(template, 200, 'test')), 'rift')
  const report = analyse(rows, () => 3000)

  it('counts the record and its interval', () => {
    expect(report.overview.games).toBe(rows.length)
    expect(report.overview.wins + report.overview.losses).toBe(rows.length)
    expect(report.overview.low).toBeLessThan(report.overview.rate)
    expect(report.overview.high).toBeGreaterThan(report.overview.rate)
  })

  it('finds what the generator planted: deaths come with losing, lane leads with winning', () => {
    const effect = (key: string) => report.metrics.find(entry => entry.definition.key === key)!
    expect(effect('deathsPerMin').effect!.d).toBeLessThan(-0.5)
    expect(effect('deathsPerMin').effect!.high).toBeLessThan(0)
    expect(effect('goldDiff15').effect!.d).toBeGreaterThan(0.3)
    expect(effect('goldDiff15').correlation!.p).toBeLessThan(0.01)
    expect(effect('goldDiff15').q).toBeGreaterThanOrEqual(effect('goldDiff15').correlation!.p)
    // Sorted by the size of the effect, whatever its sign.
    const sizes = report.metrics.map(entry => Math.abs(entry.effect?.d ?? 0))
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a))
  })

  it('fits a formula that predicts out of sample, deaths weighing against', () => {
    const model = report.model!
    expect(model.features.map(feature => feature.key)).toEqual(MODEL_CANDIDATES.slice(0, model.features.length))
    expect(model.features.find(feature => feature.key === 'deathsPerMin')!.beta).toBeLessThan(0)
    expect(model.validation.auc).toBeGreaterThan(0.7)
    expect(model.validation.accuracy).toBeGreaterThan(model.validation.baseline)
    expect(model.converged).toBe(true)
    // The decomposition: each metric's share of the log-odds gap between the average win and loss.
    expect(model.features.reduce((sum, feature) => sum + feature.gap, 0)).toBeGreaterThan(1)
  })

  it('declines to fit on too few games', () => {
    expect(victoryModel(rows.slice(0, 12))).toBeNull()
  })

  it('shrinks each champion toward the player\'s rate', () => {
    const { prior, groups } = report.champions
    for (const group of groups) {
      const raw = group.wins / group.games
      const [low, high] = [Math.min(raw, prior.mean), Math.max(raw, prior.mean)]
      expect(group.shrunk.rate).toBeGreaterThanOrEqual(low - 1e-12)
      expect(group.shrunk.rate).toBeLessThanOrEqual(high + 1e-12)
    }
  })

  it('crosses the metrics in a symmetric rank-correlation matrix', () => {
    const { keys, values } = report.correlation
    expect(keys[0]).toBe('win')
    keys.forEach((_, i) => {
      expect(values[i]![i]).toBe(1)
      keys.forEach((__, j) => expect(values[i]![j]).toBeCloseTo(values[j]![i]!, 12))
    })
  })

  it('reads the sequence and the sittings', () => {
    const { sequence } = report
    expect(sequence.results).toHaveLength(rows.length)
    expect(sequence.runs!.runs).toBeGreaterThan(1)
    expect(sequence.sessions.reduce((sum, entry) => sum + entry.games, 0)).toBe(rows.length)
    expect(sequence.transitions.afterWin.games + sequence.transitions.afterLoss.games).toBe(rows.length - 1)
  })

  it('bins the game\'s length and smooths a curve over it', () => {
    expect(report.duration.bins.reduce((sum, bin) => sum + bin.games, 0)).toBe(rows.length)
    expect(report.duration.curve.length).toBeGreaterThan(10)
    expect(report.duration.bandwidth).toBeGreaterThanOrEqual(2)
    expect(report.hours.reduce((sum, cell) => sum + cell.games, 0)).toBe(rows.length)
  })
})

describe('the page\'s words', () => {
  it('name every metric, timing, family and method in both languages', async () => {
    const { default: dictionary } = await import('~/i18n/nerd-stats')
    const { METRIC_DEFINITIONS } = await import('~/utils/nerd-stats/features')
    const keys = [
      ...METRIC_DEFINITIONS.flatMap(({ key, timing, group }) => [`nerd.metric.${key}`, `nerd.short.${key}`, `nerd.timing.${timing}`, `nerd.group.${group}`]),
      ...['wilson', 'pointBiserial', 'cohen', 'fdr', 'logistic', 'odds', 'cv', 'shrinkage', 'kernel', 'runs', 'spearman', 'bins'].flatMap(key => [`nerd.methods.${key}.title`, `nerd.methods.${key}.body`]),
      ...['solo', 'flex', 'normal', 'aram', 'arena', 'other'].map(key => `nerd.queueGroup.${key}`),
      ...['rift', 'ranked', 'solo', 'flex', 'normal', 'aram', 'all'].map(key => `nerd.queue.${key}`),
      ...['champions', 'positions', 'queues', 'keystones', 'spells', 'items', 'sides'].map(key => `nerd.groups.${key}`),
      ...['afterWin', 'afterLoss', 'afterTwoWins', 'afterTwoLosses'].map(key => `nerd.streaks.${key}`),
      ...['none', 'random', 'streaky', 'alternating'].map(key => `nerd.streaks.verdict.${key}`),
    ]
    for (const language of ['en', 'pt-BR'] as const) {
      expect(keys.filter(key => !(key in dictionary[language]))).toEqual([])
    }
  })
})
