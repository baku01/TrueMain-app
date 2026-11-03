import { syncDataSourceWithShell } from '~/utils/data-source'
/**
 * What makes the window read as an app rather than a page:
 *
 * - the platform on `<html>` (`platform-macos`, `platform-windows`), for the
 *   CSS that differs — the scrollbars;
 * - the native title bar dark or light as the page is (`set_window_theme`,
 *   which on Windows 11 also paints the caption the top bar's colour);
 * - on macOS the title bar is drawn over by the top bar (`tauri.macos.conf.json`):
 *   `in-tauri` and `fullscreen` say when the traffic lights sit in it;
 * - the routes the shell asks for (`app://navigate`: ⌘, opens Settings);
 * - in a release build, no browser reflexes: no right-click menu offering
 *   Reload or Inspect (inputs and selected text keep theirs, for copy and
 *   paste), no F5 / ⌘R reload, no print or find-in-page.
 *
 * The overlay's panels are pages of their own and are left as they are.
 */
const BROWSER_KEYS = new Set(['F3', 'F5', 'F7', 'F12'])
const BROWSER_CHORDS = new Set(['r', 'p', 'f', 'g', 'u', 'j'])

const editable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

export default defineNuxtPlugin(() => {
  const agent = navigator.userAgent
  const platform = agent.includes('Mac') ? 'macos' : agent.includes('Windows') ? 'windows' : 'other'
  document.documentElement.classList.add(`platform-${platform}`)

  if (!insideTauri()) return
  // The shell kept the last choice; this launch's says the same, or corrects an older build's.
  void syncDataSourceWithShell()
  if (location.hash.startsWith('#/overlay/')) return

  document.documentElement.classList.add('in-tauri')
  void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
    const window_ = getCurrentWindow()
    const follow = async () => document.documentElement.classList.toggle('fullscreen', await window_.isFullscreen())
    await follow()
    await window_.onResized(() => void follow())
  })

  const colorMode = useColorMode()
  const router = useRouter()
  void import('@tauri-apps/api/core').then(({ invoke }) => {
    watch(() => colorMode.value, value => void invoke('set_window_theme', { dark: value !== 'light' }).catch(() => {}), { immediate: true })
  })
  void import('@tauri-apps/api/event').then(({ listen }) => listen<string>('app://navigate', event => void router.push(event.payload)))

  if (import.meta.dev) return
  window.addEventListener('contextmenu', (event) => {
    if (!editable(event.target) && !window.getSelection()?.toString()) event.preventDefault()
  })
  window.addEventListener('keydown', (event) => {
    const chord = (event.ctrlKey || event.metaKey) && BROWSER_CHORDS.has(event.key.toLowerCase())
    if (BROWSER_KEYS.has(event.key) || chord) event.preventDefault()
  }, { capture: true })
})
