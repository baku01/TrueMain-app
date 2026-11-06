import { afterEach, describe, expect, it } from 'vitest'
import type { BuildOption } from '../app/types/build'
import { MAX_PREVIOUS_BUILDS, PREVIOUS_BUILDS_KEY, parsePreviousBuilds, readPreviousBuild, rememberBuild, storePreviousBuild } from '../app/utils/previous-build'

/** The player's previous build on a champion and lane, kept on this machine. */
const option = (firstItemId: number, key = `lane-${firstItemId}`): BuildOption => ({
  key, core: { runePage: null } as BuildOption['core'], firstItemId, keystoneId: 8010, buildTree: [], games: 10, winRate: 0.5,
})

afterEach(() => localStorage.removeItem(PREVIOUS_BUILDS_KEY))

describe('previous builds', () => {
  it('keeps the last build stored per champion and lane, as the list\'s `previous` row', () => {
    storePreviousBuild(localStorage, 266, 'top', option(6610), 1)
    storePreviousBuild(localStorage, 266, 'TOP', option(6692), 2)
    storePreviousBuild(localStorage, 266, 'MIDDLE', option(3071), 3)
    expect(readPreviousBuild(localStorage, 266, 'TOP')).toMatchObject({ key: 'previous', firstItemId: 6692 })
    expect(readPreviousBuild(localStorage, 266, 'MIDDLE')?.firstItemId).toBe(3071)
    expect(readPreviousBuild(localStorage, 103, 'MIDDLE')).toBeNull()
  })

  it('drops the oldest past the cap', () => {
    let builds = {}
    for (let index = 0; index <= MAX_PREVIOUS_BUILDS; index++) builds = rememberBuild(builds, `${index}:TOP`, option(index), index)
    expect(Object.keys(builds)).toHaveLength(MAX_PREVIOUS_BUILDS)
    expect(builds).not.toHaveProperty('0:TOP')
    expect(builds).toHaveProperty(`${MAX_PREVIOUS_BUILDS}:TOP`)
  })

  it('reads nothing from a value that is not one', () => {
    expect(parsePreviousBuilds('not json')).toEqual({})
    expect(parsePreviousBuilds('[1, 2]')).toEqual({})
    expect(parsePreviousBuilds(JSON.stringify({ '1:TOP': { savedAt: 1, option: { firstItemId: 'x' } }, '2:TOP': { savedAt: 1, option: option(1) } }))).toEqual({
      '2:TOP': { savedAt: 1, option: option(1) },
    })
  })

  it('survives a storage that refuses', () => {
    const refusing = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') } }
    expect(() => storePreviousBuild(refusing, 266, 'TOP', option(1))).not.toThrow()
    expect(readPreviousBuild(refusing, 266, 'TOP')).toBeNull()
  })
})
