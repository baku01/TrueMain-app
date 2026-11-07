import type { ClockSync } from '~/composables/useGameClock'
import { clockAt } from '~/composables/useGameClock'
import type { GameState } from '~/types/game'
import type { Tip } from '~/utils/tips/catalogue'
import type { ShownTip } from '~/utils/tips/queue'
import { emptyMemory, evaluate } from '~/utils/tips/engine'
import { TipQueue } from '~/utils/tips/queue'

/** How often the engine reads the game: the countdowns' marks are seconds apart, the queue's turns a few. */
const TICK_MS = 500

/**
 * The tips of the running game, for the overlay: the engine (`utils/tips`)
 * read twice a second against the game clock run on from the last reading,
 * its tips queued unless the player switched their category off, and the
 * one the queue puts on screen said by the voice pack, if one is chosen and
 * has it. Only the objectives panel runs it, so a tip is said once.
 */
export function useTipFeed(game: () => GameState | null, sync: () => ClockSync) {
  const { settings } = useTipSettings()
  const { items } = useStaticData()
  const voice = useTipVoice()
  const queue = new TipQueue()
  let memory = emptyMemory()
  const shown = shallowRef<ShownTip | null>(null)

  function tick() {
    const now = Date.now()
    const current = game()
    if (current && settings.value.enabled) {
      const read = evaluate(memory, current, clockAt(sync(), now), items.value)
      memory = read.memory
      for (const tip of read.tips) {
        if (settings.value.categories[tip.category]) queue.push(tip, now)
      }
    }
    const next = settings.value.enabled ? queue.current(now) : null
    if (next?.tip.id === shown.value?.tip.id) return
    shown.value = next
    if (next) void voice.say(next.tip)
  }

  // Switched off mid-game: what waits goes, and nothing is said.
  watch(() => settings.value.enabled, (on) => {
    if (on) return
    queue.clear()
    voice.stop()
  })

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
