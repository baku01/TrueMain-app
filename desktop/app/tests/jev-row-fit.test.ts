import { describe, expect, it } from 'vitest'
import type { BuildOption } from '~/types/build'
import type { ItemRead } from '~/utils/jev-read'
import type { Needs } from '~/utils/jev-recommend'
import { ROW_WEIGHTS, rowFit, rowFits, rowItems, rowWeights } from '~/utils/jev-row-fit'

const read = (fields: Partial<ItemRead> = {}): ItemRead => ({ antiHeal: 0, tenacity: 0, antiBurst: 0, vsAutos: 0, vsTanks: 0, kit: 0.5, ...fields })
/** An enemy team that heals a lot, deals both kinds of damage evenly and nothing else stands out. */
const needs: Needs = { physical: 0.5, magic: 0.5, cc: 0, heal: 1, burst: 0, autos: 0, tanks: 0 }

const EXECUTIONER = 3123
const SUNDERED = 6610
const STERAK = 3053
const PLATED = 3047
const reads = new Map<number, ItemRead>([[EXECUTIONER, read({ antiHeal: 1 })], [SUNDERED, read()], [STERAK, read({ antiBurst: 0.4 })], [PLATED, read()]])
const tags = (id: number) => (id === PLATED ? ['Armor', 'Boots'] : ['Damage'])

const row = (key: string, path: number[], boots: number[] = []): BuildOption => ({
  key,
  core: { itemPath: { itemIds: path, games: 1, pickRate: 1, winRate: 0.5 }, boots: boots.length ? { itemIds: boots, games: 1, pickRate: 1, winRate: 0.5 } : null, starterItems: null, summonerSpells: null, skillOrder: null, runePage: null },
  firstItemId: path[0] ?? 0,
  keystoneId: null,
  buildTree: [],
  games: 100,
  winRate: 0.5,
})

describe('a build row read against the draft', () => {
  it('counts its path and its boots', () => {
    expect(rowItems(row('lane-a', [SUNDERED, STERAK], [PLATED]))).toEqual([SUNDERED, STERAK, PLATED])
  })

  it('says how its items answer the needs, and which item answers the draft on its own', () => {
    const fit = rowFit([SUNDERED, EXECUTIONER], needs, id => reads.get(id), tags)!
    expect(fit.score).toBeGreaterThan(0)
    expect(fit.answers[0]?.need).toBe('heal')
    expect(fit.answering).toEqual([EXECUTIONER])
  })

  it('weighs its items by their place as LoLTheory weighs a build: the first most, the boots as boots', () => {
    expect(ROW_WEIGHTS).toEqual({ items: [25, 17.5, 12.5, 7.5, 2.5], boots: 5 })
    expect(rowWeights([SUNDERED, STERAK, PLATED])).toEqual([25, 17.5, 5])
    expect(rowWeights([1, 2, 3, 4, 5, 6])).toEqual([25, 17.5, 12.5, 7.5, 2.5, 2.5])
    // Grievous Wounds first answers more of a healing team than Grievous Wounds fifth.
    const first = rowFit([EXECUTIONER, SUNDERED, SUNDERED, SUNDERED, SUNDERED], needs, id => reads.get(id), tags)!
    const fifth = rowFit([SUNDERED, SUNDERED, SUNDERED, SUNDERED, EXECUTIONER], needs, id => reads.get(id), tags)!
    expect(first.score).toBeGreaterThan(fifth.score)
  })

  it('is never guessed: an item Jev did not read leaves the row unmarked', () => {
    expect(rowFit([SUNDERED, 9999], needs, id => reads.get(id), tags)).toBeNull()
    expect(rowFit([], needs, id => reads.get(id), tags)).toBeNull()
  })
})

describe('the rows of a build list', () => {
  it('mark the one that fits best as Jev\'s pick — the previous build too', () => {
    const { fits, best } = rowFits([
      row('lane-bruiser', [SUNDERED, STERAK], [PLATED]),
      row('previous', [SUNDERED, EXECUTIONER]),
      row('lane-unread', [SUNDERED, 9999]),
    ], needs, id => reads.get(id), tags)
    expect([...fits.keys()]).toEqual(['lane-bruiser', 'previous'])
    expect(best).toBe('previous')
  })

  it('pick the first on a tie, and none when no row answers anything', () => {
    const tie = rowFits([row('lane-a', [EXECUTIONER]), row('lane-b', [EXECUTIONER])], needs, id => reads.get(id), tags)
    expect(tie.best).toBe('lane-a')
    const calm: Needs = { physical: 0.5, magic: 0.5, cc: 0, heal: 0, burst: 0, autos: 0, tanks: 0 }
    expect(rowFits([row('lane-a', [SUNDERED])], calm, id => reads.get(id), tags).best).toBeNull()
  })
})
