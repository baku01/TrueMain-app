import { describe, expect, it } from 'vitest'
import { previousPatch, recentPatches } from '~/utils/data-window'

describe('previousPatch', () => {
  it('steps back one patch', () => {
    expect(previousPatch('16.22.1')).toBe('16.21')
    expect(previousPatch('16.10')).toBe('16.9')
  })
  it('has none before a year\'s first patch', () => {
    expect(previousPatch('17.1.1')).toBeNull()
  })
})

describe('recentPatches', () => {
  it('lists the live patch and the ones before it', () => {
    expect(recentPatches('16.22.1', 3)).toEqual(['16.22', '16.21', '16.20', '16.19'])
    expect(recentPatches('17.2.1', 10)).toEqual(['17.2', '17.1'])
  })
})
