import type { ClockSync } from '~/composables/useGameClock'
import type { GameChange, GameState, GameUpdate } from '~/types/game'

/**
 * Apply one reading's changes. The same rule as `GameState::apply` in
 * `crates/live-client/src/game.rs`, which keeps Rust's copy of the game and
 * this one equal: every change carries the new value, never a delta.
 */
export function applyGameChanges(game: GameState, changes: GameChange[]): GameState {
  const players = game.players.map(player => ({ ...player }))
  let gold = game.gold
  let objectives = game.objectives
  let pace = game.pace
  let vitals = game.vitals
  for (const change of changes) {
    if (change.kind === 'gold') {
      gold = change.gold
      continue
    }
    if (change.kind === 'objectives') {
      objectives = change.objectives
      continue
    }
    if (change.kind === 'pace') {
      pace = change.pace
      continue
    }
    if (change.kind === 'vitals') {
      vitals = change.vitals
      continue
    }
    const player = players[change.player]
    if (!player) continue
    switch (change.kind) {
      case 'items': player.items = change.items; break
      case 'levelUp': player.level = change.level; break
      case 'score':
        player.kills = change.kills
        player.deaths = change.deaths
        player.assists = change.assists
        player.creepScore = change.creepScore
        player.wardScore = change.wardScore
        break
      case 'died':
        player.dead = true
        player.respawnAt = change.respawnAt
        break
      case 'respawned':
        player.dead = false
        player.respawnAt = null
        break
    }
  }
  return { ...game, players, gold, objectives, pace, vitals }
}

/**
 * The running game, as the shell reads it through the game's own API while
 * the phase is `InProgress` (#1748).
 *
 * Rust sends a snapshot when a game is first read and then only what changed
 * — a purchase, a level, a death — each update numbered. One that does not
 * follow the revision held here means one was missed (the page mounted
 * between two), and the whole state is read again rather than drawn with a
 * gap. In a plain browser the dev scenarios set it instead (`useDevScenarios`).
 */
export function useLiveGame() {
  const game = useState<GameState | null>('live-game', () => null)
  /** The latest game time and when it was read, on this page's clock: the clock on screen runs from it (`useGameClock`). */
  const sync = useState<ClockSync>('live-game-clock', () => ({ gameTime: 0, at: Date.now() }))
  const subscribed = useState<boolean>('live-game-subscribed', () => false)

  // Every change replaces the state whole, so it is held raw: no proxy over
  // ten players' items and stats, and the watchers that read it fire on the
  // replacement.
  function set(next: GameState | null) {
    game.value = next ? markRaw(next) : null
    sync.value = { gameTime: next?.gameTime ?? 0, at: Date.now() }
  }

  if (!subscribed.value) {
    subscribed.value = true
    onMounted(subscribe)
  }

  async function subscribe() {
    if (!insideTauri()) return

    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')

    // Bumped by every event: a read that an event overtook is older than what
    // is already on screen, and is dropped.
    let epoch = 0
    async function resync() {
      const at = epoch
      const read = await invoke<GameState | null>('current_game')
      if (at === epoch) set(read)
    }

    const stopSnapshot = await listen<GameState | null>('game://snapshot', (event) => {
      epoch++
      set(event.payload)
    })
    const stopUpdate = await listen<GameUpdate>('game://update', (event) => {
      const update = event.payload
      const current = game.value
      if (current && update.revision <= current.revision) return
      if (!current || update.revision !== current.revision + 1) {
        void resync()
        return
      }
      epoch++
      set({ ...applyGameChanges(current, update.changes), revision: update.revision, gameTime: update.gameTime })
    })
    // A reading that moved nothing else still sets the clock right: minutes can pass without a change.
    const stopClock = await listen<number>('game://clock', (event) => {
      if (game.value) sync.value = { gameTime: event.payload, at: Date.now() }
    })
    onScopeDispose(() => {
      stopSnapshot()
      stopUpdate()
      stopClock()
    })

    // After subscribing, so nothing lands between the read and the listeners.
    await resync()
  }

  return { game, sync, set }
}
