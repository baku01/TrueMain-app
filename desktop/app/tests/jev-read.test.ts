import { describe, expect, it } from 'vitest'
import type { JevAnswer } from '~/utils/jev'
import { batches, enemyRequest, itemRequest, laneRequest, pickRequest, readChampion, readItem, readPick, scoreOf } from '~/utils/jev-read'

const darius = { id: 122, name: 'Darius', classes: ['Fighter', 'Tank'], kit: [{ key: 'E', name: 'Apprehend', description: 'Pulls in enemies.' }] }
const lux = { id: 99, name: 'Lux', classes: ['Mage'], kit: [{ key: 'Q', name: 'Light Binding', description: 'Roots two enemies.' }] }
const score = (value: number, confidence = 0.8): JevAnswer => ({ type: 'score', score: value, confidence, probabilities: [] })
const noul = (value: number): JevAnswer => ({ type: 'noul', noul: value })

describe('what Jev is asked', () => {
  it('asks five scales of each enemy kit, the state holding only the kits, no number', () => {
    const request = enemyRequest([darius, lux])
    expect(Object.keys(request.questions)).toHaveLength(10)
    expect(request.questions.e99_cc).toMatchObject({ type: 'score' })
    expect((request.questions.e99_cc as { criteria: string[] }).criteria).toHaveLength(3)
    expect(request.state).toEqual({ enemies: {
      'Darius': { classes: 'Fighter, Tank', abilities: { 'E — Apprehend': 'Pulls in enemies.' } },
      'Lux': { classes: 'Mage', abilities: { 'Q — Light Binding': 'Roots two enemies.' } },
    } })
    expect(JSON.stringify(request)).not.toMatch(/\d+(\.\d+)?%/)
  })

  it('asks five yes/no facts of each item and how it suits our champion', () => {
    const request = itemRequest(darius, 'TOP', [{ id: 3071, name: 'Black Cleaver', text: 'Armor penetration.' }])
    expect(Object.keys(request.questions)).toEqual(['i3071_antiHeal', 'i3071_tenacity', 'i3071_antiBurst', 'i3071_vsAutos', 'i3071_vsTanks', 'i3071_kit'])
    expect(request.questions.i3071_tenacity).toMatchObject({ type: 'noul', criteria: { true: expect.any(String), false: expect.any(String) } })
    expect(request.state).toMatchObject({ ourChampion: { name: 'Darius', role: 'TOP' }, items: { 'Black Cleaver': 'Armor penetration.' } })
  })

  it('asks each lane choice against the lane opponent, and the boots\' timing', () => {
    const request = laneRequest({ champion: darius, position: 'TOP', opponent: lux, runePages: [{ key: 'o0', text: 'Conqueror' }], spells: [{ key: 'o0', text: 'Flash + Ghost' }], starters: [] })
    expect(Object.keys(request.questions)).toEqual(['r_o0', 's_o0', 'bootsTiming'])
    expect(request.state).toHaveProperty('laneOpponent.name', 'Lux')
    expect(laneRequest({ champion: darius, position: 'TOP', opponent: null, runePages: [], spells: [], starters: [] }).state).not.toHaveProperty('laneOpponent')
  })

  it('splits a long request, each part with the whole state', () => {
    const request = itemRequest(darius, 'TOP', Array.from({ length: 30 }, (_, index) => ({ id: index, name: `#${index}`, text: '' })))
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

  it('reads a champion only when all five came back, its confidence averaged', () => {
    const answers = { e99_cc: score(2, 1), e99_heal: score(0, 0.5), e99_burst: score(2, 1), e99_autos: score(0, 0.5), e99_tank: score(0, 1) }
    expect(readChampion(99, answers)).toMatchObject({ cc: 1, burst: 1, tank: 0, confidence: 0.8 })
    expect(readChampion(99, answers)!.heal).toBeCloseTo(0.15)
    expect(readChampion(99, { ...answers, e99_tank: undefined as unknown as JevAnswer })).toBeNull()
  })

  it('reads an item\'s facts as the probability of yes', () => {
    const answers = { i3111_antiHeal: noul(0.02), i3111_tenacity: noul(0.97), i3111_antiBurst: noul(0.1), i3111_vsAutos: noul(0.05), i3111_vsTanks: noul(0.01), i3111_kit: score(1) }
    expect(readItem(3111, answers)).toEqual({ antiHeal: 0.02, tenacity: 0.97, antiBurst: 0.1, vsAutos: 0.05, vsTanks: 0.01, kit: 0.5 })
    expect(readItem(3111, { i3111_kit: score(1) })).toBeNull()
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
