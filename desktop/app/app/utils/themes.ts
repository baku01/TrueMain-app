import type { Accent, Palette } from '~/utils/catppuccin'
import { PALETTES, mix } from '~/utils/catppuccin'
// The player's own pictures of Cinnamoroll for its themes' icons, inlined: the icon is drawn from an SVG that can reach nothing outside itself.
import cinnamorollVampire from '~/assets/theme-icons/cinnamoroll-vampire.png?inline'
import cinnamorollWitch from '~/assets/theme-icons/cinnamoroll-witch.png?inline'
// The player's pictures for two more: K/DA's FIRESTARTER cover and a Christmas Kayn, 256 px JPEGs (12 KB each).
import kdaFirestarter from '~/assets/theme-icons/kda-firestarter.jpg?inline'
import christmasKayn from '~/assets/theme-icons/christmas-kayn.jpg?inline'

/**
 * Every theme painted from a palette (`utils/app-theme`), each written in
 * Catppuccin's 26 names so one set of rules lays any of them out: Catppuccin's
 * four flavours as they are, and ten more from their own published palettes,
 * their colours put where Catppuccin's guide puts the same role — the page
 * (`base`), the panes beside it (`mantle`, `crust`), type (`text`), and the
 * accents. Where a palette has no colour for a name (Dracula has no blue,
 * Rosé Pine no green), the nearest it has stands in, and its greys are laid
 * between its base and its text the way Catppuccin's are.
 */
export interface ThemeDef {
  palette: Palette
  light: boolean
  /** The accent the theme opens on: its signature colour. */
  accent: Accent
  /** Its light or dark twin, for the top bar's switch; none goes to Catppuccin Latte (or back to the last dark theme). */
  pair?: string
  /**
   * The app icon's own tile and what is drawn on it, where the theme does not
   * take its base and accent: the mark in a colour, or a picture filling the
   * tile (a data URI).
   */
  icon?: { tile: string, mark: string } | { image: string }
  /** Tokens the theme sets by hand over what its palette lays out (`flavorTokens`). */
  tokens?: Record<string, string>
  /** Rules of its own, `&` standing for the theme's root (`themeCss`). */
  css?: string
}

/** The greys between a palette's base and its text, at Catppuccin's own steps. */
const GREYS = { surface0: 0.12, surface1: 0.2, surface2: 0.28, overlay0: 0.37, overlay1: 0.46, overlay2: 0.55, subtext0: 0.66, subtext1: 0.78 } as const

interface Spec {
  base: string
  mantle: string
  crust: string
  text: string
  red: string
  peach: string
  yellow: string
  green: string
  teal: string
  sky: string
  blue: string
  mauve: string
  pink: string
  maroon?: string
  sapphire?: string
  lavender?: string
  rosewater?: string
  flamingo?: string
}

function palette(spec: Spec): Palette {
  const greys = Object.fromEntries(Object.entries(GREYS).map(([name, at]) => [name, mix(spec.base, spec.text, at)])) as Record<keyof typeof GREYS, string>
  return {
    ...greys,
    base: spec.base,
    mantle: spec.mantle,
    crust: spec.crust,
    text: spec.text,
    red: spec.red,
    maroon: spec.maroon ?? mix(spec.red, spec.text, 0.25),
    peach: spec.peach,
    yellow: spec.yellow,
    green: spec.green,
    teal: spec.teal,
    sky: spec.sky,
    sapphire: spec.sapphire ?? mix(spec.sky, spec.blue, 0.5),
    blue: spec.blue,
    lavender: spec.lavender ?? mix(spec.blue, spec.mauve, 0.5),
    mauve: spec.mauve,
    pink: spec.pink,
    flamingo: spec.flamingo ?? mix(spec.pink, spec.red, 0.35),
    rosewater: spec.rosewater ?? mix(spec.pink, spec.text, 0.55),
  }
}

/**
 * The secondary type of the app's own light themes, read against its page as
 * much as its panes: at Catppuccin's steps their greys came to 2.1–3.9:1 on
 * the page, under the 4.5:1 small text needs. Each step is how far from the
 * base toward the text: muted text 4.5:1 and dimmed 3:1 on the page, the
 * tones above them kept in order.
 */
const LIGHT_TEXT = { text: 0.86, toned: 0.76, muted: 0.66, dimmed: 0.54 } as const
/** On a pink page (Cinnamoroll's, Sakura's), deeper for the same contrast. */
const PINK_TEXT = { text: 0.92, toned: 0.86, muted: 0.79, dimmed: 0.63 } as const

function readableText(base: string, text: string, steps: { text: number, toned: number, muted: number, dimmed: number }): Record<string, string> {
  return {
    '--ui-text': mix(base, text, steps.text),
    '--ui-text-toned': mix(base, text, steps.toned),
    '--ui-text-muted': mix(base, text, steps.muted),
    '--ui-text-dimmed': mix(base, text, steps.dimmed),
  }
}

/**
 * Cinnamoroll's pink (#f5d6e1) where it is seen first: on the light theme the
 * frame — the side rail and the top bar (`--ui-bg-elevated`) — is the pink
 * itself, the page a paler pink under white panes, hovers and borders its
 * deeper tints, the open section of the rail a white pill on it; on the
 * night twin that section is a pill of the pink, read in the dark text that
 * stays legible on it (6.8:1).
 */
const CINNAMOROLL_LIGHT: Record<string, string> = {
  ...readableText('#fffafc', '#4b4363', PINK_TEXT),
  '--ui-bg-elevated': '#f5d6e1',
  '--ui-bg': '#fdf0f5',
  '--ui-bg-muted': '#fae4ec',
  '--ui-bg-accented': '#efc3d4',
  '--ui-bg-surface': '#ffffff',
  '--tm-pane': '#ffffff',
  '--tm-pane-2': '#fdf0f5',
  '--ui-border': '#f0cada',
  '--ui-border-accented': '#e6b2c6',
}
const CINNAMOROLL_NIGHT: Record<string, string> = {
  '--ui-border': '#463a4c',
  '--ui-border-accented': '#5e4c62',
}
// On the light frame, already the pink, the open section is a white pill; on the night's dark frame, a pill of the pink.
const CINNAMOROLL_CSS = `& .rail-item[data-active] { background-color: #ffffff; color: #4b4363; box-shadow: 0 1px 3px rgb(184 77 120 / 0.2); }
& .rail-item[data-active] .rail-icon { color: #b84d78; }
& .rail-item[data-active]::before { background: #b84d78; }`
const CINNAMOROLL_NIGHT_CSS = `& .rail-item[data-active] { background-color: #f5d6e1; color: #2b2433; }
& .rail-item[data-active] .rail-icon { color: #b84d78; }
& .rail-item[data-active]::before { background: #f5d6e1; }`

/**
 * Cinnamoroll Sakura: a sakura-pink frame (#ffd9e4) around a paler pink page
 * and white panes, the puppy's own colours for the rest — its blue outline
 * for type (8.9:1 on white), its sky blue for the allies and information, a
 * rose for the accent that small text can carry (4.55:1 on white).
 */
const SAKURA_LIGHT: Record<string, string> = {
  ...readableText('#ffffff', '#3d4a66', PINK_TEXT),
  '--ui-bg-elevated': '#ffd9e4',
  '--ui-bg': '#fff0f4',
  '--ui-bg-muted': '#ffe6ee',
  '--ui-bg-accented': '#ffc9da',
  '--ui-bg-surface': '#ffffff',
  '--tm-pane': '#ffffff',
  '--tm-pane-2': '#fff5f8',
  '--ui-border': '#fbd0de',
  '--ui-border-accented': '#f5b5ca',
}
const SAKURA_CSS = `& .rail-item[data-active] { background-color: #ffffff; color: #3d4a66; box-shadow: 0 1px 3px rgb(207 63 116 / 0.18); }
& .rail-item[data-active] .rail-icon { color: #cf3f74; }
& .rail-item[data-active]::before { background: #cf3f74; }`

const SOLARIZED = { red: '#dc322f', peach: '#cb4b16', yellow: '#b58900', green: '#859900', teal: '#2aa198', sky: '#2aa198', blue: '#268bd2', mauve: '#6c71c4', pink: '#d33682' }

export const THEMES = {
  'latte': { palette: PALETTES.latte, light: true, accent: 'mauve' },
  'frappe': { palette: PALETTES.frappe, light: false, accent: 'mauve' },
  'macchiato': { palette: PALETTES.macchiato, light: false, accent: 'mauve' },
  'mocha': { palette: PALETTES.mocha, light: false, accent: 'mauve' },
  // Dracula (draculatheme.com).
  'dracula': { light: false, accent: 'mauve', palette: palette({ base: '#282a36', mantle: '#21222c', crust: '#191a21', text: '#f8f8f2', red: '#ff5555', peach: '#ffb86c', yellow: '#f1fa8c', green: '#50fa7b', teal: '#8be9fd', sky: '#8be9fd', blue: '#6994f2', mauve: '#bd93f9', pink: '#ff79c6', lavender: '#d6acff' }) },
  // Nord (nordtheme.com): Polar Night, Snow Storm, Frost, Aurora.
  'nord': { light: false, accent: 'sky', palette: palette({ base: '#2e3440', mantle: '#292e39', crust: '#242933', text: '#eceff4', red: '#bf616a', peach: '#d08770', yellow: '#ebcb8b', green: '#a3be8c', teal: '#8fbcbb', sky: '#88c0d0', sapphire: '#81a1c1', blue: '#5e81ac', mauve: '#b48ead', pink: '#c895bf' }) },
  // Gruvbox (morhetz/gruvbox), dark and light.
  'gruvbox-dark': { light: false, accent: 'peach', pair: 'gruvbox-light', palette: palette({ base: '#282828', mantle: '#1d2021', crust: '#161819', text: '#ebdbb2', red: '#fb4934', maroon: '#cc241d', peach: '#fe8019', yellow: '#fabd2f', green: '#b8bb26', teal: '#8ec07c', sky: '#83a598', blue: '#83a598', sapphire: '#458588', mauve: '#d3869b', pink: '#d3869b' }) },
  'gruvbox-light': { light: true, accent: 'peach', pair: 'gruvbox-dark', palette: palette({ base: '#fbf1c7', mantle: '#f2e5bc', crust: '#ebdbb2', text: '#3c3836', red: '#9d0006', peach: '#af3a03', yellow: '#b57614', green: '#79740e', teal: '#427b58', sky: '#076678', blue: '#076678', mauve: '#8f3f71', pink: '#8f3f71' }) },
  // Tokyo Night (folke/tokyonight.nvim, night).
  'tokyo-night': { light: false, accent: 'blue', palette: palette({ base: '#1a1b26', mantle: '#16161e', crust: '#121218', text: '#c0caf5', red: '#f7768e', peach: '#ff9e64', yellow: '#e0af68', green: '#9ece6a', teal: '#73daca', sky: '#7dcfff', sapphire: '#2ac3de', blue: '#7aa2f7', mauve: '#bb9af7', pink: '#ff75a0', lavender: '#b4f9f8' }) },
  // Rosé Pine (rosepinetheme.com), main and Dawn: love, gold, rose, pine, foam, iris.
  'rose-pine': { light: false, accent: 'rosewater', pair: 'rose-pine-dawn', palette: palette({ base: '#1f1d2e', mantle: '#191724', crust: '#13111c', text: '#e0def4', red: '#eb6f92', peach: '#f6c177', yellow: '#f6c177', green: '#9ccfd8', teal: '#9ccfd8', sky: '#9ccfd8', blue: '#3e8fb0', mauve: '#c4a7e7', pink: '#ebbcba', rosewater: '#ebbcba', flamingo: '#ebbcba' }) },
  'rose-pine-dawn': { light: true, accent: 'rosewater', pair: 'rose-pine', palette: palette({ base: '#fffaf3', mantle: '#faf4ed', crust: '#f2e9e1', text: '#575279', red: '#b4637a', peach: '#ea9d34', yellow: '#ea9d34', green: '#56949f', teal: '#56949f', sky: '#56949f', blue: '#286983', mauve: '#907aa9', pink: '#d7827e', rosewater: '#d7827e', flamingo: '#d7827e' }) },
  // Solarized (ethanschoonover.com/solarized), dark and light: the same eight accents on both.
  'solarized-dark': { light: false, accent: 'blue', pair: 'solarized-light', palette: palette({ base: '#073642', mantle: '#002b36', crust: '#00212b', text: '#eee8d5', ...SOLARIZED }) },
  'solarized-light': { light: true, accent: 'blue', pair: 'solarized-dark', palette: palette({ base: '#fdf6e3', mantle: '#eee8d5', crust: '#e4ddc8', text: '#073642', ...SOLARIZED }) },
  // One Dark (Atom's).
  'one-dark': { light: false, accent: 'blue', palette: palette({ base: '#282c34', mantle: '#21252b', crust: '#1b1f24', text: '#dcdfe4', red: '#e06c75', peach: '#d19a66', yellow: '#e5c07b', green: '#98c379', teal: '#56b6c2', sky: '#56b6c2', blue: '#61afef', mauve: '#c678dd', pink: '#e386c4' }) },
  // Soviet: the banner's red and gold on black, the posters' paper for type.
  'soviet': { light: false, accent: 'red', icon: { tile: '#b3000c', mark: '#ffcc00' }, palette: palette({ base: '#211a19', mantle: '#161010', crust: '#0f0a0a', text: '#f2e6d0', red: '#e0161f', maroon: '#a3121a', peach: '#e0672a', yellow: '#ffcc00', green: '#7f9a3a', teal: '#5f9e8f', sky: '#8fb2c2', blue: '#5b7fb5', mauve: '#b06a8a', pink: '#e07a86', rosewater: '#f2d7b0', flamingo: '#e8a98a' }) },
  // Cinnamoroll: a pastel pink page (#f5d6e1) under white panes, the puppy's sky blue beside it. On the light page
  // the pink is too pale to be read (1.3:1 on white), so the accent there is its deep shade (4.65:1); the night
  // twin takes the pink itself as its accent.
  'cinnamoroll': { light: true, accent: 'pink', pair: 'cinnamoroll-night', icon: { image: cinnamorollVampire }, tokens: CINNAMOROLL_LIGHT, css: CINNAMOROLL_CSS, palette: palette({ base: '#fffafc', mantle: '#fcf0f5', crust: '#f5d6e1', text: '#4b4363', red: '#d04a6c', peach: '#d9773f', yellow: '#c08a1e', green: '#3f9a72', teal: '#2f9a9c', sky: '#3a9fd0', blue: '#3d84c7', mauve: '#9a5fb5', pink: '#b84d78', rosewater: '#d98aa7', flamingo: '#d97893', lavender: '#7d7fd6' }) },
  'cinnamoroll-night': { light: false, accent: 'pink', pair: 'cinnamoroll', icon: { image: cinnamorollWitch }, tokens: CINNAMOROLL_NIGHT, css: CINNAMOROLL_NIGHT_CSS, palette: palette({ base: '#302937', mantle: '#241e2b', crust: '#1d1823', text: '#f7eef3', red: '#f28aa5', peach: '#f6b89a', yellow: '#f6dc9a', green: '#a8dcc0', teal: '#9fdcdc', sky: '#a8d8f0', blue: '#8ec5ec', mauve: '#d6b3ec', pink: '#f5d6e1', rosewater: '#f5d6e1', flamingo: '#f0bfd0', lavender: '#c6c8f5' }) },
  'cinnamoroll-sakura': { light: true, accent: 'pink', icon: { image: cinnamorollVampire }, tokens: SAKURA_LIGHT, css: SAKURA_CSS, palette: palette({ base: '#ffffff', mantle: '#fff0f4', crust: '#ffd9e4', text: '#3d4a66', red: '#d6435e', peach: '#e07a4f', yellow: '#c08a1e', green: '#3f9a6f', teal: '#2a9d9a', sky: '#3b9ad6', blue: '#2f7fc2', mauve: '#9a6fd0', pink: '#cf3f74', rosewater: '#f4a3bd', flamingo: '#ec8fae', lavender: '#7f8ce0' }) },
  // K/DA FIRESTARTER: the cover's wine black for the page, its title's pale pink for type, its neon magenta for the
  // accent — lifted from the cover's #d41263 (3.7:1 on the page) to #ff4f93 (6.2:1) so small text can carry it —, its
  // crimson and rose beside it. The light twin: the title's pink for the page, the cover's wine for type, the magenta
  // deepened to #c2105a (5.6:1).
  'kda-firestarter': { light: false, accent: 'pink', pair: 'kda-firestarter-light', icon: { image: kdaFirestarter }, palette: palette({ base: '#250d14', mantle: '#18050b', crust: '#110308', text: '#fad7e0', red: '#ff5a6e', maroon: '#a3194d', peach: '#ff8a6b', yellow: '#ffc56b', green: '#5fd6a0', teal: '#4fd0cc', sky: '#7cc4f2', blue: '#6f9cff', mauve: '#c77dff', pink: '#ff4f93', flamingo: '#d26a8e', rosewater: '#e29eb3', lavender: '#e3a6ff' }) },
  'kda-firestarter-light': { light: true, accent: 'pink', pair: 'kda-firestarter', icon: { image: kdaFirestarter }, tokens: readableText('#fff5f8', '#3a0a18', LIGHT_TEXT), palette: palette({ base: '#fff5f8', mantle: '#fde8ef', crust: '#fad7e0', text: '#3a0a18', red: '#c8183e', maroon: '#8f0c31', peach: '#b4461f', yellow: '#8f6200', green: '#1a7a4f', teal: '#137f7c', sky: '#1c6ea6', blue: '#3a5fd0', mauve: '#8a3fc4', pink: '#c2105a', flamingo: '#b8476b', rosewater: '#d26a8e', lavender: '#7a5ad0' }) },
  // Christmas: the night's navy behind Kayn for the page, Santa's hat for the accent (its #d55b50 lit to #ef6a5f, 5.5:1
  // on the page), the fur's white for type, a Christmas green and the ornaments' gold beside them. The light twin
  // (Snow): snow for the page, the navy for type, the hat's red deepened to #c0392b (5.2:1).
  'christmas': { light: false, accent: 'red', pair: 'christmas-light', icon: { image: christmasKayn }, palette: palette({ base: '#141c37', mantle: '#101321', crust: '#0b0e1a', text: '#ecebee', red: '#ef6a5f', maroon: '#a62f2f', peach: '#f0935f', yellow: '#f2c14e', green: '#5cc785', teal: '#4fb8a8', sky: '#8fbde6', blue: '#5b8fd6', mauve: '#a98bd6', pink: '#ec8fa6', rosewater: '#f3e9e4', flamingo: '#e8a49a', lavender: '#b9c3f0' }) },
  'christmas-light': { light: true, accent: 'red', pair: 'christmas', icon: { image: christmasKayn }, tokens: readableText('#f7f9fc', '#141c37', LIGHT_TEXT), palette: palette({ base: '#f7f9fc', mantle: '#eef2f8', crust: '#e2e8f2', text: '#141c37', red: '#c0392b', maroon: '#8e2a26', peach: '#b04d18', yellow: '#8f6200', green: '#1e7d45', teal: '#167a70', sky: '#2a6fae', blue: '#2b4c9a', mauve: '#6f4fb0', pink: '#b8406a', rosewater: '#c58a7f', flamingo: '#c06a5f', lavender: '#5a6ac8' }) },
} satisfies Record<string, ThemeDef>

export type PaletteTheme = keyof typeof THEMES
export const PALETTE_THEMES = Object.keys(THEMES) as PaletteTheme[]
export const themeDef = (theme: PaletteTheme): ThemeDef => THEMES[theme] as ThemeDef
