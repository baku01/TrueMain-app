import type { ClockSync } from '~/composables/useGameClock'
import { clockAt } from '~/composables/useGameClock'
import type { GameState } from '~/types/game'
import type { Tip } from '~/utils/tips/catalogue'
import type { ShownTip } from '~/utils/tips/queue'
import { emptyMemory, evaluate } from '~/utils/tips/engine'
import { TipQueue } from '~/utils/tips/queue'
import { speaks, tipsRunning } from '~/utils/tips/settings'

/** How often the engine reads the game: the countdowns' marks are seconds apart, the queue's turns a few. */
const TICK_MS = 500

/** The event the app's window sends the overlay's with the tip on screen, or null between two. */
export const TIP_SHOWN_EVENT = 'tips://shown'

/**
 * The tips of the running game, shown while `onScreen` says the overlay
 * draws them: the engine (`utils/tips`) read twice a second
 * against the game clock run on from the last reading — and on every reading,
 * which comes every couple of seconds even when a hidden window's timers are
 * held back —, its tips queued unless the player switched their category
 * off, and the one the queue puts on screen said by the voice pack when the
 * voice is on and the pack has it. It runs while the tips are shown or spoken
 * (`tipsRunning`); one feed per game, so a tip is said once.
 */
export function useTipFeed(game: () => GameState | null, sync: () => ClockSync, onScreen: () => boolean = () => true) {
  const { settings } = useTipSettings()
  const { items } = useStaticData()
  const voice = useTipVoice()
  const queue = new TipQueue()
  let memory = emptyMemory()
  const shown = shallowRef<ShownTip | null>(null)

  function tick() {
    const now = Date.now()
    const running = tipsRunning(settings.value, onScreen())
    const current = game()
    if (current && running) {
      const read = evaluate(memory, current, clockAt(sync(), now), items.value)
      memory = read.memory
      for (const tip of read.tips) {
        if (settings.value.categories[tip.category]) queue.push(tip, now)
      }
    }
    const next = running ? queue.current(now) : null
    if (next?.tip.id === shown.value?.tip.id) return
    shown.value = next
    if (next && speaks(settings.value)) void voice.say(next.tip)
  }

  // Switched off mid-game: what waits goes, and nothing is said.
  watch(() => tipsRunning(settings.value, onScreen()), (on) => {
    if (on) return
    queue.clear()
    voice.stop()
  })
  // The voice alone switched off: the line being said stops, the text stays.
  watch(() => speaks(settings.value), on => on || voice.stop())
  // The game over: nothing of it is said after (a new game's roster restarts the engine's memory).
  watch(() => game() === null, (over) => {
    if (!over) return
    queue.clear()
    voice.stop()
  })
  watch(() => sync().at, tick)

  let ticking: ReturnType<typeof setInterval> | undefined
  onMounted(() => (ticking = setInterval(tick, TICK_MS)))
  onBeforeUnmount(() => clearInterval(ticking))

  /** Queue a tip from outside the engine: a browser-only `npm run dev`'s forced tips. */
  function push(tip: Tip) {
    queue.push(tip, Date.now())
    tick()
  }

  return { shown, push }
}

/**
 * The tips' feed in the app's window, for the whole of its life: it is
 * there whatever the overlay shows — off, its tips panel off or up only on a
 * chord —, so the voice is never the overlay's to silence. The tip on screen
 * goes to the overlay's windows (`TIP_SHOWN_EVENT`), which only draw it.
 */
export function useAppTipFeed() {
  const { game, sync } = useLiveGame()
  const { view } = useGameOverlay()
  const onScreen = () => !!view.value?.settings.enabled && !!view.value.settings.tips.enabled
  const { shown } = useTipFeed(() => game.value, () => sync.value, onScreen)
  if (!import.meta.client || !insideTauri()) return
  watch(shown, async (tip) => {
    const { emit } = await import('@tauri-apps/api/event')
    await emit(TIP_SHOWN_EVENT, tip).catch(() => {})
  })
}
