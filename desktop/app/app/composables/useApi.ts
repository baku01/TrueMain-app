/**
 * One way to ask TrueMain for something, whichever host the app runs in.
 *
 * Inside Tauri a read goes through Rust — `api.rs` says why: the webview would
 * meet CORS against an origin the site never expected, and the CSP would have
 * to open to a remote host. In `npm run dev` there is no Rust, and the dev
 * server proxies `/api` to the site's public entry point instead (nuxt.config).
 */
import { answerStaticEndpoint } from '~/utils/static-endpoints'
import { answerFromSource, answerPostFromSource } from '~/utils/sources'
import { readChampionBuild } from '~/utils/champion-build-read'
import { currentPatch } from '~/utils/sources/champions'

type QueryValue = string | number | boolean | null | undefined
/** A list repeats its key, one pair per entry (`?player=a&player=b`). */
type Query = Record<string, QueryValue | readonly QueryValue[]>

/**
 * TrueMain is never asked (`utils/data-source.ts`): a read no source has an
 * answer for fails here, before anything leaves the app, and the page shows
 * that part as unavailable.
 */
export class NotFromSourceError extends Error {
  constructor(path: string) {
    super(`${path} is TrueMain's alone: not read from the other sources`)
    this.name = 'NotFromSourceError'
  }
}

/** How a read is sent: a signal, and whether the window's loading bar ignores it. */
export interface ReadOptions {
  /** Reaches the request in `npm run dev` only: the shell's commands cannot be cancelled. */
  signal?: AbortSignal
  /**
   * A read no click asked for — the in-game next item, re-asked as the game
   * moves. Every other read runs the loading bar while it is out (#1788).
   */
  background?: boolean
}

/** A read counted by the loading bar, unless it runs in the background. */
function tracked<T>(work: Promise<T>, options: ReadOptions): Promise<T> {
  return options.background ? work : trackLoad(work)
}

/**
 * A read in TrueMain's API's shapes, answered by the sources
 * (`answerFromSource`); a path they have no counterpart for fails
 * (`NotFromSourceError`) — TrueMain itself is never asked, not even to stand in.
 */
export function apiGet<T>(path: string, query: Query = {}, options: ReadOptions = {}): Promise<T> {
  return tracked((async () => {
    const fromSources = answerFromSource(path, query)
    if (fromSources === undefined) throw new NotFromSourceError(path)
    return await fromSources as T
  })(), options)
}

/**
 * A POST read — the composition build and its games, which take the draft as
 * a body — answered by the sources (`answerPostFromSource`); TrueMain is
 * never asked.
 */
export function apiPost<T>(path: string, body: unknown, query: Query = {}, options: ReadOptions = {}): Promise<T> {
  return tracked((async () => {
    const fromSources = answerPostFromSource(path, body, query)
    if (fromSources === undefined) throw new NotFromSourceError(path)
    return await fromSources as T
  })(), options)
}

/**
 * Open a page of the site in the player's browser. The app shows what a
 * decision in the next thirty seconds needs; the site is where the rest lives.
 * Which site is the shell's to say (`site.rs`): a preprod build opens preprod.
 */
export async function openOnSite(path: string) {
  if (insideTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('open_on_site', { path })
    return
  }
  window.open(`${import.meta.env.TRUEMAIN_SITE_URL}${path}`, '_blank', 'noopener')
}

/** The options the shared pages pass to their fetcher — the site's `ApiFetchOptions`, as far as the app reads them. */
export interface ApiFetchOptions {
  query?: Query
  method?: 'GET' | 'POST'
  body?: unknown
  signal?: AbortSignal
  /** As on the site: an HTTP error status resolves `null` instead of throwing (a 404 read as "not found"). */
  ignoreResponseError?: boolean
}

/**
 * Whether a failed read got an answer from TrueMain — an HTTP error status —
 * rather than none at all. Only the first is what `ignoreResponseError` turns
 * into `null`: an offline app must say it cannot reach TrueMain, not that a
 * player does not exist. The shell reports a status as `TrueMain answered …`
 * (`api.rs`); in `npm run dev` the error is ofetch's, carrying the status.
 */
function isResponseError(error: unknown): boolean {
  if (typeof error === 'string') return error.startsWith('TrueMain answered')
  return typeof (error as { statusCode?: unknown } | null)?.statusCode === 'number'
}

/**
 * The app's answer to the site's `useApiFetch` (`web/app/composables/useApi.ts`),
 * which the shared pages of `web/layers/common` call: a path under `/api` to its
 * parsed body. TrueMain's own reads go through `apiGet` / `apiPost`; the site's
 * `/static/*` lookups are Nitro routes the app does not have, so they are
 * answered here from Data Dragon in the same shapes (`utils/static-endpoints.ts`).
 */
export function useApiFetch() {
  return async <T>(path: string, options: ApiFetchOptions = {}): Promise<T> => {
    const query = options.query ?? {}
    if (options.method !== 'POST') {
      const local = await answerStaticEndpoint(path, query)
      if (local !== undefined) return local as T
      // A champion's lane builds (the matchup tool's standard build): the shell
      // reads them through its own command, and another source answers them itself.
      const champion = /^\/champions\/(\d+)$/.exec(path)
      if (champion && typeof query.position === 'string') {
        const answer = await readChampionBuild(Number(champion[1]), query.position, { signal: options.signal })
        // The page loads its icons by the answer's patch: a source that names none, or names it
        // short (`16.21`), gets Data Dragon's full version.
        const patch = answer.patch && answer.patch.split('.').length >= 3 ? answer.patch : await currentPatch()
        return { ...answer, patch } as T
      }
    }
    try {
      return options.method === 'POST'
        ? await apiPost<T>(path, options.body, query, { signal: options.signal })
        : await apiGet<T>(path, query, { signal: options.signal })
    }
    catch (error) {
      if (options.ignoreResponseError && isResponseError(error)) return null as T
      throw error
    }
  }
}
