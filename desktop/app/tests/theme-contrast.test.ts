import { describe, expect, it } from 'vitest'
import type { PaletteTheme } from '~/utils/themes'
import { flavorTokens } from '~/utils/app-theme'
import { themeDef } from '~/utils/themes'

/** WCAG's relative luminance and contrast ratio. */
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}
/** OKLab's lightness: how far apart two surfaces read. */
const lightness = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  const l = Math.cbrt(0.4122214708 * r! + 0.5363325634 * g! + 0.0514459929 * b!)
  const m = Math.cbrt(0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!)
  const s = Math.cbrt(0.0883024619 * r! + 0.2817188376 * g! + 0.629978711 * b!)
  return 0.2104542553 * l + 0.793617785 * m - 0.004072042 * s
}

/** The app's own themes: their secondary type legible on page and panes, their panes set apart from the page. */
const OWN: PaletteTheme[] = ['kda-firestarter', 'kda-firestarter-light', 'christmas', 'christmas-light', 'soviet', 'cinnamoroll', 'cinnamoroll-night', 'cinnamoroll-sakura'] as PaletteTheme[]

describe('the app\'s own themes', () => {
  for (const theme of OWN) {
    it(`${theme}: muted type 4.5:1 and dimmed 3:1 on its page and panes, panes apart from the page`, () => {
      const def = themeDef(theme)
      const tokens = { ...flavorTokens(theme, def.accent), ...def.tokens }
      for (const surface of [tokens['--ui-bg']!, tokens['--tm-pane']!]) {
        expect(contrast(tokens['--ui-text-muted']!, surface), `muted on ${surface}`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(tokens['--ui-text-dimmed']!, surface), `dimmed on ${surface}`).toBeGreaterThanOrEqual(3)
      }
      if (!def.light) expect(Math.abs(lightness(tokens['--tm-pane']!) - lightness(tokens['--ui-bg']!))).toBeGreaterThanOrEqual(0.04)
    })
  }
})
