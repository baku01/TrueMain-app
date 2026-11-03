import type { ChampionDirectoryResponse } from '#shared/types/champion-directory'
import type { ChampionSummaryResponse } from '#shared/types/champions'
import type { ChampionBuildResponse } from '~/types/build'

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

const BUILDS_AT_ONCE = 6
const BUILDS_DEADLINE_MS = 2_500

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
