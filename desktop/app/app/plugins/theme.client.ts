import { readThemeChoice } from '~/utils/app-theme'
import { paintAppIcon, paintTheme } from '~/composables/useAppTheme'

/**
 * The kept theme on the page before it first draws (`useAppTheme`), in every
 * window — the overlay's panels too — and, in the main window, on the app
 * icon. A Catppuccin flavour also holds the colour mode to its own (Latte
 * light, the others dark), whatever the switch last said under TrueMain.
 */
export default defineNuxtPlugin({
  name: 'app-theme',
  setup() {
    const choice = readThemeChoice(localStorage)
    paintTheme(choice)
    if (choice.theme !== 'truemain') {
      const colorMode = useColorMode()
      const mode = choice.theme === 'latte' ? 'light' : 'dark'
      if (colorMode.preference !== mode) colorMode.preference = mode
      void paintAppIcon(choice)
    }
  },
})
