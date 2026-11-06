import type { AppTheme, ThemeChoice } from '~/utils/app-theme'
import type { Accent } from '~/utils/catppuccin'
import { ACCENT_KEY, DARK_FLAVOR_KEY, THEME_KEY, isFlavor, readThemeChoice, themeCss } from '~/utils/app-theme'
import { appIconSvg, rasterizeIcon } from '~/utils/app-icon'

const STYLE_ID = 'tm-theme'

function store(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice.theme)
    localStorage.setItem(ACCENT_KEY, choice.accent)
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
  const icon = svg ? await rasterizeIcon(svg).catch(() => null) : null
  if (svg && !icon) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_app_icon', icon ?? { png: null, rgba: null, size: 0 }).catch(() => {})
}

/**
 * The theme the player picked (`utils/app-theme`): TrueMain's or a Catppuccin
 * flavour, its accent, and the dark flavour the top bar's switch returns to.
 * A flavour sets the colour mode with it (Latte light, the others dark), so
 * Nuxt UI's `dark` class and the stylesheets' light and dark blocks follow.
 */
export function useAppTheme() {
  const choice = useState<ThemeChoice>('app-theme', () => readThemeChoice(import.meta.client ? localStorage : undefined))
  const colorMode = useColorMode()

  function apply(next: ThemeChoice) {
    choice.value = next
    store(next)
    if (isFlavor(next.theme)) colorMode.preference = next.theme === 'latte' ? 'light' : 'dark'
    paintTheme(next)
    void paintAppIcon(next)
  }

  const setTheme = (theme: AppTheme) => apply({ ...choice.value, theme, darkFlavor: isFlavor(theme) && theme !== 'latte' ? theme : choice.value.darkFlavor })
  const setAccent = (accent: Accent) => apply({ ...choice.value, accent })

  /** The top bar's switch: TrueMain's light and dark, or Latte and the dark flavour last used. */
  function toggleMode() {
    const { theme, darkFlavor } = choice.value
    if (!isFlavor(theme)) colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
    else setTheme(theme === 'latte' ? darkFlavor : 'latte')
  }

  return { choice: readonly(choice), setTheme, setAccent, toggleMode }
}
