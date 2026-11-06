import type { Accent, Palette } from '~/utils/catppuccin'
import type { PaletteTheme } from '~/utils/themes'
import { ACCENTS, mix } from '~/utils/catppuccin'
import { PALETTE_THEMES, THEMES, themeDef } from '~/utils/themes'

/**
 * The app's themes: TrueMain's own (navy and blue, dark or light by the top
 * bar's switch) or one painted from a palette (`utils/themes`) — Catppuccin's
 * four flavours, Dracula, Nord, Gruvbox, Tokyo Night, Rosé Pine, Solarized,
 * One Dark — in any of its fourteen accents, each theme keeping its own.
 * Kept across launches, in every window (the overlay's panels too).
 *
 * TrueMain's colours are the stylesheet's (`assets/css/main.css`). A palette
 * theme restates the same custom properties (`themeCss`), so every component —
 * written against the tokens, never a hex — takes it without knowing: the
 * page, the panes and their ladder, text, borders, the accent and its ramp,
 * the data and tier colours, the stats', the two teams', the tier medals'
 * metals and the app's mark.
 */
export const APP_THEMES = ['truemain', ...PALETTE_THEMES] as const
export type AppTheme = 'truemain' | PaletteTheme

export const THEME_KEY = 'truemain-theme'
/** The accent each theme was last given, by theme (JSON). */
export const ACCENTS_KEY = 'truemain-theme-accents'
/** The one accent kept before themes had their own: Catppuccin's flavours start on it. */
export const ACCENT_KEY = 'truemain-theme-accent'
/** The dark theme the top bar's switch goes back to from a light one with no twin. */
export const DARK_FLAVOR_KEY = 'truemain-theme-dark'

const CATPPUCCIN = new Set<string>(['latte', 'frappe', 'macchiato', 'mocha'])

export const isPaletteTheme = (theme: string): theme is PaletteTheme => theme in THEMES
export const isAccent = (accent: string): accent is Accent => (ACCENTS as readonly string[]).includes(accent)
export const isLight = (theme: AppTheme) => isPaletteTheme(theme) && themeDef(theme).light

export interface ThemeChoice {
  theme: AppTheme
  /** The accent on screen: the theme's own pick, else its signature colour. */
  accent: Accent
  /** Every theme's accent picked so far. */
  accents: Partial<Record<PaletteTheme, Accent>>
  darkFlavor: PaletteTheme
}

/** The accent `theme` shows: the one picked for it, else (a Catppuccin flavour) the one kept before, else its own. */
export function accentOf(theme: AppTheme, accents: ThemeChoice['accents'], legacy: string | null = null): Accent {
  if (!isPaletteTheme(theme)) return 'mauve'
  const picked = accents[theme]
  if (picked) return picked
  return legacy && isAccent(legacy) && CATPPUCCIN.has(theme) ? legacy : themeDef(theme).accent
}

/** The choice kept in `storage`; TrueMain and Mocha where nothing (or nothing valid) is. */
export function readThemeChoice(storage: Pick<Storage, 'getItem'> | undefined): ThemeChoice {
  const read = (key: string) => {
    try {
      return storage?.getItem(key) ?? ''
    }
    catch {
      return ''
    }
  }
  const stored = read(THEME_KEY)
  const theme: AppTheme = isPaletteTheme(stored) ? stored : 'truemain'
  let accents: ThemeChoice['accents'] = {}
  try {
    const parsed = JSON.parse(read(ACCENTS_KEY) || '{}') as Record<string, string>
    accents = Object.fromEntries(Object.entries(parsed).filter(([name, accent]) => isPaletteTheme(name) && isAccent(accent))) as ThemeChoice['accents']
  }
  catch {
    // A broken record: every theme on its own accent.
  }
  const dark = read(DARK_FLAVOR_KEY)
  return {
    theme,
    accent: accentOf(theme, accents, read(ACCENT_KEY)),
    accents,
    darkFlavor: isPaletteTheme(dark) && !themeDef(dark).light ? dark : 'mocha',
  }
}

const WHITE = '#ffffff'
const BLACK = '#000000'

/** The accent's eleven steps, `50`–`950`, the palette's own colour where Nuxt UI reads the primary: `400` on dark, `600` on light. */
function accentRamp(color: string, palette: Palette, light: boolean): string[] {
  return light
    ? [mix(color, WHITE, 0.92), mix(color, WHITE, 0.82), mix(color, WHITE, 0.66), mix(color, WHITE, 0.48), mix(color, WHITE, 0.3), mix(color, WHITE, 0.14), color, mix(color, BLACK, 0.15), mix(color, BLACK, 0.3), mix(color, BLACK, 0.45), mix(color, BLACK, 0.6)]
    : [mix(color, WHITE, 0.85), mix(color, WHITE, 0.7), mix(color, WHITE, 0.5), mix(color, WHITE, 0.25), color, mix(color, palette.crust, 0.15), mix(color, palette.crust, 0.3), mix(color, palette.crust, 0.45), mix(color, palette.crust, 0.6), mix(color, palette.crust, 0.72), mix(color, palette.crust, 0.85)]
}

/** The neutrals, `50` the lightest: the palette's text down to its crust on dark, its base down to its text (and past it) on light. */
function inkRamp(p: Palette, light: boolean): string[] {
  return light
    ? [p.base, p.crust, p.surface0, p.surface2, p.overlay1, p.subtext0, p.subtext1, p.text, mix(p.text, BLACK, 0.25), mix(p.text, BLACK, 0.45), mix(p.text, BLACK, 0.65)]
    : [mix(p.text, WHITE, 0.5), p.text, p.subtext1, p.subtext0, p.overlay2, p.overlay1, p.surface2, p.surface1, p.surface0, p.base, p.crust]
}

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

/**
 * Tailwind's own palettes the components still name — the result colours
 * (`result-tone.ts`: sky a win, red a loss), warnings in amber, a few chips —
 * each repointed at its Catppuccin counterpart, the win's sky at blue.
 */
const TAILWIND: Record<string, Accent> = { red: 'red', sky: 'blue', amber: 'yellow', yellow: 'yellow', orange: 'peach', cyan: 'sky', blue: 'blue', teal: 'teal', emerald: 'green', green: 'green', fuchsia: 'pink', violet: 'mauve', purple: 'mauve' }

/** A tier medal's metal, from one colour: its light and dark stops, its shine and its glow. */
const metal = (name: string, color: string): Record<string, string> => ({
  [`--tm-metal-${name}-light`]: mix(color, WHITE, 0.55),
  [`--tm-metal-${name}-dark`]: mix(color, BLACK, 0.3),
  [`--tm-metal-${name}-shine`]: mix(color, WHITE, 0.85),
  [`--tm-metal-${name}-glow`]: `${color}99`,
})

/** The app's mark (`AppMark`, the app icon): the accent, lit at the top and deepened at the foot. */
export const markStops = (color: string): [string, string, string] => [mix(color, WHITE, 0.45), color, mix(color, BLACK, 0.4)]

/** Every token a flavour restates, as custom properties. */
export function flavorTokens(theme: PaletteTheme, accent: Accent): Record<string, string> {
  const { palette: p, light } = themeDef(theme)
  const a = p[accent]
  const tokens: Record<string, string> = {
    'color-scheme': light ? 'light' : 'dark',
    '--ui-bg': light ? p.crust : p.mantle,
    '--ui-bg-muted': light ? p.mantle : p.crust,
    '--ui-bg-elevated': light ? p.base : mix(p.base, p.surface0, 0.3),
    '--ui-bg-accented': light ? mix(p.mantle, p.surface0, 0.5) : p.surface0,
    '--ui-bg-surface': light ? p.base : `${p.base}e6`,
    '--ui-border': p.surface0,
    '--ui-border-accented': p.surface1,
    '--tm-pane': p.base,
    '--tm-pane-2': light ? p.mantle : mix(p.base, p.surface0, 0.45),
    '--ui-text-highlighted': p.text,
    '--ui-text': p.subtext1,
    '--ui-text-toned': p.subtext0,
    '--ui-text-muted': p.overlay2,
    '--ui-text-dimmed': p.overlay1,
    '--ui-text-inverted': light ? p.base : p.crust,
    '--ui-primary': a,
    '--ui-success': p.green,
    '--ui-warning': p.yellow,
    '--ui-error': p.red,
    '--ui-info': p.teal,
    '--color-gold': p.yellow,
    '--color-ally': p.blue,
    '--color-enemy': p.red,
    '--color-data-good': a,
    '--color-data-good-dim': mix(a, p.overlay1, 0.5),
    '--color-data-mid': light ? p.overlay2 : p.overlay1,
    '--color-data-bad-dim': light ? p.subtext0 : p.overlay0,
    '--color-data-bad': light ? p.subtext1 : p.surface2,
    '--color-tier-s': a,
    '--color-tier-a': p.yellow,
    '--color-tier-b': light ? p.overlay2 : p.subtext0,
    '--color-tier-c': p.peach,
    '--color-tier-d': p.overlay0,
    '--color-stat-health': p.green,
    '--color-stat-armor': p.yellow,
    '--color-stat-mr': p.sky,
    '--color-stat-tenacity': p.lavender,
    '--color-stat-hsp': p.teal,
    '--color-stat-heal-reduction': p.maroon,
    '--color-stat-mana': p.sapphire,
    '--color-stat-haste': p.rosewater,
    '--color-stat-speed': p.subtext1,
    '--color-stat-ad': p.peach,
    '--color-stat-lethality': p.red,
    '--color-stat-crit': p.maroon,
    '--color-stat-as': p.yellow,
    '--color-stat-ap': p.lavender,
    '--color-stat-magicpen': p.pink,
    '--color-stat-vamp': p.red,
    '--color-stat-true': p.subtext1,
    '--color-stat-adaptive': p.teal,
    '--color-stat-status': p.pink,
    '--color-stat-stealth': p.flamingo,
    '--color-stat-shield': p.yellow,
    '--color-stat-gold': p.yellow,
    '--color-stat-passive': p.subtext1,
    '--color-stat-active': p.yellow,
    '--activity-empty-fill': p.surface0,
    '--skeleton-fill': light ? p.surface0 : p.surface1,
    ...metal('s', a),
    ...metal('a', p.yellow),
    ...metal('b', light ? p.overlay2 : p.subtext0),
    ...metal('c', p.peach),
    ...metal('d', p.overlay0),
  }
  const [top, middle, foot] = markStops(a)
  Object.assign(tokens, { '--tm-mark-1': top, '--tm-mark-2': middle, '--tm-mark-3': foot })
  accentRamp(a, p, light).forEach((color, index) => (tokens[`--color-rosegold-${STEPS[index]}`] = color))
  for (const [family, name] of Object.entries(TAILWIND)) accentRamp(p[name], p, light).forEach((color, index) => (tokens[`--color-${family}-${STEPS[index]}`] = color))
  inkRamp(p, light).forEach((color, index) => (tokens[`--color-ink-${STEPS[index]}`] = color))
  return Object.assign(tokens, themeDef(theme).tokens)
}

const block = (selector: string, tokens: Record<string, string>) =>
  `${selector} {\n${Object.entries(tokens).map(([name, value]) => `  ${name}: ${value};`).join('\n')}\n}`

/**
 * The stylesheet a flavour adds, at a weight that outranks the app's own
 * `:root`, `:root.dark` and `:root:not(.dark)` blocks whatever the order the
 * sheets land in. Over champion art (`.on-art`, always dark) Latte takes
 * Mocha's tones in the same accent, as TrueMain's light theme takes its dark
 * one there. Null for TrueMain: its colours are the stylesheet's.
 */
export function themeCss(choice: Pick<ThemeChoice, 'theme' | 'accent'>): string | null {
  if (!isPaletteTheme(choice.theme)) return null
  const def = themeDef(choice.theme)
  const root = `html:root[data-theme="${choice.theme}"]`
  const sheets = [block(root, flavorTokens(choice.theme, choice.accent))]
  if (def.css) sheets.push(def.css.replaceAll('&', root))
  // Over art a light theme takes its dark twin's tones, else Mocha's.
  const dark = def.pair && isPaletteTheme(def.pair) ? def.pair : 'mocha'
  if (def.light) sheets.push(block(`html:root[data-theme="${choice.theme}"] .on-art`, flavorTokens(dark, choice.accent)))
  return sheets.join('\n')
}

/** The native title bar's colour on Windows 11 (the top bar's, `--ui-bg-elevated`); null for TrueMain, whose own the shell keeps. */
export function captionColor(choice: Pick<ThemeChoice, 'theme' | 'accent'>): string | null {
  return isPaletteTheme(choice.theme) ? flavorTokens(choice.theme, choice.accent)['--ui-bg-elevated']! : null
}
