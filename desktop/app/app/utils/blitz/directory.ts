import type { ChampionDirectoryResponse } from '#shared/types/champion-directory'
import type { ChampionSummaryResponse } from '#shared/types/champions'
import { SOLO_QUEUE, blitzRows, blitzTier, truemainPosition } from '~/utils/blitz/client'
import { readBlitzBuild } from '~/utils/blitz/playstyles'

/**
 * The champions list (`GET /champions/directory`) from Blitz: one row per
 * champion and lane, with Blitz's lane grade as the tier, filtered, sorted and
 * paged here the way TrueMain's API does it. Each row on the page carries its
 * lane's most played build (`topBuild`), read for that page only — a few at a
 * time, and kept by the shell's cache, so paging back asks Blitz nothing.
 */

const TIER_BY_GRADE: Record<number, string> = { 1: 'S', 2: 'A', 3: 'B', 4: 'C', 5: 'D' }
const BUILDS_AT_ONCE = 6

interface BlitzDirectoryRow {
  champion_id: number
  individual_position: string
  patch: string
  games: number
  win_rate: number
  pick_rate: number
  champion_ban_rate: number | null
  champion_role_tier: number | null
  role_pct_games: number | null
}

type SortKey = 'pickRate' | 'winRate' | 'banRate' | 'games' | 'tier'

const SORTS: Record<SortKey, (row: ChampionSummaryResponse) => number> = {
  pickRate: row => row.pickRate,
  winRate: row => row.winRate,
  banRate: row => row.banRate ?? 0,
  games: row => row.games,
  tier: row => row.tierScore,
}

/** `work` over `list`, `limit` at a time. */
async function inBatches<T>(list: T[], limit: number, work: (entry: T) => Promise<void>) {
  for (let start = 0; start < list.length; start += limit) {
    await Promise.all(list.slice(start, start + limit).map(work))
  }
}

export async function directoryFromBlitz(query: Record<string, unknown>): Promise<ChampionDirectoryResponse> {
  const rows = await blitzRows<BlitzDirectoryRow>('champion_postmatch_stats', {
    queue_id: SOLO_QUEUE,
    region: 'WORLD',
    tier: blitzTier(query.eloBracket),
    columns: 'champion_id,individual_position,patch,games,win_rate,pick_rate,champion_ban_rate,champion_role_tier,role_pct_games',
  })
  const now = new Date().toISOString()
  const position = typeof query.position === 'string' && query.position ? query.position : null
  const championId = Number(query.championId) || null
  const all: ChampionSummaryResponse[] = rows
    .filter(row => row.individual_position !== 'ALL')
    .map((row) => {
      const grade = row.champion_role_tier ?? 5
      return {
        championId: row.champion_id,
        games: row.games,
        wins: Math.round(row.games * row.win_rate),
        winRate: row.win_rate,
        pickRate: row.pick_rate,
        lanePlayRate: row.role_pct_games ?? 0,
        trueMainCount: 0,
        banRate: row.champion_ban_rate ?? null,
        tier: TIER_BY_GRADE[grade] ?? 'D',
        // Higher is better, as TrueMain's score: grade 1 (S) scores 5.
        tierScore: 6 - grade,
        position: truemainPosition(row.individual_position),
        patchVersion: row.patch,
        lastUpdatedAtUtc: now,
        topBuild: null,
      }
    })
    .filter(row => (position === null || row.position === position) && (championId === null || row.championId === championId))

  const sort: SortKey = typeof query.sort === 'string' && query.sort in SORTS ? query.sort as SortKey : 'pickRate'
  const direction = query.order === 'asc' ? 1 : -1
  all.sort((a, b) => direction * (SORTS[sort](a) - SORTS[sort](b)) || b.games - a.games)

  const pageSize = Math.max(1, Number(query.pageSize) || 50)
  const page = Math.max(1, Math.floor(Number(query.page) || 1))
  const shown = all.slice((page - 1) * pageSize, page * pageSize)

  await inBatches(shown, BUILDS_AT_ONCE, async (row) => {
    try {
      const build = (await readBlitzBuild(row.championId, row.position)).builds[0]
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
  })

  return { rows: shown, page, pageSize, total: all.length, patchVersion: rows[0]?.patch ?? '' }
}
