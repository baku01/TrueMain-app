import { describe, expect, it } from 'vitest'
import { isLocale, translate } from '#common/utils/i18n'

describe('translate', () => {
  it('answers in the chosen language', () => {
    expect(translate('en', 'nav.favorites')).toBe('Favorites')
    expect(translate('pt-BR', 'nav.favorites')).toBe('Favoritos')
  })

  it('fills in params', () => {
    expect(translate('pt-BR', 'sidebar.update', { version: '0.4.0' })).toBe('Atualizar para v0.4.0')
  })

  it('leaves an unknown param in place', () => {
    expect(translate('en', 'sidebar.update')).toBe('Update to v{version}')
  })

  it('answers an unknown key with the key', () => {
    expect(translate('pt-BR', 'no.such.key')).toBe('no.such.key')
  })
})

describe('isLocale', () => {
  it('accepts only the shipped locales', () => {
    expect(isLocale('pt-BR')).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(isLocale(null)).toBe(false)
  })
})
