import { describe, expect, it } from 'vitest'
import { parseMasteryPage } from '~/utils/sources/championmastery'

describe('parseMasteryPage', () => {
  it('reads each row of championmastery.gg\'s table, most points first', () => {
    const row = (id: number, name: string, level: number, points: number, at: number) =>
      `<tr><td><a class="internalLink" href="/champion?champion=${id}">${name}</a></td><td>${level}</td><td data-format-number="${points}" data-value="${points}">${points}</td><td class="collapsible" data-value="5000">5k+</td><td data-format-time="${at}" data-value="${at}" data-toggle="tooltip"></td></tr>`
    const html = `<table><tbody id="tbody"> ${row(81, 'Ezreal', 79, 839072, 2)}${row(51, 'Caitlyn', 87, 922970, 1)}</tbody></table>`
    expect(parseMasteryPage(html)).toEqual([
      { championId: 51, championLevel: 87, championPoints: 922_970, lastPlayTime: 1 },
      { championId: 81, championLevel: 79, championPoints: 839_072, lastPlayTime: 2 },
    ])
  })

  it('reads nothing from a page without the table', () => {
    expect(parseMasteryPage('<html>Summoner not found</html>')).toEqual([])
  })
})
