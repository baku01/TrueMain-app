import { describe, expect, it } from 'vitest'
import { parseJunglePaths } from '~/utils/sources/opgg-jungle'

/** The page's server payload as op.gg sends it: JSON text inside an escaped script string. */
const push = (json: string) => `<script>self.__next_f.push([1,${JSON.stringify(json)}])</script>`
const side = (team: string, routes: [string[], number][]) =>
  `{"teamName":"${team}","data":{"team_key":"${team}","routes":[${routes.map(([route, play], index) => `{"route":${JSON.stringify(route)},"play":${play},"rank":${index + 1}}`).join(',')}],"play":${routes.reduce((sum, [, play]) => sum + play, 0) + 10},"rate":{"team_key":"${team}","blue":27,"red":10,"raptors":70}}}`

describe('op.gg jungle paths', () => {
  it('reads each side\'s clears from the page\'s payload, split across its chunks, most run first', () => {
    const blue = side('BLUE', [[['BLUE', 'GROMP', 'WOLVES', 'RAPTORS', 'RED', 'KRUG'], 30], [['RAPTORS', 'RED', 'KRUG', 'WOLVES', 'BLUE', 'GROMP'], 60]])
    const red = side('RED', [[['RAPTORS', 'RED', 'KRUG', 'WOLVES', 'BLUE', 'GROMP'], 90]])
    const html = `<html>${push(`51:["$","div",null,{"children":[["$","$L52","s-0",${blue.slice(0, 80)}`)}${push(`${blue.slice(80)}],["$","$L52","s-1",${red}]]}]`)}</html>`
    const sides = parseJunglePaths(html)
    expect(sides.map(entry => entry.side)).toEqual(['BLUE', 'RED'])
    expect(sides[0]!.games).toBe(100)
    expect(sides[0]!.routes.map(route => [route.camps[0], route.share])).toEqual([['RAPTORS', 0.6], ['BLUE', 0.3]])
    expect(sides[0]!.starts).toEqual([{ camp: 'RAPTORS', share: 0.6 }, { camp: 'BLUE', share: 0.3 }])
  })

  it('reads nothing from a page that holds no paths', () => {
    expect(parseJunglePaths('<html><body>no data</body></html>')).toEqual([])
    expect(parseJunglePaths(push('{"team_key":"BLUE","routes":[{"route":["NOT_A_CAMP"],"play":3}]'))).toEqual([])
  })
})
