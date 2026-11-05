/** A game time and when, on this page's clock, it was read. */
export interface ClockSync {
  gameTime: number
  at: number
}

/**
 * How far past its last reading the clock runs on its own: the game is read
 * every two seconds, so a reading later than this means the game stands still
 * (paused, not answering) — and the clock waits with it rather than run ahead.
 */
const AHEAD = 3

/** The game time at `now`: the reading's, run on since, never more than `AHEAD` seconds past it. */
export const clockAt = ({ gameTime, at }: ClockSync, now: number) => gameTime + Math.min(AHEAD, Math.max(0, now - at) / 1000)

/**
 * The game clock as the client shows it: the last reading's game time
 * (`useLiveGame`, set right every reading) run on this page's clock between
 * two readings. Ticks four times a second, so the second on screen turns when
 * the game's does rather than up to a second late, one repeated and the next
 * skipped.
 */
export function useGameClock(sync: () => ClockSync) {
  const now = ref(Date.now())
  let ticking: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    // A hidden window has no clock to show; it catches up on the next tick it is seen.
    ticking = setInterval(() => {
      if (!document.hidden) now.value = Date.now()
    }, 250)
  })
  onBeforeUnmount(() => clearInterval(ticking))
  return computed(() => clockAt(sync(), now.value))
}
