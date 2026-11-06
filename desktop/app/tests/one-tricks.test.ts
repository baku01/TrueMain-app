import { describe, expect, it } from 'vitest'
import type { OneTrick, OneTrickSource } from '../app/utils/sources/one-tricks'
import { firstOneTricks, oneTrickOrder } from '../app/utils/sources/one-tricks'

/** Which source a champion's one-tricks are read from, and what happens when it fails or lists no one. */
const player = (gameName: string): OneTrick => ({
  gameName, tagLine: 'EUW', platformId: 'EUW1', profileIconId: null, tier: 'MASTER', division: 'I', leaguePoints: 500, score: 0.6, games: 40, share: 0.9, winRate: 0.55,
})

function readers(answers: Partial<Record<OneTrickSource, OneTrick[] | Error>>) {
  const asked: OneTrickSource[] = []
  const reader = (source: OneTrickSource) => async () => {
    asked.push(source)
    const answer = answers[source]
    if (answer instanceof Error) throw answer
    return answer ?? []
  }
  return { asked, readers: { truemain: reader('truemain'), blitz: reader('blitz') } }
}

describe('oneTrickOrder', () => {
  it('asks TrueMain first only when it is the pick, Blitz after it', () => {
    expect(oneTrickOrder('truemain')).toEqual(['truemain', 'blitz'])
  })

  it('asks Blitz alone for every other pick: none of them lists one-tricks, and the shell refuses TrueMain then', () => {
    for (const picked of ['blitz', 'opgg', 'lolalytics', 'tencent'] as const) expect(oneTrickOrder(picked)).toEqual(['blitz'])
  })
})

describe('firstOneTricks', () => {
  it('keeps the picked source\'s players when it lists some', async () => {
    const { asked, readers: all } = readers({ truemain: [player('Ehmamacita')], blitz: [player('Other')] })
    const answer = await firstOneTricks(['truemain', 'blitz'], all, 266, 'TOP', null)
    expect(answer).toEqual({ source: 'truemain', players: [player('Ehmamacita')] })
    expect(asked).toEqual(['truemain'])
  })

  it('passes to Blitz when TrueMain fails', async () => {
    const { asked, readers: all } = readers({ truemain: new Error('offline'), blitz: [player('Lvkaszek32')] })
    expect(await firstOneTricks(['truemain', 'blitz'], all, 266, 'TOP', null)).toEqual({ source: 'blitz', players: [player('Lvkaszek32')] })
    expect(asked).toEqual(['truemain', 'blitz'])
  })

  it('passes to Blitz when TrueMain lists no one', async () => {
    const { readers: all } = readers({ truemain: [], blitz: [player('Yagi')] })
    expect((await firstOneTricks(['truemain', 'blitz'], all, 266, 'TOP', null)).source).toBe('blitz')
  })

  it('answers the first source that answered, empty, when no one lists anyone', async () => {
    const { readers: all } = readers({ truemain: [], blitz: new Error('down') })
    expect(await firstOneTricks(['truemain', 'blitz'], all, 266, 'TOP', null)).toEqual({ source: 'truemain', players: [] })
  })

  it('fails with the last failure when every source failed', async () => {
    const { readers: all } = readers({ truemain: new Error('offline'), blitz: new Error('down') })
    await expect(firstOneTricks(['truemain', 'blitz'], all, 266, 'TOP', null)).rejects.toThrow('down')
  })
})
