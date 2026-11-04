import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StaticItemData } from '#shared/types/static-data'
import type { Provider } from '~/utils/sources'

const item = (id: number, totalGold: number, from: number[] = [], tags = ['SpellDamage']): StaticItemData => ({ id, name: String(id), iconUrl: '', totalGold, from, tags } as StaticItemData)
const ITEMS: Record<number, StaticItemData> = Object.fromEntries([
  item(1001, 300, [], ['Boots']), item(3020, 1100, [1001], ['Boots']), item(1052, 400), item(1058, 1200),
  item(3118, 2900, [1052]), item(4645, 3200), item(3089, 3600, [1058]), item(3157, 3250), item(3165, 2850),
  item(3004, 2900), item(3042, 2900),
].map(entry => [entry.id, entry]))

vi.mock('~/utils/sources/champions', () => ({ championTraits: async () => new Map(), liveItems: async () => ITEMS }))
vi.mock('~/utils/blitz/pro', () => ({ readProMatches: async () => [] }))

const measure = { games: 100, pickRate: 0.5, winRate: 0.5 }
const provider = {
  options: async () => ({
    patch: '16.22', games: 1000, pages: [], shares: null, spells: [], starters: [], skills: [],
    boots: [{ ...measure, itemIds: [3020] }],
    cores: [{ ...measure, itemIds: [3118, 4645, 3089] }],
    followUps: () => [{ slot: 4, options: [{ ...measure, itemIds: [3157] }] }],
  }),
} as unknown as Provider

const { nextItemFromSource } = await import('~/utils/sources/next-item')
let champion = 1
const ask = (items: number[]) => nextItemFromSource(provider, champion, { position: 'MIDDLE', items, allies: [], enemies: [] })
const states = (answer: Awaited<ReturnType<typeof ask>>) => answer.order.map(step => `${step.itemId}:${step.state[0]}`).join(' ')

describe('the overlay\'s next item, read from a source', () => {
  beforeEach(() => { champion++ })

  it('walks the build in order', async () => {
    expect(states(await ask([]))).toBe('3118:N 3020:U 4645:U 3089:U 3157:U')
    expect(states(await ask([3118, 3020]))).toBe('3118:C 3020:C 4645:N 3089:U 3157:U')
  })

  it('marks an item bought out of order, and keeps the one skipped next', async () => {
    const answer = await ask([4645])
    expect(states(answer)).toBe('3118:N 3020:U 4645:C 3089:U 3157:U')
    expect(answer.build?.candidates[0]?.itemId).toBe(3118)
  })

  it('gives an item off the build a slot of it, done, the last one to buy making room', async () => {
    expect(states(await ask([3118, 3165]))).toBe('3118:C 3020:N 3165:C 4645:U 3089:U')
  })

  it('does not count components as a slot, and counts no sold item', async () => {
    expect(states(await ask([1052, 1058]))).toBe('3118:N 3020:U 4645:U 3089:U 3157:U')
  })
})
