import { describe, expect, it } from 'vitest'
import { highlightRuneHtml } from '~/utils/rune-highlight'

describe('highlightRuneHtml', () => {
  it('colours the numbers and the terms of a Portuguese text', () => {
    const html = highlightRuneHtml('Causar Dano Mágico equivalente a 3.5% da sua Vida máxima por 5s.')
    expect(html).toContain('<magicdamage>Dano Mágico</magicdamage>')
    expect(html).toContain('<attention>3.5%</attention>')
    expect(html).toContain('<scalehealth>Vida máxima</scalehealth>')
    expect(html).toContain('<attention>5s</attention>')
  })

  it('does the same in English, longest term first', () => {
    const html = highlightRuneHtml('Heal for 8% of your max health, and gain Adaptive Force.')
    expect(html).toContain('<healing>Heal</healing>')
    expect(html).toContain('<scalehealth>max health</scalehealth>')
    expect(html).toContain('<adaptivedamage>Adaptive Force</adaptivedamage>')
  })

  it('leaves tags and their attributes alone, and a term inside a word', () => {
    const html = highlightRuneHtml("<lol-uikit-tooltipped-keyword key='Health 5'>x</lol-uikit-tooltipped-keyword> cura curar")
    expect(html).toContain("key='Health 5'")
    expect(html).toContain('<healing>cura</healing> curar')
  })

  it('leaves the footnote block alone', () => {
    const html = highlightRuneHtml('Cura 5%<br><rules>a cura tem 40% de eficácia</rules>')
    expect(html).toContain('<healing>Cura</healing>')
    expect(html).toContain('<rules>a cura tem 40% de eficácia</rules>')
  })

  it('keeps a range as one value', () => {
    expect(highlightRuneHtml('1.8-4 de força')).toContain('<attention>1.8-4</attention>')
  })
})
