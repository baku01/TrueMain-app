import { describe, expect, it } from 'vitest'
import type { BuildOptions, ItemOption } from '~/utils/sources/model'
import type { JevOption } from '~/utils/jev-build'
import { closestCore, coreSlots, itemEffect, laidBuild, laterSlot, measuredPool, plainAbility, reliable, standardCore, statsPool, withItemStats } from '~/utils/jev-build'

const m = (games: number, itemIds: number[]): ItemOption => ({ games, winRate: 0.5, pickRate: 0.1, itemIds })
const names = { item: (id: number) => `#${id}`, perk: String, style: String, spell: String }
const optionsOf = (cores: ItemOption[], followUps: BuildOptions['followUps'] = () => []): BuildOptions =>
  ({ patch: null, games: 5000, pages: [], shares: null, spells: [], starters: [], boots: [], skills: [], cores, followUps })

describe('reliable', () => {
  it('leaves out what the sources barely saw, keeping two to compare', () => {
    const measure = (games: number) => ({ games, pickRate: 0, winRate: 0.5 })
    expect(reliable([measure(12), measure(400), measure(45)]).map(entry => entry.games)).toEqual([400, 45])
    expect(reliable([measure(16), measure(14), measure(12)]).map(entry => entry.games)).toEqual([16, 14])
  })
})

describe('texts for Jev', () => {
  it('reads an item\'s stats and effects out of Data Dragon, without its markup', () => {
    const effect = itemEffect({
      description: '<mainText><stats><attention>350</attention> Health<br><attention>55</attention> Magic Resist</stats><br><br><passive>Steadfast</passive><br>Taking magic damage grants stacks.</mainText>',
      plaintext: 'Grants magic resist and health',
    })
    expect(effect).toBe('Stats: 350 Health, 55 Magic Resist. Steadfast, Taking magic damage grants stacks. Grants magic resist and health')
  })

  it('cuts a long ability to its limit', () => {
    expect(plainAbility('a'.repeat(50), 10)).toBe(`${'a'.repeat(9)}…`)
  })
})

describe('the core item by item', () => {
  const options = optionsOf([m(600, [6692, 3142, 6694]), m(300, [6692, 6676, 3142]), m(200, [3142, 6692, 3814])])

  it('makes each place of the core a slot of the items measured there, games added up, the draft\'s answers from the second on', () => {
    const slots = coreSlots(options, names, { pool: [m(108, [3071])], answersDraft: id => id === 3071 })
    expect(slots.map(slot => [slot.name, slot.lane])).toEqual([['item1', true], ['item2', false], ['item3', false]])
    expect(slots[0]!.options.map(option => [option.itemIds[0], option.games])).toEqual([[6692, 900], [3142, 200]])
    expect(slots[1]!.options.map(option => [option.itemIds[0], !!option.situational])).toEqual([[3142, false], [6676, false], [6692, false], [3071, true]])
  })

  it('follows the measured core closest to the one chosen, and knows the most played', () => {
    expect(closestCore(options.cores, [6692, 6676, 3071])?.games).toBe(300)
    expect(standardCore(options.cores)).toEqual([6692, 3142, 6694])
  })
})

describe('situational answers', () => {
  it('adds to a later slot the champion\'s measured items that answer the draft, none already held', () => {
    const core = m(900, [3142, 6691])
    const options = optionsOf([core], () => [{ slot: 4, options: [m(300, [6694]), m(200, [3814])] }, { slot: 5, options: [m(150, [3071])] }])
    const slot = laterSlot(options, core, 4, [3142, 6691], names, { pool: measuredPool(options), answersDraft: id => id === 3071 || id === 3142 })!
    expect(slot.options.map(option => [option.itemIds[0], !!option.situational])).toEqual([[6694, false], [3814, false], [3071, true]])
  })
})

describe('win probability added', () => {
  const stat = (wpa: number, games = 200) => ({ games, winRate: 0.5, wpa })

  it('annotates each item option with its lane and matchup WPA', () => {
    const slot = { name: 'item4', kind: 'item' as const, lane: false, options: [
      { key: 'o0', itemIds: [6694], label: 'Serylda', games: 400, pickRate: 0.3, winRate: 0.5 },
      { key: 'o1', itemIds: [3071], label: 'Black Cleaver', games: 400, pickRate: 0.2, winRate: 0.5 },
    ] }
    const [annotated] = withItemStats([slot], new Map([[6694, stat(-0.01)], [3071, stat(0.02)]]), new Map([[3071, stat(0.05, 90)]]))
    expect(annotated!.options.map(option => [option.wpa, option.vsWpa, option.vsGames])).toEqual([[-0.01, null, 0], [0.02, 0.05, 90]])
  })

  it('joins the item stats to the measured pool, completed items only', () => {
    const pool = statsPool(new Map([[3071, stat(0.02, 108)], [1036, stat(0.1, 500)]]), [m(300, [6694])], id => id !== 1036)
    expect(pool.map(option => option.itemIds[0])).toEqual([6694, 3071])
  })
})

describe('laidBuild', () => {
  it('lays the boots where their timing falls, the later items after the core', () => {
    const option = (fields: Partial<JevOption>): JevOption => ({ key: 'o0', label: '', itemIds: [], games: 100, pickRate: 0.1, winRate: 0.5, ...fields })
    const picks: Record<string, JevOption> = { boots: option({ itemIds: [3047] }), bootsAfter: option({ after: 1 }), spells: option({ spellIds: [4, 12] }) }
    const build = laidBuild(slot => picks[slot] ?? null, [6692, 3142, 6694], [3071])
    expect(build.order).toEqual([6692, 3047, 3142, 6694, 3071])
    expect(build.summonerSpells).toMatchObject({ spell1Id: 4, spell2Id: 12 })
    expect(build.runePage).toBeNull()
  })
})
