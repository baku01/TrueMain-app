import type { ChampionDirectoryResponse } from '#shared/types/champion-directory'
import type { ChampionSummaryResponse } from '#shared/types/champions'
import type { ChampionBuildResponse } from '~/types/build'
import { keepBounded } from '~/utils/bounded'
import { SOURCE_ELO_BRACKET } from '~/utils/data-source'
import { combineRows } from '~/utils/sources/combined'

/**
 * The champions list (`GET /champions/directory`) from a source's rows: one
 * per champion and lane, filtered, sorted and paged here the way TrueMain's
 * API does it. Each row on the page carries its lane's most played build
 * (`topBuild`), read for that page only, a few at a time. The page never
 * waits on them past `BUILDS_DEADLINE_MS`: a source that answers a build in
 * seconds (op.gg) would otherwise hold the whole list behind fifty reads. The
 * builds still out keep going and are kept, so the next visit has them.
 */
type SortKey = 'pickRate' | 'winRate' | 'banRate' | 'games' | 'tier'

const SORTS: Record<SortKey, (row: ChampionSummaryResponse) => number> = {
  pickRate: row => row.pickRate,
  winRate: row => row.winRate,
  banRate: row => row.banRate ?? 0,
  games: row => row.games,
  tier: row => row.tierScore,
}

const BUILDS_AT_ONCE = 10
const BUILDS_DEADLINE_MS = 2_500

/** Minimum share of a champion's games to appear in the all-lanes view vs a single-lane view. */
export const MIN_ALL_LANE_SHARE = 0.08
export const MIN_SINGLE_LANE_SHARE = 0.02

/** Major.minor patch segment (`16.23.1` -> `16.23`), or null when absent/invalid. */
export function normalizePatch(value: unknown): string | null {
  return typeof value === 'string' && /^\d+\.\d+/.test(value) ? value.split('.').slice(0, 2).join('.') : null
}

/**
 * Keep only sources whose rows match the requested patch when one was explicitly
 * picked — sources that ignore `patch` (Blitz, op.gg) must not blend live-patch
 * numbers into an older patch.
 */
export function filterAnswersByPatch(answers: ChampionSummaryResponse[][], requestedPatch: string | null): ChampionSummaryResponse[][] {
  if (!requestedPatch) return answers
  const matching = answers.filter(rows => rows.length > 0 && normalizePatch(rows[0]?.patchVersion) === requestedPatch)
  return matching.length ? matching : answers
}

/**
 * The shared row visibility filter for BOTH `/champions/tierlist` and
 * `/champions/directory`, so the two pages never diverge on which champion/lane
 * rows appear or on their figures.
 */
export function visibleDirectoryRows(rows: ChampionSummaryResponse[], position: string | null): ChampionSummaryResponse[] {
  return rows.filter(row => (position === null
    ? row.lanePlayRate >= MIN_ALL_LANE_SHARE
    : row.position === position && row.lanePlayRate >= MIN_SINGLE_LANE_SHARE))
}

const pooledRowsCache = new Map<string, Promise<ChampionSummaryResponse[]>>()

/**
 * Pool and cache directory/tier-list rows once per `(patch, eloBracket)` across
 * the whole roster (never pre-filtered by lane or championId) so `/tierlist`,
 * `/champions`, and `/champions/:id` always read identical figures.
 */
export function readPooledDirectoryRows(
  query: Record<string, unknown>,
  load: (baseQuery: Record<string, unknown>) => Promise<ChampionSummaryResponse[][]>,
): Promise<ChampionSummaryResponse[]> {
  const patch = normalizePatch(query.patch)
  const eloBracket = typeof query.eloBracket === 'string' && query.eloBracket ? query.eloBracket.toUpperCase() : SOURCE_ELO_BRACKET
  const key = `${patch ?? 'live'}:${eloBracket}`
  let cached = pooledRowsCache.get(key)
  if (!cached) {
    const baseQuery: Record<string, unknown> = { eloBracket, ...(patch ? { patch } : {}) }
    cached = load(baseQuery).then((answered) => {
      const targetPatch = patch ?? normalizePatch(answered[0]?.[0]?.patchVersion)
      const rows = combineRows(filterAnswersByPatch(answered, targetPatch))
      if (!rows.length) pooledRowsCache.delete(key)
      return rows
    })
    cached.catch(() => pooledRowsCache.delete(key))
    keepBounded(pooledRowsCache, key, cached)
  }
  return cached
}

export async function pageDirectory(
  rows: ChampionSummaryResponse[],
  query: Record<string, unknown>,
  readBuild: (championId: number, position: string) => Promise<ChampionBuildResponse>,
): Promise<ChampionDirectoryResponse> {
  const position = typeof query.position === 'string' && query.position ? query.position : null
  const championId = Number(query.championId) || null
  const all = rows.filter(row => (position === null || row.position === position) && (championId === null || row.championId === championId))
  const sort: SortKey = typeof query.sort === 'string' && query.sort in SORTS ? query.sort as SortKey : 'pickRate'
  const direction = query.order === 'asc' ? 1 : -1
  all.sort((a, b) => direction * (SORTS[sort](a) - SORTS[sort](b)) || b.games - a.games)

  const pageSize = Math.max(1, Number(query.pageSize) || 50)
  const page = Math.max(1, Math.floor(Number(query.page) || 1))
  const shown = all.slice((page - 1) * pageSize, page * pageSize).map(row => ({ ...row }))

  const fill = async () => {
    for (let start = 0; start < shown.length; start += BUILDS_AT_ONCE) {
      await Promise.all(shown.slice(start, start + BUILDS_AT_ONCE).map(async (row) => {
        try {
          const build = (await readBuild(row.championId, row.position)).builds[0]
          if (!build) return
          row.topBuild = {
            firstItemId: build.firstItemId,
            primaryKeystoneId: build.primaryKeystoneId,
            secondaryStyleId: build.core.runePage?.secondaryStyleId ?? 0,
            itemPath: build.core.itemPath?.itemIds ?? [],
          }
        }
        catch {
          // A row whose build did not come keeps its numbers; the build cells stay empty.
        }
      }))
    }
  }
  await Promise.race([fill(), new Promise(resolve => setTimeout(resolve, BUILDS_DEADLINE_MS))])

  return { rows: shown, page, pageSize, total: all.length, patchVersion: shown[0]?.patchVersion ?? '' }
}
