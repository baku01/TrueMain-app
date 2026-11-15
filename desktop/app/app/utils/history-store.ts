import type { PlayerGame } from '~/types/record'
import { mergeHistory } from '~/utils/deep-history'

/**
 * The games of each account this machine has read, kept between sessions, so
 * the nerd statistics start from everything seen before and the history grows
 * past what the client (about twenty games) and Blitz (about a hundred) hold
 * at any one time. One entry per account (its Riot ID), the newest
 * `SAVED_GAMES_LIMIT` games, kept in the webview's IndexedDB — a few hundred
 * games with their ten players' lines and timeline marks are a megabyte or
 * two, past what `localStorage` should carry.
 *
 * Like the LP history (`lp-history`), it only ever holds what this machine
 * read: nothing is estimated, and a full or private store simply keeps
 * nothing.
 */

/** The most games kept per account. */
export const SAVED_GAMES_LIMIT = 300

export interface SavedHistory {
  /** The account, as `accountKey` writes it. */
  account: string
  puuid: string | null
  savedAt: number
  /** Newest first. */
  games: PlayerGame[]
}

/** Where the entries are kept: IndexedDB in the app, a map in a test. */
export interface HistoryBackend {
  get: (account: string) => Promise<SavedHistory | null>
  put: (entry: SavedHistory) => Promise<void>
}

/** A Riot ID is one account whatever its case. */
export const accountKey = (riotId: string) => riotId.trim().toLowerCase()

/** What a stored game must at least carry to be read back; anything else (an older shape, a corrupted entry) is dropped. */
function isGame(value: unknown): value is PlayerGame {
  const game = value as PlayerGame | null
  return Boolean(game) && typeof game!.gameId === 'number' && typeof game!.playedAt === 'number'
    && typeof game!.championId === 'number' && typeof game!.win === 'boolean' && Array.isArray(game!.participants) && Array.isArray(game!.items)
}

export function createHistoryStore(backend: HistoryBackend, limit = SAVED_GAMES_LIMIT) {
  /** The account's saved games, newest first; none when nothing was saved or the store cannot be read. */
  async function load(riotId: string): Promise<{ games: PlayerGame[], puuid: string | null }> {
    try {
      const entry = await backend.get(accountKey(riotId))
      const games = Array.isArray(entry?.games) ? entry.games.filter(isGame) : []
      return { games: mergeHistory([['saved', games]], limit).games, puuid: typeof entry?.puuid === 'string' ? entry.puuid : null }
    }
    catch {
      return { games: [], puuid: null }
    }
  }

  /**
   * Keep `games` for the account, merged with what is already kept — a game
   * read in an earlier session and not among these stays — newest first, one
   * per `gameId`, the newest `limit`. The fresh read of a game replaces the
   * saved one. Never throws: a store that cannot be written keeps nothing.
   */
  async function save(riotId: string, games: readonly PlayerGame[], puuid: string | null = null): Promise<number> {
    try {
      const stored = await load(riotId)
      const merged = mergeHistory([['client', games], ['saved', stored.games]], limit).games
      // A plain copy: the games come out of reactive state, as proxies a structured clone refuses.
      const plain = JSON.parse(JSON.stringify(merged)) as PlayerGame[]
      await backend.put({ account: accountKey(riotId), puuid: puuid ?? stored.puuid, savedAt: Date.now(), games: plain })
      return plain.length
    }
    catch {
      return 0
    }
  }

  return { load, save }
}

/** A backend in memory: the tests', and the app's when the webview has no IndexedDB. */
export function memoryBackend(): HistoryBackend {
  const entries = new Map<string, string>()
  return {
    get: async account => (entries.has(account) ? JSON.parse(entries.get(account)!) as SavedHistory : null),
    put: async (entry) => {
      entries.set(entry.account, JSON.stringify(entry))
    },
  }
}

const DATABASE = 'truemain-history'
const STORE = 'accounts'

let opening: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'account' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      opening = null
      reject(request.error)
    }
  })
  return opening
}

const done = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

/** The webview's IndexedDB, one database for every account. */
export function indexedDbBackend(): HistoryBackend {
  return {
    get: async (account) => {
      const db = await open()
      return (await done(db.transaction(STORE).objectStore(STORE).get(account) as IDBRequest<SavedHistory | undefined>)) ?? null
    },
    put: async (entry) => {
      const db = await open()
      await done(db.transaction(STORE, 'readwrite').objectStore(STORE).put(entry))
    },
  }
}

let shared: ReturnType<typeof createHistoryStore> | null = null

/** The app's store: IndexedDB where the webview has it, memory where it does not. */
export function historyStore() {
  shared ??= createHistoryStore(typeof indexedDB === 'undefined' ? memoryBackend() : indexedDbBackend())
  return shared
}
