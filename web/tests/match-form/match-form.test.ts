import { describe, expect, it } from 'vitest'
import type { FormTile } from '#common/utils/match-form'
import { MIN_GAMES_FOR_DELTA, formTiles } from '#common/utils/match-form'
import type { MatchSummaryResponse, MatchSummarySelf } from '~~/shared/types/matches'

/**
 * The four form tiles the profile opens on, on the site and in the app alike:
 * win rate, KDA, TrueMain's score and CS/min.
 *
 * What the tiles must get right is the move, not the average: under
 * `MIN_GAMES_FOR_DELTA` games the newest five are most of the sample, so no move
 * is read at all; a flat run shows none either; and a lower KDA reads as worse.
 */

/** One thirty-minute game; the self line the tiles read, every other field inert. */
function match(index: number, self: Partial<MatchSummarySelf> = {}, gameDurationSeconds = 1800): MatchSummaryResponse {
  return {
    matchId: `EUW1_${index}`,
    queueId: 420,
    gameMode: 'CLASSIC',
    gameStartTimeUtc: '2026-10-01T12:00:00Z',
    gameDurationSeconds,
    self: {
      championId: 103,
      championLevel: 18,
      summoner1Id: 4,
      summoner2Id: 14,
      primaryStyleId: 8100,
      subStyleId: 8000,
      keystoneId: 8112,
      kills: 5,
      deaths: 4,
      assists: 6,
      cs: 180,
      killParticipation: 0.5,
      items: [0, 0, 0, 0, 0, 0],
      trinketItemId: 3340,
      roleBoundItemId: 0,
      teamId: 100,
      position: 'MIDDLE',
      win: true,
      lpDelta: null,
      performanceScore: 50,
      placement: 5,
      isMvp: false,
      isAce: false,
      ...self,
    },
    participants: [],
  }
}

/** Newest first, as every history is served: the `recent` games' deaths, then the `older` ones'. */
function deathsRun(recent: number[], older: number[]): MatchSummaryResponse[] {
  return [...recent, ...older].map((deaths, index) => match(index, { deaths }))
}

const tile = (tiles: FormTile[], key: FormTile['key']) => tiles.find(entry => entry.key === key)!

describe('formTiles', () => {
  it('has no tile without a game', () => {
    expect(formTiles([])).toEqual([])
  })

  it('reads each tile as the average over the games, its series oldest first', () => {
    const tiles = formTiles([
      match(1, { kills: 10, deaths: 0, assists: 2, cs: 300, killParticipation: 0.6 }),
      match(2, { kills: 2, deaths: 2, assists: 2, cs: 150, killParticipation: 0.4 }, 1500),
    ])

    expect(tiles.map(entry => entry.key)).toEqual(['winRate', 'kda', 'score', 'csPerMinute'])
    expect(tile(tiles, 'winRate').value).toBe('100%')
    // A deathless game counts as one death in its KDA: 12 / 1, never a division by zero.
    expect(tile(tiles, 'kda')).toMatchObject({ value: '7.00', series: [2, 12] })
    expect(tile(tiles, 'score').value).toBe('50')
    // 150 CS over 25 minutes, then 300 over 30.
    expect(tile(tiles, 'csPerMinute')).toMatchObject({ value: '8.0', series: [6, 10] })
  })

  it('reads no move on a sample shorter than MIN_GAMES_FOR_DELTA', () => {
    const run = deathsRun([1, 1, 1, 1, 1], [9, 9])
    expect(run.length).toBeLessThan(MIN_GAMES_FOR_DELTA)
    expect(formTiles(run).map(entry => entry.delta)).toEqual([null, null, null, null])
  })

  it('reads the newest five games against the whole sample from MIN_GAMES_FOR_DELTA on', () => {
    // Eight games: three wins of the newest five against five of eight.
    const run = [true, true, true, false, false, true, true, false].map((win, index) => match(index, { win }))
    expect(run).toHaveLength(MIN_GAMES_FOR_DELTA)
    expect(tile(formTiles(run), 'winRate')).toMatchObject({
      value: '63%',
      delta: { direction: 'down', good: false },
    })
  })

  it('reads a higher KDA as good, a lower one as bad', () => {
    expect(tile(formTiles(deathsRun([2, 2, 2, 2, 2], [6, 6, 6])), 'kda').delta).toMatchObject({ direction: 'up', good: true })
    expect(tile(formTiles(deathsRun([6, 6, 6, 6, 6], [2, 2, 2])), 'kda').delta).toMatchObject({ direction: 'down', good: false })
  })

  it('reads the score over graded games only', () => {
    const tiles = formTiles([match(1, { performanceScore: 80 }), match(2, { performanceScore: 0 }), match(3, { performanceScore: 60 })])
    expect(tile(tiles, 'score')).toMatchObject({ value: '70', series: [60, 80] })
  })

  it('reads no move on a flat run', () => {
    expect(formTiles(deathsRun([4, 4, 4, 4, 4], [4, 4, 4])).map(entry => entry.delta)).toEqual([null, null, null, null])
  })

  it('sets each tile against its tier median where the benchmark has one, and none elsewhere', () => {
    const reference = { tier: 'DIAMOND', position: 'MIDDLE', samples: 1234, medians: { kda: 2.9, csPerMinute: 7.4 } }
    const tiles = formTiles(deathsRun([4, 4, 4], [4]), reference)

    expect(tile(tiles, 'kda').reference).toEqual({
      text: '2.90',
      tier: 'DIAMOND',
      hint: 'Median KDA of Diamond players on Mid: 2.90 (1,234 games)',
    })
    expect(tile(tiles, 'csPerMinute').reference?.text).toBe('7.4')
    expect(tile(tiles, 'winRate').reference).toBeNull()
    expect(tile(tiles, 'score').reference).toBeNull()
  })

  it('has no reference without a benchmark', () => {
    expect(formTiles(deathsRun([4, 4, 4], [4])).map(entry => entry.reference)).toEqual([null, null, null, null])
  })
})
