import { describe, expect, it } from 'vitest'
import { appIconSvg } from '~/utils/app-icon'
import { ACCENT_KEY, DARK_FLAVOR_KEY, THEME_KEY, captionColor, flavorTokens, readThemeChoice, themeCss } from '~/utils/app-theme'
import { PALETTES, mix } from '~/utils/catppuccin'

const storage = (values: Record<string, string>) => ({ getItem: (key: string) => values[key] ?? null })

describe('app theme', () => {
  it('reads the kept choice, falling back to TrueMain, mauve and Mocha on anything unknown', () => {
    expect(readThemeChoice(undefined)).toEqual({ theme: 'truemain', accent: 'mauve', darkFlavor: 'mocha' })
    expect(readThemeChoice(storage({ [THEME_KEY]: 'frappe', [ACCENT_KEY]: 'teal', [DARK_FLAVOR_KEY]: 'macchiato' }))).toEqual({ theme: 'frappe', accent: 'teal', darkFlavor: 'macchiato' })
    expect(readThemeChoice(storage({ [THEME_KEY]: 'dracula', [ACCENT_KEY]: 'cyan', [DARK_FLAVOR_KEY]: 'latte' }))).toEqual({ theme: 'truemain', accent: 'mauve', darkFlavor: 'mocha' })
  })

  it('mixes two colours channel by channel', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mix('#1e1e2e', '#1e1e2e', 0.3)).toBe('#1e1e2e')
  })

  it('builds a flavour from its palette: the page, the panes, the text and the accent where Nuxt UI reads it', () => {
    const mocha = flavorTokens('mocha', 'mauve')
    expect(mocha['--ui-bg']).toBe(PALETTES.mocha.mantle)
    expect(mocha['--tm-pane']).toBe(PALETTES.mocha.base)
    expect(mocha['--ui-text-highlighted']).toBe(PALETTES.mocha.text)
    expect(mocha['--color-rosegold-400']).toBe(PALETTES.mocha.mauve)
    expect(mocha['--color-ink-950']).toBe(PALETTES.mocha.crust)
    expect(mocha['--color-ally']).toBe(PALETTES.mocha.blue)
    expect(mocha['--color-enemy']).toBe(PALETTES.mocha.red)
    const latte = flavorTokens('latte', 'blue')
    expect(latte['color-scheme']).toBe('light')
    expect(latte['--color-rosegold-600']).toBe(PALETTES.latte.blue)
    expect(latte['--ui-text-inverted']).toBe(PALETTES.latte.base)
  })

  it('writes no sheet, caption nor icon for TrueMain, whose colours are the stylesheet\'s', () => {
    expect(themeCss({ theme: 'truemain', accent: 'mauve' })).toBeNull()
    expect(captionColor({ theme: 'truemain', accent: 'mauve' })).toBeNull()
    expect(appIconSvg({ theme: 'truemain', accent: 'mauve' })).toBeNull()
  })

  it('outranks the app\'s own blocks, and keeps Latte\'s art banners dark in Mocha\'s tones', () => {
    const css = themeCss({ theme: 'latte', accent: 'peach' })!
    expect(css).toContain('html:root[data-theme="latte"] {')
    expect(css).toContain(`--ui-primary: ${PALETTES.latte.peach};`)
    expect(css).toContain('html:root[data-theme="latte"] .on-art {')
    expect(css).toContain(`--ui-primary: ${PALETTES.mocha.peach};`)
    expect(themeCss({ theme: 'mocha', accent: 'peach' })).not.toContain('.on-art')
  })

  it('draws the icon on the flavour\'s darkest tone in its accent, the lightest for Latte', () => {
    expect(appIconSvg({ theme: 'macchiato', accent: 'green' })).toContain(`fill="${PALETTES.macchiato.crust}"`)
    expect(appIconSvg({ theme: 'macchiato', accent: 'green' })).toContain(`stop-color="${PALETTES.macchiato.green}"`)
    expect(appIconSvg({ theme: 'latte', accent: 'green' })).toContain(`fill="${PALETTES.latte.base}"`)
  })
})
