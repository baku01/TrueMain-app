import type { BuildOption } from '~/types/build'

/**
 * The player's previous build on each champion and lane (Blitz's "Previous
 * Build"): the last one they picked by hand in a build list or imported into
 * the client, kept on this machine. A build list then offers it first, so the
 * build the player settled on last time is one click away — never selected on
 * its own, the draft's or the lane's build stays the default.
 */
export const PREVIOUS_BUILDS_KEY = 'truemain-previous-builds'

/** Champions and lanes kept: past this many, the oldest goes. */
export const MAX_PREVIOUS_BUILDS = 60

export interface PreviousBuild {
  option: BuildOption
  /** Epoch ms: the oldest is the one dropped past the cap. */
  savedAt: number
}

export type PreviousBuilds = Record<string, PreviousBuild>

export const previousKey = (championId: number, position: string) => `${championId}:${position.toUpperCase()}`

/** A stored entry that is still a build: an older or hand-edited value is skipped, never drawn. */
function isEntry(value: unknown): value is PreviousBuild {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<PreviousBuild>
  return typeof entry.savedAt === 'number'
    && !!entry.option && typeof entry.option === 'object'
    && typeof entry.option.firstItemId === 'number'
    && !!entry.option.core && typeof entry.option.core === 'object'
    && Array.isArray(entry.option.buildTree)
}

/** The stored builds; anything unreadable is none. */
export function parsePreviousBuilds(raw: string | null | undefined): PreviousBuilds {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, value]) => isEntry(value))) as PreviousBuilds
  }
  catch {
    return {}
  }
}

/** `builds` with `option` kept as the previous build under `key`, the oldest dropped past the cap. */
export function rememberBuild(builds: PreviousBuilds, key: string, option: BuildOption, now: number): PreviousBuilds {
  const next: PreviousBuilds = { ...builds, [key]: { option: { ...option, key: 'previous' }, savedAt: now } }
  const keys = Object.keys(next)
  if (keys.length <= MAX_PREVIOUS_BUILDS) return next
  const kept = keys.sort((a, b) => next[b]!.savedAt - next[a]!.savedAt).slice(0, MAX_PREVIOUS_BUILDS)
  return Object.fromEntries(kept.map(entry => [entry, next[entry]!]))
}

type Store = Pick<Storage, 'getItem' | 'setItem'> | undefined

/** The previous build on the champion and lane, as a list row (`key: previous`); null when there is none. */
export function readPreviousBuild(storage: Store, championId: number, position: string): BuildOption | null {
  try {
    return parsePreviousBuilds(storage?.getItem(PREVIOUS_BUILDS_KEY))[previousKey(championId, position)]?.option ?? null
  }
  catch {
    return null
  }
}

/** Keep `option` as the previous build on the champion and lane. Storage unavailable: nothing is kept. */
export function storePreviousBuild(storage: Store, championId: number, position: string, option: BuildOption, now = Date.now()) {
  try {
    const builds = parsePreviousBuilds(storage?.getItem(PREVIOUS_BUILDS_KEY))
    storage?.setItem(PREVIOUS_BUILDS_KEY, JSON.stringify(rememberBuild(builds, previousKey(championId, position), option, now)))
  }
  catch {
    // Full or blocked storage: the build is simply not offered next time.
  }
}
