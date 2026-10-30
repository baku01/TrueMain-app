import type { Plan, Progress } from '~/utils/high-elo'

/**
 * The high-elo collection runs by itself (`src-tauri/src/highelo.rs`): when
 * the app opens with a Riot key saved, when a key is saved, and again every
 * so often to pick up the games played since — never from a button. It stops
 * trying when Riot refuses the key, until a new one is saved, and it never
 * runs in an overlay panel, a browser preview or without a key.
 *
 * What it collects is not up to the player here: the Challenger and
 * Grandmaster ladder of the server chosen beside the key, ten games each,
 * best players first, so useful numbers appear soon and the rest fill in.
 */
const PLAN: Omit<Plan, 'platform'> = { tiers: 'challenger-grandmaster', players: 1000, gamesPerPlayer: 10 }
const PLATFORM_KEY = 'truemain-riot-platform'
/** How long after a run ends the next one may begin: new games are played all day, and the ladder moves. */
const REST_MS = 20 * 60 * 1000
const CHECK_MS = 15 * 1000

export default defineNuxtPlugin(() => {
  if (!insideTauri() || location.hash.startsWith('#/overlay/')) return

  let rested = 0
  let refused = false
  let busy = false

  async function invoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
    const { invoke: call } = await import('@tauri-apps/api/core')
    return await call<T>(command, args)
  }

  async function tick() {
    if (busy) return
    busy = true
    try {
      const key = await invoke<{ saved: boolean, masked: string | null }>('riot_key_status')
      const progress = await invoke<Progress>('highelo_progress')
      // A key saved after a refusal is a new key.
      const masked = key.masked ?? ''
      if (refused && masked !== lastMasked) refused = false
      lastMasked = masked
      if (progress.running) {
        rested = 0
        return
      }
      if (progress.phase === 'failed' && /refused the key/i.test(progress.error ?? '')) refused = true
      if (!key.saved || refused) return
      if (rested === 0) rested = Date.now()
      const first = progress.phase === ''
      if (!first && Date.now() - rested < REST_MS) return
      let platform = 'br1'
      try {
        platform = localStorage.getItem(PLATFORM_KEY) || 'br1'
      }
      catch {
        // Storage unavailable: the default server.
      }
      await invoke('highelo_start', { plan: { ...PLAN, platform } })
      rested = 0
    }
    catch {
      // A run already going, or the shell not ready: the next tick tries again.
    }
    finally {
      busy = false
    }
  }

  let lastMasked = ''
  void tick()
  setInterval(() => void tick(), CHECK_MS)
})
