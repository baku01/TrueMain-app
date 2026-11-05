import { describe, expect, it } from 'vitest'
import type { StaticItemData } from '#shared/types/static-data'
import type { JevSlot } from '~/utils/jev-build'
import { closestCore, confidenceOf, coreSlots, decide, draftNeeds, itemEffect, laidBuild, laterSlot, measuredPool, plainAbility, questionsOf, reliable, stateOf, statsPool, withItemStats } from '~/utils/jev-build'

const items = {
  3075: { id: 3075, name: 'Thornmail', tags: ['Armor', 'Health'] },
  3143: { id: 3143, name: 'Randuin', tags: ['Armor', 'Health'] },
  3065: { id: 3065, name: 'Spirit Visage', tags: ['SpellBlock', 'Health'] },
  4401: { id: 4401, name: 'Force of Nature', tags: ['SpellBlock', 'Health'] },
  3071: { id: 3071, name: 'Black Cleaver', tags: ['Damage', 'Health'] },
  6333: { id: 6333, name: 'Death\'s Dance', tags: ['Damage', 'Armor'] },
} as unknown as Record<number, StaticItemData>

const slot = (name: string, ids: number[]): JevSlot => ({
  name,
  instructions: name,
  options: ids.map((id, index) => ({ key: `o${index}`, itemIds: [id], label: items[id]?.name ?? String(id), games: 100, pickRate: 0.1, winRate: 0.5 })),
})
const ask = { champion: 'Darius (Fighter, TOP)', opponent: 'Aatrox (Fighter)', needs: '67% physical damage' }
const answer = (probabilities: Record<string, number>) => ({ type: 'choice' as const, choice: Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0]![0], confidence: 0.6, probabilities })

describe('questionsOf', () => {
  it('asks each slot with more than one option, every option with its measure', () => {
    const questions = questionsOf([slot('item4', [3075, 3065]), slot('item5', [3071])], ask)
    expect(Object.keys(questions)).toEqual(['item4'])
    expect(questions.item4).toMatchObject({ type: 'choice' })
    expect((questions.item4 as { criteria: Record<string, string> }).criteria.o1).toBe('Spirit Visage (100 games, 10.0% pick rate, 50.0% win rate)')
  })
})

describe('decide and laidBuild', () => {
  it('takes Jev\'s pick as it is, keeps the source\'s most played beside it, and lays the boots where Jev times them', () => {
    const core: JevSlot = { name: 'core', instructions: '', options: [{ key: 'o0', itemIds: [3071, 6333], label: 'BC > DD', games: 900, pickRate: 0.4, winRate: 0.5 }, { key: 'o1', itemIds: [3143, 3075], label: 'R > T', games: 50, pickRate: 0.02, winRate: 0.55 }] }
    const boots: JevSlot = { name: 'boots', instructions: '', options: [{ key: 'o0', itemIds: [3047], label: 'Steelcaps', games: 800, pickRate: 0.6, winRate: 0.47 }, { key: 'o1', itemIds: [3111], label: 'Mercury', games: 400, pickRate: 0.3, winRate: 0.5 }] }
    const timing: JevSlot = { name: 'bootsAfter', instructions: '', options: [0, 1, 2].map(after => ({ key: `o${after}`, after, itemIds: [], label: String(after), games: 0, pickRate: 0, winRate: 0 })) }
    const decisions = [
      decide(boots, { boots: answer({ o0: 0.1, o1: 0.9 }) }),
      decide(timing, { bootsAfter: answer({ o0: 0.7, o1: 0.2, o2: 0.1 }) }),
    ]
    expect(decisions.map(entry => [entry.jev.key, entry.standard.key])).toEqual([['o1', 'o0'], ['o0', 'o0']])
    expect(core.options).toHaveLength(2)
    expect(laidBuild(decisions, 'jev', [3143, 3075], [4401]).order).toEqual([3111, 3143, 3075, 4401])
    expect(laidBuild(decisions, 'standard', [3071, 6333], [3065]).order).toEqual([3047, 3071, 6333, 3065])
  })

  it('takes a single option when Jev was not asked', () => {
    expect(decide(slot('item4', [4401]), {}).jev.itemIds).toEqual([4401])
  })
})

describe('stateOf', () => {
  it('tells Jev the lane opponent\'s kit for the laning phase and the rest of the team\'s for later', () => {
    const champion = (id: number, name: string, attack: number, magic: number) => ({ id, alias: name, name, tags: ['Mage'], info: { attack, magic, defense: 3 }, attackRange: 550 })
    const aatrox = { ...champion(266, 'Aatrox', 8, 3), tags: ['Fighter'], attackRange: 175 }
    const lux = champion(99, 'Lux', 2, 9)
    const state = stateOf({
      champion: champion(122, 'Darius', 9, 0),
      position: 'TOP',
      opponent: aatrox,
      enemies: [aatrox, lux],
      allies: [],
      situations: [{ axis: 'EnemyMagicDamage', bucket: 'High', strength: 1 }],
      games: 5000,
      abilities: new Map([[266, [{ key: 'Q', name: 'The Darkin Blade', description: 'Deals <physicalDamage>physical damage</physicalDamage>.' }]], [99, [{ key: 'Q', name: 'Light Binding', description: 'Roots two enemies.' }]]]),
      lane: { games: 900, winRate: 0.48, laneWinRate: 0.45, goldDiffAt15: -210 },
    })
    expect(state).toContain('Laning phase: the starter, the boots and the first item are bought while laning against Aatrox')
    expect(state).toContain('Q The Darkin Blade: Deals physical damage.')
    expect(state).toContain('900 games, 48.0% game win rate, 45.0% of decided lanes won, -210 gold difference at 15 minutes')
    expect(state).toContain('Lux:\n  Q Light Binding: Roots two enemies.')
  })

  it('cuts a long ability to its limit', () => {
    expect(plainAbility('a'.repeat(50), 10)).toBe(`${'a'.repeat(9)}…`)
  })
})

describe('itemEffect', () => {
  it('reads an item\'s stats and effects out of Data Dragon and says what it answers', () => {
    const effect = itemEffect({
      description: '<mainText><stats><attention>350</attention> Health<br><attention>55</attention> Magic Resist</stats><br><br><passive>Steadfast</passive><br>Taking magic damage grants stacks.</mainText>',
      plaintext: 'Grants magic resist and health',
      tags: ['Health', 'SpellBlock'],
    })
    expect(effect).toBe('stats: 350 Health, 55 Magic Resist; effects: Steadfast; Grants magic resist and health; answers magic damage')
  })

  it('names anti-heal by its Grievous Wounds', () => {
    expect(itemEffect({ description: '<passive>Rend</passive> applies Grievous Wounds', tags: ['Damage'] })).toContain('answers healing')
  })
})

describe('draftNeeds', () => {
  it('sums the enemy team up in one line: damage split, crowd control, frontline, healing', () => {
    const champion = (alias: string, attack: number, magic: number, tags: string[]) => ({ id: alias.length, alias, name: alias, tags, info: { attack, magic, defense: 5 } })
    expect(draftNeeds([champion('Lux', 2, 9, ['Mage', 'Support']), champion('Soraka', 2, 7, ['Support']), champion('Ornn', 5, 3, ['Tank']), champion('Jinx', 9, 2, ['Marksman'])]))
      .toBe('50% magic and 50% physical damage, heavy crowd control from Soraka, Ornn, a frontline of Ornn, healing from Soraka')
  })
})

describe('checks', () => {
  const checksSlot: JevSlot = { name: 'item5', instructions: '', kind: 'checks', lane: false, options: [
    { key: 'o0', itemIds: [3065], label: 'Spirit Visage', games: 800, pickRate: 0.3, winRate: 0.52 },
    { key: 'o1', itemIds: [6333], label: 'Death\'s Dance', games: 600, pickRate: 0.2, winRate: 0.51 },
  ] }

  it('asks each option its own yes/no checks, the lane only for what is bought while laning', () => {
    const questions = questionsOf([checksSlot], ask)
    expect(Object.keys(questions)).toEqual(['item5__o0__kit', 'item5__o0__draft', 'item5__o1__kit', 'item5__o1__draft'])
    expect(questions.item5__o1__draft).toMatchObject({ type: 'noul' })
  })

  it('weighs the checks and the sample into the slot\'s pick and confidence', () => {
    const noul = (value: number) => ({ type: 'noul' as const, noul: value })
    const decision = decide(checksSlot, { item5__o0__kit: noul(0.8), item5__o0__draft: noul(0.1), item5__o1__kit: noul(0.9), item5__o1__draft: noul(0.95) })
    expect(decision.jev.key).toBe('o1')
    expect(decision.answer?.checks?.o1).toEqual({ kit: 0.9, draft: 0.95, lane: null })
    expect(decision.answer!.probabilities.o1).toBeGreaterThan(0.6)
  })

  it('leaves out what the source barely saw, keeping two to compare', () => {
    const measure = (games: number) => ({ games, pickRate: 0, winRate: 0.5 })
    expect(reliable([measure(12), measure(400), measure(45)]).map(entry => entry.games)).toEqual([400, 45])
    expect(reliable([measure(16), measure(14), measure(12)]).map(entry => entry.games)).toEqual([16, 14])
  })

  it('reads confidence as TypeSafe does: 1 all on one option, 0 spread evenly', () => {
    expect(confidenceOf([1, 0])).toBe(1)
    expect(confidenceOf([0.5, 0.5])).toBeCloseTo(0)
  })
})

describe('situational answers', () => {
  it('adds to a later slot the champion\'s measured items that answer the draft, when its own options do not', () => {
    const m = (games: number, itemIds: number[]) => ({ games, winRate: 0.5, pickRate: 0.1, itemIds })
    const core = m(900, [3142, 6691])
    const options = {
      patch: null, games: 5000, pages: [], shares: null, spells: [], starters: [], boots: [], skills: [], cores: [core],
      followUps: () => [{ slot: 4, options: [m(300, [6694]), m(200, [3814])] }, { slot: 5, options: [m(150, [3071])] }],
    }
    const names = { item: (id: number) => `#${id}`, perk: String, style: String, spell: String, itemEffect: () => '', perkEffect: () => '', spellEffect: () => '' }
    const slot = laterSlot(options, core, 4, [3142, 6691], names, ask, { pool: measuredPool(options), answersDraft: id => id === 3071 })!
    expect(slot.options.map(option => [option.itemIds[0], !!option.situational])).toEqual([[6694, false], [3814, false], [3071, true]])
  })
})

describe('win probability added', () => {
  const two: JevSlot = { name: 'item4', instructions: '', kind: 'checks', lane: false, options: [
    { key: 'o0', itemIds: [6694], label: 'Serylda', games: 400, pickRate: 0.3, winRate: 0.5 },
    { key: 'o1', itemIds: [3071], label: 'Black Cleaver', games: 400, pickRate: 0.2, winRate: 0.5 },
  ] }
  const stat = (wpa: number, games = 200) => ({ games, winRate: 0.5, wpa })
  const noul = (value: number) => ({ type: 'noul' as const, noul: value })
  const even = { item4__o0__kit: noul(0.7), item4__o0__draft: noul(0.7), item4__o1__kit: noul(0.7), item4__o1__draft: noul(0.7) }

  it('annotates each item option with its lane and matchup WPA, and tells Jev', () => {
    const [slot] = withItemStats([two], new Map([[6694, stat(-0.01)], [3071, stat(0.02)]]), new Map([[3071, stat(0.05, 90)]]))
    expect(slot!.options.map(option => [option.wpa, option.vsWpa, option.vsGames])).toEqual([[-0.01, null, 0], [0.02, 0.05, 90]])
    expect((questionsOf([slot!], ask).item4__o1__draft as { instructions: string }).instructions).toContain('[on this lane it adds +2.0% win probability; against Aatrox (Fighter) it adds +5.0% over 90 games]')
  })

  it('lets the measured effect tip checks that tie', () => {
    const [slot] = withItemStats([two], new Map([[6694, stat(-0.01)], [3071, stat(0.03)]]), new Map())
    expect(decide(slot!, even).jev.key).toBe('o1')
  })

  it('joins the item stats to the measured pool, completed items only', () => {
    const pool = statsPool(new Map([[3071, stat(0.02, 108)], [1036, stat(0.1, 500)]]), [{ itemIds: [6694], games: 300, winRate: 0.5, pickRate: 0.1 }], id => id !== 1036)
    expect(pool.map(option => option.itemIds[0])).toEqual([6694, 3071])
  })
})

describe('the core item by item', () => {
  const m = (games: number, itemIds: number[]) => ({ games, winRate: 0.5, pickRate: 0.1, itemIds })
  const options = {
    patch: null, games: 5000, pages: [], shares: null, spells: [], starters: [], boots: [], skills: [],
    cores: [m(600, [6692, 3142, 6694]), m(300, [6692, 6676, 3142]), m(200, [3142, 6692, 3814])],
    followUps: () => [],
  }
  const names = { item: (id: number) => `#${id}`, perk: String, style: String, spell: String, itemEffect: () => '', perkEffect: () => '', spellEffect: () => '' }

  it('makes each place of the core a slot of the items measured there, games added up, the draft\'s answers from the second on', () => {
    const slots = coreSlots(options, names, ask, { pool: [m(108, [3071])], answersDraft: id => id === 3071 })
    expect(slots.map(slot => slot.name)).toEqual(['item1', 'item2', 'item3'])
    expect(slots[0]!.options.map(option => [option.itemIds[0], option.games])).toEqual([[6692, 900], [3142, 200]])
    expect(slots[1]!.options.map(option => [option.itemIds[0], !!option.situational])).toEqual([[3142, false], [6676, false], [6692, false], [3071, true]])
  })

  it('follows the measured core closest to the one Jev put together', () => {
    expect(closestCore(options.cores, [6692, 6676, 3071])?.games).toBe(300)
  })
})

describe('the wrong kind of damage', () => {
  it('weighs down Mercury\'s Treads into a lone physical laner, whatever Jev\'s checks say', () => {
    const noul = (value: number) => ({ type: 'noul' as const, noul: value })
    const bootsSlot: JevSlot = { name: 'boots', instructions: '', kind: 'checks', lane: true, options: [
      { key: 'o0', itemIds: [3047], label: 'Plated Steelcaps', games: 900, pickRate: 0.5, winRate: 0.5 },
      { key: 'o1', itemIds: [3111], label: 'Mercury\'s Treads', games: 900, pickRate: 0.4, winRate: 0.5, misfit: true },
    ] }
    const decision = decide(bootsSlot, {
      boots__o0__kit: noul(0.6), boots__o0__draft: noul(0.6), boots__o0__lane: noul(0.6),
      boots__o1__kit: noul(0.8), boots__o1__draft: noul(0.9), boots__o1__lane: noul(0.8),
    })
    expect(decision.jev.key).toBe('o0')
  })

  it('does not read a fighter that can tank as crowd control', () => {
    expect(draftNeeds([{ id: 122, alias: 'Darius', name: 'Darius', tags: ['Fighter', 'Tank'], info: { attack: 9, magic: 0, defense: 5 } }]))
      .toContain('little crowd control')
  })
})
