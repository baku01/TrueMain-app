import type { PlayerGame } from '~/types/record'
import type { BlitzHistorySource, GameSource } from '~/utils/deep-history'
import type { RiotTimeline } from '~/utils/blitz/player'
import { HISTORY_DEEP_CEILING } from '~/composables/usePlayerRecord'
import { blitzGet } from '~/utils/blitz/client'
import { withMarks } from '~/utils/blitz/marks'
import { homeRegionOf, readMatch, readPlayerAccount, readPlayerMatchIds, regionOfPlatform, splitRiotId } from '~/utils/blitz/player'
import { gameOf } from '~/utils/blitz/profile'
import { idsToRead, mapLimit, mergeHistory, sourceCounts } from '~/utils/deep-history'
import { historyStore } from '~/utils/history-store'

/** Matches read from Blitz at once. */
const CONCURRENCY = 4

/** Match ids read per step: the page recomputes as each step lands. */
const STEP = 8

/** Games read from Blitz between two saves to this machine. */
const SAVE_EVERY = 24

const SUMMONERS_RIFT = 11

/**
 * The account's reading this session — how Blitz is read for it, its match
 * list, the ids that failed — kept across the page's visits like the games
 * themselves (`useState`), so coming back to the page goes on where it was.
 */
let session: { riotId: string, source: Promise<BlitzHistorySource | null> | null, ids: string[] | null, failed: Set<string>, sinceSave: number, puuid: string | null } | null = null

/**
 * The player's history as far back as it can be read, for a page that reads
 * the whole record (the nerd statistics). The client keeps only its latest
 * twenty games or so — past them its pages answer the same games again — so
 * once its pages end the reading goes on with the player's games on Blitz,
 * which lists about their hundred latest (no Riot key: `utils/blitz/player`),
 * each converted into the client's own shape, the timeline's marks included
 * (`gameOf`, `withMarks`). Everything read is saved on this machine per
 * account (`utils/history-store`), so the next session starts from it and the
 * history grows past both windows over time.
 *
 * One game is one game whichever read it (`mergeHistory`): the client's read
 * first, then Blitz's, then the saved one; newest first, at most
 * `HISTORY_DEEP_CEILING`. `sources` says how many each gave. The dashboard's
 * own match history reads the record as before (`usePlayerRecord`); only a
 * page calling this reads further.
 */
export function useDeepHistory() {
  const own = usePlayerRecord()
  const { state } = useLcuState()
  const owner = useState<string | null>('deep-history-owner', () => null)
  const saved = useState<PlayerGame[]>('deep-history-saved', () => [])
  const fetched = useState<PlayerGame[]>('deep-history-blitz', () => [])
  const phase = useState<'idle' | 'client' | 'blitz' | 'done'>('deep-history-phase', () => 'idle')
  /** Blitz could not be read this session (no region, no account, no answer): the history is the client's and the saved. */
  const blitzMissing = useState<boolean>('deep-history-blitz-missing', () => false)
  /** Match ids still to read from Blitz this session. */
  const queued = useState<number>('deep-history-queued', () => 0)
  const paused = useState<boolean>('deep-history-paused', () => false)

  const merged = computed(() => mergeHistory([['client', own.games.value], ['blitz', fetched.value], ['saved', saved.value]], HISTORY_DEEP_CEILING))
  const games = computed(() => merged.value.games)
  const sources = computed(() => sourceCounts(merged.value.sourceOf))
  const sourceOf = (gameId: number): GameSource | null => merged.value.sourceOf.get(gameId) ?? null
  const reading = computed(() => !paused.value && own.status.value === 'ready' && phase.value !== 'done')

  let running = false
  let disposed = false
  if (getCurrentScope()) onScopeDispose(() => (disposed = true))

  /** A new account (or the first): its saved games, a fresh read of Blitz. */
  async function adopt(riotId: string) {
    owner.value = riotId
    fetched.value = []
    saved.value = []
    phase.value = 'idle'
    blitzMissing.value = false
    queued.value = 0
    session = { riotId, source: null, ids: null, failed: new Set(), sinceSave: 0, puuid: null }
    const stored = await historyStore().load(riotId)
    let games = stored.games
    if (!games.length && !insideTauri() && import.meta.dev) games = await useDevScenarios().savedHistory()
    if (state.value.riotId !== riotId || session?.riotId !== riotId) return
    saved.value = games
    session.puuid = stored.puuid
  }

  /** How the player's games are read on Blitz: their region (the record's platform, else the one their games are on) and their puuid. */
  async function blitzSource(riotId: string): Promise<BlitzHistorySource | null> {
    if (!insideTauri()) return import.meta.dev ? useDevScenarios().blitzHistory() : null
    const parts = splitRiotId(riotId)
    if (!parts) return null
    const platform = own.record.value?.platformId
    const region = (platform ? regionOfPlatform(platform) : null) ?? await homeRegionOf(parts.gameName, parts.tagLine)
    if (!region) return null
    const puuid = session?.puuid ?? (await readPlayerAccount(region, parts.gameName, parts.tagLine))?.puuid
    if (!puuid) return null
    return {
      puuid,
      matchIds: () => readPlayerMatchIds(region, parts.gameName, parts.tagLine),
      match: readMatch,
      // Not `readTimeline`: its session cache would keep forty of these heavy answers for a page that reads each once.
      timeline: id => blitzGet<RiotTimeline>('lol', `lol/timeline/${id}`),
    }
  }

  /** One match as one of the player's games, with its marks on Summoner's Rift (the lane leads); null when it cannot be read. */
  async function readGame(source: BlitzHistorySource, id: string): Promise<PlayerGame | null> {
    try {
      const game = gameOf(await source.match(id), source.puuid)
      if (!game) return null
      if (game.mapId !== SUMMONERS_RIFT || game.remake) return game
      return withMarks(game, await source.timeline(id).catch(() => null))
    }
    catch {
      return null
    }
  }

  async function persist(riotId: string) {
    if (session?.riotId !== riotId) return
    session.sinceSave = 0
    await historyStore().save(riotId, games.value, session.puuid)
  }

  /** One step on Blitz: false when there is nothing left to read there. */
  async function blitzStep(riotId: string): Promise<boolean> {
    const current = session!
    current.source ??= blitzSource(riotId).catch(() => null)
    const source = await current.source
    if (source) current.puuid = source.puuid
    if (source && !current.ids) current.ids = await source.matchIds().catch(() => null)
    if (!source || !current.ids) {
      blitzMissing.value = true
      return false
    }
    const todo = idsToRead(current.ids, games.value, HISTORY_DEEP_CEILING, current.failed)
    queued.value = todo.length
    if (!todo.length) return false
    phase.value = 'blitz'
    const step = todo.slice(0, STEP)
    const read = await mapLimit(step, CONCURRENCY, id => readGame(source, id))
    if (session?.riotId !== riotId || state.value.riotId !== riotId) return false
    step.forEach((id, index) => {
      if (!read[index]) current.failed.add(id)
    })
    const landed = read.filter((game): game is PlayerGame => game !== null)
    fetched.value = [...fetched.value, ...landed]
    queued.value = Math.max(0, todo.length - step.length)
    current.sinceSave += landed.length
    if (current.sinceSave >= SAVE_EVERY) void persist(riotId)
    return true
  }

  /** Read on — the client's pages, then Blitz — until the history ends, the page pauses or leaves, or the account changes. */
  async function run() {
    if (running) return
    running = true
    try {
      while (!paused.value && !disposed) {
        const riotId = state.value.riotId
        if (!riotId || !state.value.connected || own.status.value !== 'ready' || own.loadingOlder.value) return
        if (owner.value !== riotId || session?.riotId !== riotId) await adopt(riotId)
        if (state.value.riotId !== riotId || phase.value === 'done') return
        if (own.canReadOlder(HISTORY_DEEP_CEILING)) {
          phase.value = 'client'
          await own.loadOlder(HISTORY_DEEP_CEILING)
          continue
        }
        if (!(await blitzStep(riotId))) {
          if (session?.riotId === riotId && state.value.riotId === riotId) {
            phase.value = 'done'
            await persist(riotId)
          }
          return
        }
      }
    }
    finally {
      running = false
    }
  }

  function toggle() {
    paused.value = !paused.value
    const riotId = state.value.riotId
    if (paused.value && riotId && session?.riotId === riotId) void persist(riotId)
  }

  watch([() => state.value.riotId, () => own.status.value, () => own.loadingOlder.value, paused], () => void run(), { immediate: true })

  return { games, sources, sourceOf, reading, paused, phase, queued, blitzMissing, toggle }
}
