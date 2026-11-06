import type { AppTheme, ThemeChoice } from '~/utils/app-theme'
import type { Accent } from '~/utils/catppuccin'
import { ACCENTS_KEY, DARK_FLAVOR_KEY, THEME_KEY, accentOf, isLight, isPaletteTheme, readThemeChoice, themeCss } from '~/utils/app-theme'
import { themeDef } from '~/utils/themes'
import { appIconSvg, rasterizeIcon } from '~/utils/app-icon'

const STYLE_ID = 'tm-theme'

function store(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice.theme)
    localStorage.setItem(ACCENTS_KEY, JSON.stringify(choice.accents))
    localStorage.setItem(DARK_FLAVOR_KEY, choice.darkFlavor)
  }
  catch {
    // Storage unavailable: the theme holds until the window closes.
  }
}

/** The theme on `<html>`: its attribute and the stylesheet that restates the tokens (`themeCss`); nothing of either for TrueMain. */
export function paintTheme(choice: ThemeChoice) {
  const root = document.documentElement
  const css = themeCss(choice)
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!css) {
    root.removeAttribute('data-theme')
    style?.remove()
    return
  }
  root.setAttribute('data-theme', choice.theme)
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = css
}

/**
 * The app icon in the theme's colours — the dock, the taskbar and the tray
 * (`set_app_icon`); TrueMain's puts the bundle's own back. The main window
 * alone asks, once per change. On macOS it holds while the app runs: Finder
 * and the Dock's icon at rest stay the bundle's, which a running app cannot
 * rewrite.
 */
export async function paintAppIcon(choice: ThemeChoice) {
  if (!insideTauri() || location.hash.startsWith('#/overlay/')) return
  const svg = appIconSvg(choice)
  const icon = svg ? await rasterizeIcon(svg, appIconSvg(choice, true)!).catch(() => null) : null
  if (svg && !icon) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_app_icon', icon ?? { png: null, rgba: null, size: 0 }).catch(() => {})
}

/**
 * The theme the player picked (`utils/app-theme`): TrueMain's or a palette
 * theme, the accent each theme was given, and the dark theme the top bar's
 * switch returns to. A palette theme sets the colour mode with it (light or
 * dark as it is), so Nuxt UI's `dark` class and the stylesheets' light and
 * dark blocks follow.
 */
export function useAppTheme() {
  const choice = useState<ThemeChoice>('app-theme', () => readThemeChoice(import.meta.client ? localStorage : undefined))
  const colorMode = useColorMode()

  function apply(next: ThemeChoice) {
    choice.value = next
    store(next)
    if (isPaletteTheme(next.theme)) colorMode.preference = isLight(next.theme) ? 'light' : 'dark'
    paintTheme(next)
    void paintAppIcon(next)
  }

  function setTheme(theme: AppTheme) {
    const { accents, darkFlavor } = choice.value
    apply({ ...choice.value, theme, accent: accentOf(theme, accents), darkFlavor: isPaletteTheme(theme) && !isLight(theme) ? theme : darkFlavor })
  }
  function setAccent(accent: Accent) {
    const { theme, accents } = choice.value
    apply({ ...choice.value, accent, accents: isPaletteTheme(theme) ? { ...accents, [theme]: accent } : accents })
  }

  /**
   * The top bar's switch: TrueMain's light and dark; a theme's twin (Gruvbox,
   * Rosé Pine, Solarized); else Catppuccin Latte from a dark theme, and from
   * a light one the dark theme last used.
   */
  function toggleMode() {
    const { theme, darkFlavor } = choice.value
    if (!isPaletteTheme(theme)) {
      colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
      return
    }
    const pair = themeDef(theme).pair
    if (pair && isPaletteTheme(pair)) setTheme(pair)
    else setTheme(isLight(theme) ? darkFlavor : 'latte')
  }

  return { choice: readonly(choice), setTheme, setAccent, toggleMode }
}
