import type { ClockSync } from '~/composables/useGameClock'
import type { DraftRecommendation } from '~/types/draft'
import type { GameState } from '~/types/game'
import type { AppState } from '~/types/lcu'
import type { PlayerGame, PlayerRecord } from '~/types/record'
import type { RankHistoryEntry } from '#shared/types/rank-history'
import type { NextItemResponse } from '~/utils/next-item'
import type { BlitzHistorySource } from '~/utils/deep-history'
import { gameIdOfMatch } from '~/utils/deep-history'
import { EMPTY_STATE } from '~/types/lcu'

export interface Scenario {
  id: string
  label: string
  state: AppState
  /** What the API would have answered for this draft, when the scenario shows the lane panel. */
  recommendation?: DraftRecommendation
  /** What the client's history would have answered, when the scenario shows the dashboard. */
  record?: PlayerRecord
  /** The Solo/Duo snapshots the app would have noted on this machine. */
  rankHistory?: RankHistoryEntry[]
  /**
   * The game Rust would have derived, when the scenario is in one. Checked
   * against the committed game tape by a test in `crates/live-client`, so it
   * cannot drift from what the feed actually sends.
   */
  game?: GameState
  /**
   * A made-up next-item answer for that game, build paths included (#2183),
   * so the panel renders without a backend that serves them. Dev-only like
   * the rest: its figures are not measurements.
   */
  nextItem?: NextItemResponse
  /**
   * How many games older than the record's the client's history would page
   * back through. Made up from the record's own games, seeded by the
   * scenario's id (`fixtures/synthetic-history`), so the history can be
   * paged and the nerd statistics have a sample to read: their figures are
   * not measurements.
   */
  olderGames?: number
  /**
   * How many of the player's newest games Blitz's match list would hold —
   * the record's and older ones, as a busy account's hundred do — read
   * through the same converter as Blitz's answers (`fixtures/synthetic-blitz`)
   * once the client's pages end.
   */
  blitzGames?: number
  /**
   * How many games older still this machine would have saved from earlier
   * sessions (`utils/history-store`), the store's first contents when it
   * holds none for the account.
   */
  savedGames?: number
}

/** Each scenario's made-up older history, built the first time it is paged into. */
const synthetic = new Map<string, PlayerGame[]>()

/**
 * Stand-ins for states the client would push, for `npm run dev` in a browser.
 *
 * Outside Tauri there is no client and no Rust, so every screen but "no client"
 * would be unreachable and the draft could only be looked at during a real
 * game. These make the UI reachable in a second, with hot reload.
 *
 * They prove nothing below the frontend: the parsing, the state derivation and
 * the navigation rule live in Rust and are exercised by a tape instead
 * (`lcu::tape`, and `TRUEMAIN_LCU_REPLAY` in the README). A scenario that
 * disagrees with what Rust would derive is a scenario that lies, so they are
 * written from `DraftState`, not invented.
 *
 * Dev-only by construction: every caller is behind `import.meta.dev`, which
 * lets the bundler drop the fixtures from a production build.
 */
export function useDevScenarios() {
  const scenarios = useState<Scenario[]>('dev-scenarios', () => [])
  const current = useState<string>('dev-scenario', () => '')
  const state = useState<AppState>('lcu-state', () => ({ ...EMPTY_STATE }))
  const recommendation = useState<DraftRecommendation | null>('dev-recommendation', () => null)
  const record = useState<PlayerRecord | null>('dev-record', () => null)
  const rankHistory = useState<RankHistoryEntry[]>('dev-rank-history', () => [])
  const nextItem = useState<NextItemResponse | null>('dev-next-item', () => null)
  // `useLiveGame`'s own state, set directly as `lcu-state` is above.
  const game = useState<GameState | null>('live-game', () => null)
  const gameClock = useState<ClockSync>('live-game-clock', () => ({ gameTime: 0, at: Date.now() }))

  async function load() {
    if (scenarios.value.length > 0) return
    const loaded = await import('~/fixtures/scenarios.json')
    scenarios.value = (loaded.default ?? loaded) as unknown as Scenario[]
  }

  /** Switch to a scenario. An unknown id falls back to the no-client state. */
  function select(id: string) {
    const found = scenarios.value.find(scenario => scenario.id === id)
    // A JSON round-trip rather than `structuredClone`: the scenarios come back
    // out of a reactive store as proxies, which `structuredClone` refuses. The
    // fixtures are plain JSON by construction, so this copy is faithful, and a
    // copy is needed at all so editing the state in place cannot corrupt the
    // scenario that is meant to be returned to.
    state.value = found ? JSON.parse(JSON.stringify(found.state)) : { ...EMPTY_STATE }
    recommendation.value = found?.recommendation ? JSON.parse(JSON.stringify(found.recommendation)) : null
    record.value = found?.record ? JSON.parse(JSON.stringify(found.record)) : null
    rankHistory.value = found?.rankHistory ? JSON.parse(JSON.stringify(found.rankHistory)) : []
    nextItem.value = found?.nextItem ? JSON.parse(JSON.stringify(found.nextItem)) : null
    game.value = found?.game ? JSON.parse(JSON.stringify(found.game)) : null
    gameClock.value = { gameTime: game.value?.gameTime ?? 0, at: Date.now() }
    current.value = found?.id ?? ''

    // Kept in the URL so a scenario can be linked to, and so a reload after an
    // edit comes back to the screen being worked on rather than to the start.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (found) url.searchParams.set('scenario', found.id)
      else url.searchParams.delete('scenario')
      window.history.replaceState({}, '', url)
    }
  }

  /**
   * The page of older games the client would answer `player_history` with at
   * `begin` (the record is the first page), after a moment's wait as a real
   * read takes; none when the scenario has no older history.
   */
  async function olderPage(begin: number, size: number): Promise<PlayerGame[]> {
    const found = scenarios.value.find(scenario => scenario.id === current.value)
    if (!found?.olderGames || !found.record) return []
    const games = await olderGames(found)
    await new Promise(resolve => setTimeout(resolve, 350))
    const offset = begin - found.record.games.length
    return offset < 0 ? [] : JSON.parse(JSON.stringify(games.slice(offset, Math.min(offset + size, found.olderGames))))
  }

  /** The scenario's made-up older games: enough for its client's pages, Blitz's list and the saved ones. */
  async function olderGames(found: Scenario): Promise<PlayerGame[]> {
    let games = synthetic.get(found.id)
    if (!games) {
      const { syntheticHistory } = await import('~/fixtures/synthetic-history')
      const record = found.record?.games ?? []
      const count = Math.max(found.olderGames ?? 0, Math.max(0, (found.blitzGames ?? 0) - record.length) + (found.savedGames ?? 0))
      games = syntheticHistory(record, count, found.id)
      synthetic.set(found.id, games)
    }
    return games
  }

  /**
   * The player's games as Blitz would answer them, when the scenario names a
   * Blitz list (`blitzGames`): its newest games' ids, and each match and
   * timeline in Riot's shape after a moment's wait. Null otherwise.
   */
  function blitzHistory(): BlitzHistorySource | null {
    const found = scenarios.value.find(scenario => scenario.id === current.value)
    if (!found?.blitzGames || !found.record) return null
    const platform = found.record.platformId ?? 'EUW1'
    const puuid = `synthetic-${found.id}`
    const listed = async () => [...found.record!.games, ...await olderGames(found)].slice(0, found.blitzGames)
    const game = async (id: string) => {
      const gameId = gameIdOfMatch(id)
      const hit = (await listed()).find(entry => entry.gameId === gameId)
      if (!hit) throw new Error(`no synthetic game ${id}`)
      await new Promise(resolve => setTimeout(resolve, 120 + Math.random() * 160))
      return hit
    }
    return {
      puuid,
      matchIds: async () => (await listed()).map(entry => `${platform}_${entry.gameId}`),
      match: async (id) => {
        const { matchAnswerOf } = await import('~/fixtures/synthetic-blitz')
        return matchAnswerOf(await game(id), platform, puuid)
      },
      timeline: async (id) => {
        const { timelineOf } = await import('~/fixtures/synthetic-blitz')
        return timelineOf(await game(id))
      },
    }
  }

  /** The games the scenario's machine saved in earlier sessions (`savedGames`), older than Blitz's list. */
  async function savedHistory(): Promise<PlayerGame[]> {
    const found = scenarios.value.find(scenario => scenario.id === current.value)
    if (!found?.savedGames || !found.record) return []
    const skip = Math.max(0, (found.blitzGames ?? found.record.games.length) - found.record.games.length)
    return JSON.parse(JSON.stringify((await olderGames(found)).slice(skip, skip + found.savedGames)))
  }

  return { scenarios, current, recommendation, record, rankHistory, nextItem, load, select, olderPage, blitzHistory, savedHistory }
}
