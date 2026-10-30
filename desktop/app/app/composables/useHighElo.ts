import type { ChampionStats, Plan, Progress } from '~/utils/high-elo'

const IDLE: Progress = {
  running: false, phase: '', platform: '', playersTotal: 0, playersDone: 0, matchesStored: 0,
  matchesQueued: 0, rowsStored: 0, calls: 0, gapMs: 1400, error: null,
}

/**
 * The high-elo collector (`src-tauri/src/highelo.rs`): start and stop it, follow
 * its progress while it runs (polled once a second, only then), and read a
 * champion's statistics from what it has kept. In a browser `npm run dev`
 * there is no shell: a stand-in answers with a made-up champion, so the page
 * can be built and looked at; a production build drops it.
 */
export function useHighElo() {
  const progress = useState<Progress>('highelo-progress', () => ({ ...IDLE }))
  const error = useState<string | null>('highelo-error', () => null)
  const standIn = import.meta.dev && !insideTauri()
  let timer: ReturnType<typeof setInterval> | null = null

  async function call<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
    if (standIn) return fake(command, args) as T
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<T>(command, args)
  }

  function fake(command: string, args: Record<string, unknown>): unknown {
    if (command === 'highelo_progress') return { ...IDLE, rowsStored: 1840, matchesStored: 184, phase: 'done' }
    if (command === 'highelo_stats') {
      const base: ChampionStats = {
        championId: Number(args.championId), patch: '16.21', patches: ['16.21', '16.20'], games: 142, wins: 77,
        positions: [{ id: 4, games: 130, wins: 71 }, { id: 3, games: 12, wins: 6 }],
        keystones: [{ id: 8008, games: 96, wins: 54 }, { id: 8005, games: 40, wins: 20 }, { id: 8021, games: 6, wins: 3 }],
        runes: [], shards: [{ id: 5008, games: 100, wins: 55 }, { id: 5005, games: 42, wins: 22 }, { id: 5011, games: 90, wins: 50 }, { id: 5001, games: 52, wins: 27 }],
        pages: [{ keystone: 8008, primary: 8000, secondary: 8300, runes: [8008, 9111, 9104, 8299, 8304, 8347], games: 60, wins: 36 }],
        items: [{ id: 3031, games: 120, wins: 68 }, { id: 3006, games: 118, wins: 64 }, { id: 3036, games: 80, wins: 45 }, { id: 3072, games: 60, wins: 31 }, { id: 6672, games: 55, wins: 30 }],
        spells: [{ spells: [4, 7], games: 130, wins: 71 }],
      }
      return base
    }
    return null
  }

  async function refresh() {
    progress.value = await call<Progress>('highelo_progress')
    if (!progress.value.running) stopPolling()
  }

  function startPolling() {
    if (timer) return
    timer = setInterval(() => void refresh().catch(() => stopPolling()), 1000)
  }

  function stopPolling() {
    if (timer) clearInterval(timer)
    timer = null
  }

  async function start(plan: Plan) {
    error.value = null
    try {
      await call('highelo_start', { plan })
      await refresh()
      startPolling()
    }
    catch (failure) {
      error.value = typeof failure === 'string' ? failure : String(failure)
    }
  }

  const stop = () => call('highelo_stop')

  async function clear() {
    error.value = null
    try {
      await call('highelo_clear')
      await refresh()
    }
    catch (failure) {
      error.value = typeof failure === 'string' ? failure : String(failure)
    }
  }

  const stats = (championId: number, patch: string | null, position: string | null) =>
    call<ChampionStats>('highelo_stats', { championId, patch, position })

  onMounted(() => {
    void refresh().then(() => {
      if (progress.value.running) startPolling()
    })
  })
  onBeforeUnmount(stopPolling)

  return { progress, error, standIn, start, stop, clear, stats, refresh }
}
