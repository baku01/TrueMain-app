import { tr } from '#common/utils/i18n'

/**
 * HTTP status carried by an ofetch failure, or `undefined` for a non-fetch
 * throw (network drop, abort, programmer error). ofetch raises a `FetchError`
 * that puts the response status on `statusCode`; the shape guard keeps a plain
 * `Error` from masquerading as an HTTP status.
 */
export function fetchErrorStatus(error: unknown): number | undefined {
  return error instanceof Error && 'statusCode' in error
    ? (error as { statusCode?: number }).statusCode
    : undefined
}

/**
 * Maps an HTTP status to the app's copy for it. Split out from
 * {@link describeFetchError} because `error.vue` receives a NuxtError that has
 * crossed the SSR payload — a *plain object*, not an `Error` instance — so the
 * shape guard below would read no status off it and every error page, 404
 * included, printed the connectivity line (#1661). A page holds the number
 * already; it has no fetch failure to inspect.
 */
export function describeHttpStatus(status: number | undefined): string {
  if (status === 429) {
    return tr('common.error.tooMany')
  }
  if (status !== undefined && status >= 500) {
    return tr('common.error.server')
  }
  // Before the generic 4xx line: a 404 is the one client error where "please
  // try again" is actively wrong, and it is what `error.vue` shows most often
  // (a typo'd champion slug, a dead shared link).
  if (status === 404) {
    return tr('common.error.notFound')
  }
  if (status !== undefined && status >= 400) {
    return tr('common.error.request')
  }
  // No status: the request never reached (or never heard back from) the server.
  return tr('common.error.network')
}

/**
 * Maps a fetch failure to a short, human-friendly message. Centralised so that
 * `FetchErrorAlert` and `error.vue` always read the same line — and so a raw
 * ofetch string like `[GET] "/api/champions/1": 500` never reaches the UI.
 */
export function describeFetchError(error: unknown): string {
  return describeHttpStatus(fetchErrorStatus(error))
}

/**
 * The action toast's line for a refetch that failed while the previous payload
 * stayed on screen (#1668): why it failed, and what the reader is looking at.
 */
export function describeStaleFetchError(error: unknown): string {
  return `${describeFetchError(error)} ${tr('common.error.stale')}`
}
