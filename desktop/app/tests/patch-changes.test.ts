import { describe, expect, it } from 'vitest'
import { blockChange, lineChange, markChanges } from '~/utils/patch-notes'

describe('patch note changes', () => {
  it('reads a number going up as a buff, and down as a nerf', () => {
    expect(lineChange('Cura mínima: 25/50/75/100/125 (+30% do PdH) ⇒ 25/50/75/100/125 (+40% do PdH)')).toBe('buff')
    expect(lineChange('Dano: 60/90/120 ⇒ 50/80/110')).toBe('nerf')
    expect(lineChange('Cura máxima: 50/87,5/125 ⇒ 50/87,5/130')).toBe('buff')
  })

  it('turns the sense for what reads better lower', () => {
    expect(lineChange('Tempo de Recarga: 12/11/10 ⇒ 14/13/12')).toBe('nerf')
    expect(lineChange('Cooldown: 12 ⇒ 10 seconds')).toBe('buff')
    expect(lineChange('Custo de Mana: 60 ⇒ 50')).toBe('buff')
  })

  it('leaves a line that moves no number unread', () => {
    expect(lineChange('Novo efeito: agora causa lentidão')).toBeNull()
    expect(lineChange('Removido: 10 ⇒ 10')).toBeNull()
  })

  it('reads a card from all its lines', () => {
    const buff = '<ul><li><strong>Dano</strong>: 60 ⇒ 70</li><li><strong>Recarga</strong>: 10 ⇒ 9</li></ul>'
    const mixed = '<ul><li><strong>Dano</strong>: 60 ⇒ 70</li><li><strong>Recarga</strong>: 10 ⇒ 12</li></ul>'
    expect(blockChange(buff)).toBe('buff')
    expect(blockChange(mixed)).toBe('adjust')
    expect(blockChange('<p>Texto sem mudanças</p>')).toBeNull()
    expect(markChanges(mixed)).toContain('<li class="change-nerf">')
  })
})

describe('a side Riot shortens', () => {
  it('reads the numbers left from their ends', () => {
    expect(lineChange('Dano por segundo: 120/200/280 (+ 35% do PdH) ⇒ (+ 40% do PdH)')).toBe('buff')
    expect(blockChange('<ul><li><strong>Dano por segundo</strong>: 120/200/280 (+ 35% do PdH) ⇒ <strong>(+ 40% do PdH)</strong></li></ul><p><strong>Multiplicador</strong>: 175% do PdH ⇒ <strong>200% do PdH</strong></p>')).toBe('buff')
  })
})

describe('sides with more values on one side', () => {
  it('compares group by group', () => {
    expect(lineChange('Dano Mágico total: 50/75/100/125/150 (+ 60% do PdH) ao longo de 5s ⇒ 50/80/110/140/170 (+ 60/65/70/75/80% do PdH) ao longo de 5s')).toBe('buff')
    expect(lineChange('Total de dano: 85 - 277 (+ 80 - 100% do PdH) ⇒ 85 - 285 (+ 65 - 97% do PdH)')).toBe('nerf')
    expect(lineChange('Velocidade do projétil: 3.800 ⇒ 3.200')).toBe('nerf')
    expect(lineChange('Dano: 75/120/165/210/255 (+ 2/2,5/3/3,5/4% da Vida máxima do alvo) (+ 50% do PdH) ⇒ 75/120/165/210/255 (+ 2,5/3/3,5/4/4,5% da Vida máxima do alvo) (+ 50% do PdH)')).toBe('buff')
  })
})

describe('labels that only look like costs', () => {
  it('reads a cast\'s damage as damage', () => {
    expect(lineChange('Dano da conjuração: 100/175/250 (+ 50% do PdH) ⇒ 100/175/250 (+ 60% do PdH)')).toBe('buff')
    expect(lineChange('Tempo de conjuração: 0,5s ⇒ 0,25s')).toBe('buff')
  })
})
