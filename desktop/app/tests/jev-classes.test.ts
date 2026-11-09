import { describe, expect, it } from 'vitest'
import { CLASS_PROFILES, OWN_SHARE, SUBCLASSES, classBuys, isGuard, itemizationOf, subclassOf } from '~/utils/jev-classes'

// Riot's tags and total gold, Data Dragon 16.22.1.
const ITEMS: Record<number, [string[], number]> = {
  3026: [['Armor', 'Damage'], 3200], // Guardian Angel
  6333: [['Armor', 'Damage', 'AbilityHaste'], 3300], // Death's Dance
  3143: [['Health', 'Armor', 'Active', 'Slow'], 2700], // Randuin's Omen
  3083: [['Health', 'HealthRegen'], 3100], // Warmog's Armor
  3071: [['Health', 'Damage', 'CooldownReduction', 'OnHit', 'NonbootsMovement', 'ArmorPenetration', 'AbilityHaste'], 3000], // Black Cleaver
  3116: [['Health', 'SpellDamage', 'Slow'], 2600], // Rylai's Crystal Scepter
  3814: [['Health', 'Damage', 'ArmorPenetration'], 3000], // Edge of Night
  3031: [['CriticalStrike', 'Damage'], 3500], // Infinity Edge
  3157: [['Armor', 'SpellDamage', 'Active'], 3250], // Zhonya's Hourglass
  3190: [['Health', 'SpellBlock', 'Armor', 'Aura', 'Active', 'MagicResist', 'AbilityHaste'], 2200], // Locket of the Iron Solari
  3222: [['Health', 'ManaRegen', 'Active', 'CooldownReduction', 'Tenacity', 'AbilityHaste'], 2300], // Mikael's Blessing
  2504: [['Health', 'SpellBlock', 'HealthRegen'], 2900], // Kaenic Rookern
  3047: [['Armor', 'Boots'], 1200], // Plated Steelcaps
}
const guard = (id: number) => isGuard(...ITEMS[id]!)
const buys = (subclass: keyof typeof CLASS_PROFILES, id: number) => classBuys(CLASS_PROFILES[subclass], id, ...ITEMS[id]!)

describe('champion classes', () => {
  it('maps every champion Data Dragon listed on 16.22 to its subclasses, the main one first', () => {
    expect(Object.keys(SUBCLASSES)).toHaveLength(173)
    expect(SUBCLASSES[22]).toEqual(['Marksman']) // Ashe
    expect(SUBCLASSES[147]).toEqual(['Burst', 'Enchanter']) // Seraphine
    expect(SUBCLASSES[238]).toEqual(['Assassin']) // Zed
    expect(SUBCLASSES[516]).toEqual(['Vanguard']) // Ornn
    expect(SUBCLASSES[26]).toEqual(['Specialist']) // Zilean
  })

  it('builds a mage that is also an enchanter as one on the support lane, a Specialist by its Riot class', () => {
    expect(subclassOf({ id: 147, classes: ['Support', 'Mage'] }, 'UTILITY')).toBe('Enchanter')
    expect(subclassOf({ id: 147, classes: ['Support', 'Mage'] }, 'MIDDLE')).toBe('Burst')
    expect(subclassOf({ id: 43, classes: ['Mage', 'Support'] }, 'UTILITY')).toBe('Enchanter') // Karma
    expect(subclassOf({ id: 555, classes: ['Support', 'Assassin'] }, 'UTILITY')).toBe('Assassin') // Pyke
    expect(subclassOf({ id: 235, classes: ['Support', 'Marksman'] }, 'UTILITY')).toBe('Marksman') // Senna
    expect(subclassOf({ id: 26, classes: ['Support', 'Mage'] }, 'UTILITY')).toBe('Enchanter') // Zilean
    expect(subclassOf({ id: 9999, classes: ['Marksman'] }, 'BOTTOM')).toBe('Marksman') // released after the table
  })

  it('tells a guard item: armor or magic resist, or health with no damage — not boots, not a damage item with health', () => {
    for (const id of [3026, 6333, 3143, 3083, 3157, 3190, 3222, 2504]) expect(guard(id)).toBe(true)
    for (const id of [3071, 3116, 3814, 3031, 3047]) expect(guard(id)).toBe(false)
  })

  it('keeps a class to its own guard items: Guardian Angel on a marksman, not Death\'s Dance or Randuin\'s Omen', () => {
    expect(buys('Marksman', 3026)).toBe(true)
    expect(buys('Marksman', 6333)).toBe(false)
    expect(buys('Marksman', 3143)).toBe(false)
    expect(buys('Marksman', 3071)).toBe(true) // a damage item: the build's damage kind decides (`damageKind`)
    expect(buys('Assassin', 3143)).toBe(false)
    expect(buys('Assassin', 3814)).toBe(true)
    expect(buys('Burst', 3157)).toBe(true)
    expect(buys('Enchanter', 3190)).toBe(true)
    expect(buys('Enchanter', 3222)).toBe(true)
    expect(buys('Enchanter', 3157)).toBe(false)
    expect(buys('Enchanter', 2504)).toBe(false)
    expect(buys('Juggernaut', 3143)).toBe(true)
    expect(OWN_SHARE).toBe(0.05)
  })

  it('gives every subclass a profile, its guard items from a place of the build', () => {
    for (const profile of Object.values(CLASS_PROFILES)) {
      expect(profile.guardFrom).toBeGreaterThanOrEqual(1)
      expect(profile.guardFrom).toBeLessThanOrEqual(6)
      expect(profile.builds.length).toBeGreaterThan(20)
    }
    expect(CLASS_PROFILES.Marksman.guardFrom).toBe(4)
    expect(CLASS_PROFILES.Burst.guardFrom).toBe(2)
  })

  it('words how a class itemizes for Jev, by need', () => {
    expect(itemizationOf('Marksman')).toMatchObject({
      class: 'Marksman',
      defensiveItemsFrom: 'its fourth completed item',
      answers: { 'against physical damage': expect.stringContaining('Guardian Angel') },
    })
  })
})
