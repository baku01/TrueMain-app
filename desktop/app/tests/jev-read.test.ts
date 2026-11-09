import { describe, expect, it } from 'vitest'
import type { JevAnswer } from '~/utils/jev'
import { batches, enemyRequest, itemRequest, laneRequest, readChampion, readItem, scoreOf } from '~/utils/jev-read'
import { pickRequest, readPick } from '~/utils/jev-read-pick'
import { itemizationOf } from '~/utils/jev-classes'

const darius = { id: 122, name: 'Darius', classes: ['Fighter', 'Tank'], kit: [{ key: 'E', name: 'Apprehend', description: 'Pulls in enemies.' }] }
const lux = { id: 99, name: 'Lux', classes: ['Mage'], kit: [{ key: 'Q', name: 'Light Binding', description: 'Roots two enemies.' }] }
const score = (value: number, confidence = 0.8): JevAnswer => ({ type: 'score', score: value, confidence, probabilities: [] })
const noul = (value: number): JevAnswer => ({ type: 'noul', noul: value })
const juggernaut = itemizationOf('Juggernaut')

describe('what Jev is asked', () => {
  it('asks seven scales of each enemy kit, the state holding only the kits, no number', () => {
    const request = enemyRequest([darius, lux])
    expect(Object.keys(request.questions)).toHaveLength(14)
    expect(request.questions.e99_cc).toMatchObject({ type: 'score' })
    expect((request.questions.e99_cc as { criteria: string[] }).criteria).toHaveLength(3)
    expect(request.state).toEqual({ enemies: {
      'Darius': { classes: 'Fighter, Tank', abilities: { 'E — Apprehend': 'Pulls in enemies.' } },
      'Lux': { classes: 'Mage', abilities: { 'Q — Light Binding': 'Roots two enemies.' } },
    } })
    expect(JSON.stringify(request)).not.toMatch(/\d+(\.\d+)?%/)
  })

  it('asks how much of a kit\'s crowd control Tenacity shortens, and how much of its healing is done in fights (LoLTheory)', () => {
    const request = enemyRequest([darius])
    const levels = (key: string) => (request.questions[key] as { criteria: string[] }).criteria
    expect(levels('e122_ccReducible')[0]).toMatch(/airborne.*suppression.*stasis.*sleep.*nearsight/)
    expect(levels('e122_ccReducible')[2]).toMatch(/stuns, roots/)
    expect(levels('e122_healInFight')[0]).toMatch(/Out of combat/)
    expect(levels('e122_healInFight')[2]).toMatch(/During fights/)
  })

  it('asks five yes/no facts of each item and how it suits our champion', () => {
    const request = itemRequest(darius, 'TOP', [{ id: 3071, name: 'Black Cleaver', text: 'Armor penetration.' }], juggernaut)
    expect(Object.keys(request.questions)).toEqual(['i3071_antiHeal', 'i3071_tenacity', 'i3071_antiBurst', 'i3071_vsAutos', 'i3071_vsTanks', 'i3071_kit'])
    expect(request.questions.i3071_tenacity).toMatchObject({ type: 'noul', criteria: { true: expect.any(String), false: expect.any(String) } })
    expect(request.state).toMatchObject({ ourChampion: { name: 'Darius', role: 'TOP' }, items: { 'Black Cleaver': 'Armor penetration.' } })
  })

  it('judges each item\'s fit against how our champion\'s class builds: what it never builds reads as wrong', () => {
    const marksman = itemizationOf('Marksman')
    const request = itemRequest(darius, 'BOTTOM', [{ id: 6333, name: 'Death\'s Dance', text: 'Armor.' }], marksman)
    expect(request.state).toMatchObject({ ourChampion: { itemization: { class: 'Marksman', defensiveItemsFrom: 'its fourth completed item' } } })
    expect((request.state.ourChampion as { itemization: typeof marksman }).itemization.neverBuilds).toContain('Death\'s Dance')
    expect(request.questions.i6333_kit).toMatchObject({ type: 'score', instructions: expect.stringContaining('ourChampion.itemization') })
  })

  it('asks a support\'s items two more facts: what they do for allies against burst and crowd control', () => {
    const request = itemRequest(darius, 'UTILITY', [{ id: 3107, name: 'Redemption', text: 'Heals allies.' }], juggernaut)
    expect(Object.keys(request.questions)).toEqual(['i3107_antiHeal', 'i3107_tenacity', 'i3107_antiBurst', 'i3107_vsAutos', 'i3107_vsTanks', 'i3107_allyBurst', 'i3107_allyCc', 'i3107_kit'])
    expect(request.questions.i3107_allyBurst).toMatchObject({ type: 'noul', instructions: expect.stringContaining('allies other than its holder') })
  })

  it('asks each lane choice against the lane opponent, and the boots\' timing', () => {
    const request = laneRequest({ champion: darius, position: 'TOP', subclass: 'Juggernaut', opponent: lux, runePages: [{ key: 'o0', text: 'Conqueror' }], spells: [{ key: 'o0', text: 'Flash + Ghost' }], starters: [] })
    expect(Object.keys(request.questions)).toEqual(['r_o0', 's_o0', 'bootsTiming'])
    expect(request.state).toHaveProperty('laneOpponent.name', 'Lux')
    expect(request.state).toHaveProperty('ourChampion.subclass', 'Juggernaut')
    expect(laneRequest({ champion: darius, position: 'TOP', subclass: 'Juggernaut', opponent: null, runePages: [], spells: [], starters: [] }).state).not.toHaveProperty('laneOpponent')
  })

  it('splits a long request, each part with the whole state', () => {
    const request = itemRequest(darius, 'TOP', Array.from({ length: 30 }, (_, index) => ({ id: index, name: `#${index}`, text: '' })), juggernaut)
    const parts = batches(request, 100)
    expect(parts.map(part => Object.keys(part.questions).length)).toEqual([100, 80])
    expect(parts[1]!.state).toBe(request.state)
    expect(batches({ state: {}, questions: {} })).toEqual([])
  })
})

describe('reading the answers', () => {
  it('puts a Score on 0–1 by its levels', () => {
    expect(scoreOf(score(1))).toEqual({ value: 0.5, confidence: 0.8 })
    expect(scoreOf(score(2, 1))!.value).toBe(1)
    expect(scoreOf(score(2, 0))!.value).toBeCloseTo(0.7)
    expect(scoreOf(noul(0.9))).toBeNull()
  })

  it('reads a champion only when all seven came back, its confidence averaged', () => {
    const answers = { e99_cc: score(2, 1), e99_ccReducible: score(2, 0.8), e99_heal: score(0, 0.5), e99_healInFight: score(2, 0.8), e99_burst: score(2, 1), e99_autos: score(0, 0.5), e99_tank: score(0, 1) }
    expect(readChampion(99, answers)).toMatchObject({ cc: 1, burst: 1, tank: 0 })
    expect(readChampion(99, answers)!.confidence).toBeCloseTo(0.8)
    expect(readChampion(99, answers)!.heal).toBeCloseTo(0.15)
    expect(readChampion(99, { ...answers, e99_tank: undefined as unknown as JevAnswer })).toBeNull()
  })

  it('reads an item\'s facts as the probability of yes', () => {
    const answers = { i3111_antiHeal: noul(0.02), i3111_tenacity: noul(0.97), i3111_antiBurst: noul(0.1), i3111_vsAutos: noul(0.05), i3111_vsTanks: noul(0.01), i3111_kit: score(1) }
    expect(readItem(3111, answers)).toEqual({ antiHeal: 0.02, tenacity: 0.97, antiBurst: 0.1, vsAutos: 0.05, vsTanks: 0.01, kit: 0.5 })
    expect(readItem(3111, { i3111_kit: score(1) })).toBeNull()
  })

  it('reads a support\'s item only once its allies\' facts came back too', () => {
    const answers = { i3107_antiHeal: noul(0.01), i3107_tenacity: noul(0.02), i3107_antiBurst: noul(0.1), i3107_vsAutos: noul(0.01), i3107_vsTanks: noul(0.01), i3107_kit: score(2) }
    expect(readItem(3107, answers, 'UTILITY')).toBeNull()
    expect(readItem(3107, { ...answers, i3107_allyBurst: noul(0.95), i3107_allyCc: noul(0.05) }, 'UTILITY')).toMatchObject({ antiBurst: 0.1, allyBurst: 0.95, allyCc: 0.05 })
    // Elsewhere the allies are not asked about.
    expect(readItem(3107, answers, 'MIDDLE')).not.toHaveProperty('allyBurst')
  })
})

describe('the pick', () => {
  const ahri = { id: 103, name: 'Ahri', classes: ['Mage'], kit: [{ key: 'E', name: 'Charm', description: 'Charms an enemy.' }] }

  it('asks each candidate only what the draft has someone to judge against', () => {
    const request = pickRequest({ position: 'MIDDLE', opponent: null, allies: [darius], enemies: [lux], candidates: [ahri] })
    expect(Object.keys(request.questions)).toEqual(['p103_team', 'p103_enemy'])
    expect(request.state).not.toHaveProperty('laneOpponent')
    expect(request.state).toMatchObject({ ourRole: 'MIDDLE', candidates: { Ahri: { classes: 'Mage' } } })
    expect(Object.keys(pickRequest({ position: 'MIDDLE', opponent: lux, allies: [], enemies: [], candidates: [ahri] }).questions)).toEqual(['p103_lane'])
  })

  it('reads what came back, null where nothing was asked', () => {
    expect(readPick(103, { p103_lane: score(2, 1), p103_enemy: score(0, 1) })).toEqual({ lane: 1, team: null, enemy: 0, confidence: 1 })
    expect(readPick(103, {})).toBeNull()
  })
})
