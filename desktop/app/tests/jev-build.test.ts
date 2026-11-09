import { describe, expect, it } from 'vitest'
import type { BuildOptions, ItemOption } from '~/utils/sources/model'
import type { JevOption } from '~/utils/jev-build'
import { closestCore, coreSlot, damageKind, firstSlots, itemEffect, laidBuild, laterSlot, measuredPool, plainAbility, reliable, roomFor, standardCore, startingSets, statsPool } from '~/utils/jev-build'
import { withItemStats } from '~/utils/jev-item-stats'

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

describe('the starting sets and the boots', () => {
  const consumable = (id: number) => [2003, 2031, 2055].includes(id)
  const set = (itemIds: number[], games: number, winRate = 0.5) => ({ itemIds, games, winRate, pickRate: 0 })

  it('reads sets that differ only by potions as one start, the most played shown', () => {
    const sets = startingSets([set([1055, 2003], 14835, 0.525), set([1055], 2442, 0.57), set([1054, 2003], 9414)], consumable)
    expect(sets.map(entry => [entry.itemIds, entry.games])).toEqual([[[1055, 2003], 17277], [[1054, 2003], 9414]])
    expect(sets[0]!.winRate).toBeCloseTo((0.525 * 14835 + 0.57 * 2442) / 17277)
  })

  it('takes no set of potions alone for a start while another holds an item (Blitz leaves out a support\'s World Atlas)', () => {
    expect(startingSets([set([2003, 2003], 9000), set([3865, 2003, 2003], 6066)], consumable).map(entry => entry.itemIds)).toEqual([[3865, 2003, 2003]])
  })

  it('takes no start without the support item where the most played holds it (Blitz\'s Ruby Crystal on a support Tahm Kench)', () => {
    expect(startingSets([set([3865, 2003, 2003], 6066, 0.5), set([1028, 2003], 47, 0.6)], consumable).map(entry => entry.itemIds)).toEqual([[3865, 2003, 2003]])
    expect(startingSets([set([1055, 2003], 900), set([1028, 2003], 47)], consumable)).toHaveLength(2)
  })

  it('offers no boots to a champion that plays without, nor their timing', () => {
    const yuumi = { ...optionsOf([m(800, [3504])]), boots: [m(198, [3158])], games: 8774 }
    expect(firstSlots(yuumi, names, consumable).map(slot => slot.name)).not.toContain('boots')
    expect(firstSlots(yuumi, names, consumable).map(slot => slot.name)).not.toContain('bootsAfter')
  })

  it('leaves the support item a slot of the six', () => {
    expect(roomFor([3865, 2003])).toBe(5)
    expect(roomFor([1055, 2003])).toBe(6)
  })
})

describe('the core item by item', () => {
  const options = optionsOf([m(600, [6692, 3142, 6694]), m(300, [6692, 6676, 3142]), m(200, [3142, 6692, 3814])])

  it('makes each place of the core a slot of the items measured there, games added up, and nothing else: the draft\'s answers come after it', () => {
    const first = coreSlot(options, 0, [], names)!
    expect([first.name, first.lane, first.place]).toEqual(['item1', true, 1])
    expect(first.options.map(option => [option.itemIds[0], option.games])).toEqual([[6692, 900], [3142, 200]])
    const second = coreSlot(options, 1, [], names)!
    expect([second.name, second.lane, second.place]).toEqual(['item2', false, 2])
    expect(second.options.map(option => [option.itemIds[0], !!option.situational])).toEqual([[3142, false], [6676, false], [6692, false]])
  })

  it('reads each place after the items chosen before it: in their order, else in any order, else every core where those are a rumour (Hexgate, LoLDraftAI)', () => {
    // After 6692: what 6692's players build second, its shares among them.
    expect(coreSlot(options, 1, [6692], names)!.options.map(option => [option.itemIds[0], option.games, option.pickRate])).toEqual([[3142, 600, 600 / 900], [6676, 300, 300 / 900]])
    expect(coreSlot(options, 1, [3142], names)!.options.map(option => option.itemIds[0])).toEqual([6692])
    expect(coreSlot(options, 2, [6692, 3142], names)!.options.map(option => option.itemIds[0])).toEqual([6694])
    // No core starts with 6676 then 6692: the one holding both first, in another order.
    expect(coreSlot(options, 2, [6676, 6692], names)!.options.map(option => option.itemIds[0])).toEqual([3142])
    // Under 30 games behind the items chosen: every core speaks.
    const thin = optionsOf([m(600, [6692, 3142, 6694]), m(20, [3071, 6676, 3142])])
    expect(coreSlot(thin, 1, [3071], names)!.options.map(option => option.itemIds[0])).toEqual([3142, 6676])
  })

  it('opens no place of the core a source did not measure: cores carrying the boots run two items, whatever answers the draft', () => {
    const withBoots = optionsOf([m(600, [6692, 3047, 6610]), m(300, [3047, 6692, 3161])])
    expect([0, 1, 2].map(index => coreSlot(withBoots, index, [], names)?.name ?? null)).toEqual(['item1', 'item2', null])
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

  it('offers no answer of the other kind of damage than the core\'s: no Zhonya\'s Hourglass on a build of attack damage', () => {
    const core = m(900, [3153, 6672])
    const options = optionsOf([core], () => [{ slot: 4, options: [m(300, [3031])] }])
    const tags: Record<number, string[]> = { 3157: ['Armor', 'SpellDamage'], 3026: ['Armor', 'Damage'], 3091: ['SpellBlock', 'AttackSpeed'] }
    const suits = (id: number) => damageKind(tags[id] ?? []) !== 'ap'
    const slot = laterSlot(options, core, 4, [3153, 6672], names, { pool: [m(900, [3157]), m(800, [3026]), m(700, [3091])], answersDraft: id => id !== 3031, suits })!
    expect(slot.options.map(option => option.itemIds[0])).toEqual([3031, 3026, 3091])
    expect([damageKind(['Damage', 'AttackSpeed', 'SpellDamage']), damageKind(['Health', 'Armor']), damageKind(['SpellDamage'])]).toEqual([null, null, 'ap'])
  })

  it('offers nothing the inventory cannot hold beside the build: a second Lifeline or Last Whisper item', () => {
    const core = m(900, [3142, 3053])
    const options = optionsOf([core], () => [{ slot: 4, options: [m(300, [3156]), m(250, [3031]), m(200, [3036])] }])
    const slot = laterSlot(options, core, 4, [3142, 3053, 6694], names, { pool: [m(500, [3071])], answersDraft: () => true })!
    expect(slot.options.map(option => option.itemIds[0])).toEqual([3031])
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
    expect(annotated!.options.map(option => [option.wpa, option.wpaGames, option.vsWpa, option.vsGames])).toEqual([[-0.01, 200, null, 0], [0.02, 200, 0.05, 90]])
    expect(annotated!.options[0]).toMatchObject({ slotWpa: null, slotGames: 0, pathWpa: null, pathGames: 0 })
  })

  it('annotates them with what Blitz measured at the slot\'s place of the build and after the items held before it', () => {
    const slot = { name: 'item2', kind: 'item' as const, lane: false, options: [{ key: 'o0', itemIds: [3031], label: 'Infinity Edge', games: 400, pickRate: 0.3, winRate: 0.5 }] }
    const [annotated] = withItemStats([slot], new Map([[3031, stat(0.014, 36000)]]), new Map(), { slot: new Map([[3031, stat(0.002, 31897)]]), path: new Map([[3031, stat(0.001, 18758)]]) })
    expect(annotated!.options[0]).toMatchObject({ wpa: 0.014, wpaGames: 36000, slotWpa: 0.002, slotGames: 31897, pathWpa: 0.001, pathGames: 18758 })
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
