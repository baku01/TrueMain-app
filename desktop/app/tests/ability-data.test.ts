import { describe, expect, it } from 'vitest'
import { fillDescription, safeDescription } from '~/utils/ability-data'

// Camille's W as the game file holds it (CommunityDragon), trimmed to what its description names.
const values = new Map<string, number[]>([
  ['BaseDamage', [35, 60, 85, 110, 135, 160, 185]],
  ['BADRatio', [0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6]],
  ['SlowPercentage', [80, 80, 80, 80, 80, 80, 80]],
  ['OuterConeMaxHPDamage', [0.065, 0.07, 0.075, 0.08, 0.085, 0.09, 0.095]],
  ['ADRequiredTooltipOnly', [0.00025, 0.00025, 0.00025, 0.00025, 0.00025, 0.00025, 0.00025]],
  ['tADRatio', [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45]],
])
const calcs = {
  BaseDamageTotal: { mFormulaParts: [{ mDataValue: 'BaseDamage', __type: 'NamedDataValueCalculationPart' }, { mStat: 2, mStatFormula: 2, mDataValue: 'BADRatio', __type: 'StatByNamedDataValueCalculationPart' }], __type: 'GameCalculation' },
  OuterEdgeTooltip: { mFormulaParts: [{ mDataValue: 'OuterConeMaxHPDamage', __type: 'NamedDataValueCalculationPart' }, { mStat: 2, mStatFormula: 2, mDataValue: 'ADRequiredTooltipOnly', __type: 'StatByNamedDataValueCalculationPart' }], mDisplayAsPercent: true, __type: 'GameCalculation' },
  BonusDamage: { mFormulaParts: [{ mStat: 2, mDataValue: 'TADRATIO', __type: 'StatByNamedDataValueCalculationPart' }], __type: 'GameCalculation' },
  Stacked: { mFormulaParts: [{ mDataValue: 'BaseDamage', __type: 'BuffCounterByNamedDataValueCalculationPart' }], __type: 'GameCalculation' },
  ByLevel: { mFormulaParts: [{ mLevel1Value: 0.4, mInitialBonusPerLevel: 0.04, mBreakpoints: [{ mLevel: 17 }], __type: 'ByCharLevelBreakpointsCalculationPart' }], mDisplayAsPercent: true, __type: 'GameCalculation' },
}

describe('ability descriptions', () => {
  it('writes each figure per rank with its scaling', () => {
    expect(fillDescription('<physicalDamage>@BaseDamageTotal@</physicalDamage>', values, calcs, 5, 'pt')).toBe('<physicalDamage>60/85/110/135/160 (+60% DdA adicional)</physicalDamage>')
    expect(fillDescription('@SlowPercentage@%', values, calcs, 5, 'pt')).toBe('80%')
  })

  it('writes a percentage that grows with a stat per hundred of it', () => {
    expect(fillDescription('@OuterEdgeTooltip@', values, calcs, 5, 'pt')).toBe('7/7.5/8/8.5/9% (+2.5% por 100 de DdA adicional)')
  })

  it('reads names whatever their case, stacks, and champion level', () => {
    expect(fillDescription('@BonusDamage@', values, calcs, 5, 'pt')).toBe('(+20/25/30/35/40% DdA)')
    expect(fillDescription('@Stacked@', values, calcs, 5, 'pt')).toBe('(+60/85/110/135/160 por acúmulo)')
    expect(fillDescription('@ByLevel@', values, calcs, 5, 'pt')).toBe('40–100% (com base no nível)')
  })

  it('says an unknown value is unknown, and drops the game\'s inline icons', () => {
    expect(fillDescription('@f1@ vezes', values, calcs, 5, 'pt')).toBe('— vezes')
    expect(fillDescription('Armadura (%i:scaleArmor%)', values, calcs, 5, 'pt')).toBe('Armadura ()')
  })

  it('keeps only the game\'s own tags, as classed spans', () => {
    expect(safeDescription('<physicalDamage>10</physicalDamage><br><script>x</script><img src=x>')).toBe('<span class="ab-physical">10</span><br>x')
  })
})

describe('the game\'s string references', () => {
  it('are dropped', () => {
    expect(fillDescription('Ataca todos. {{ Spell_ApheliosR_WeaponMod_@x@ }}', values, calcs, 3, 'pt')).toBe('Ataca todos. ')
  })
})
