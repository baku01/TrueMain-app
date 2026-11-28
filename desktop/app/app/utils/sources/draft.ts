import type { ChampionTierListResponse } from '#shared/types/champions'
import type { DraftBanCandidate, DraftBans, DraftReason, DraftRecommendation, EnemyLane } from '~/types/draft'
import type { Provider } from '~/utils/sources'
import type { AllyTable } from '~/utils/draft-scoring'
import { laneOpponent, sharesOf, solveEnemyLanes } from '~/utils/draft-lanes'
import { byScore, scoreCandidate } from '~/utils/draft-scoring'
import { shrinkDelta } from '~/utils/draft-weights'
import { readAllySynergies } from '~/utils/sources/synergies'

/**
 * Champion select's picks and bans from the source Settings picked, in the
 * shapes TrueMain's draft endpoints answer, so the draft screen draws them
 * unchanged. TrueMain's model is never asked; the reading is the API's model
 * on what every source can give:
 *
 * - the enemies share the five lanes (one each): the lanes the player pinned,
 *   then the placements of the rest, each as likely as the product of the
 *   lane shares the source sees them at (`utils/draft-lanes`); the lane
 *   opponent is the enemy most likely on the player's lane, and that chance
 *   is how much its matchup counts;
 * - a pick is scored by its strength on the lane, its matchup against that
 *   opponent and its synergy with the allies on the board, each shrunk by its
 *   games (`utils/draft-scoring`);
 * - a ban is a champion the player's pick (or pool) loses to most, or, with
 *   nothing to protect, the lane's most banned.
 */

/** A source that counts no games (Tencent's tier list) is taken at a usable sample. */
const gamesOf = (games: number) => (games > 0 ? games : 1000)

const reason = (fields: Partial<DraftReason> & Pick<DraftReason, 'kind'>): DraftReason => ({
  championId: null, position: null, delta: null, games: 0, rate: null, probability: null, share: null, count: null, of: null, tentative: false, ...fields,
})

interface Entry { championId: number, position: string, games: number, winRate: number, pickRate: number, banRate: number | null }
const entriesOf = (list: ChampionTierListResponse): Entry[] => list.tiers.flatMap(group => group.entries)

/** Every enemy on its own lane, the most probable placement (`solveEnemyLanes`), each with the chance of its lane. */
export function enemyLanes(enemies: number[], pinned: Record<string, string>, rows: Entry[], previous: Record<string, string> = {}): EnemyLane[] {
  return solveEnemyLanes(enemies, pinned, sharesOf(rows), previous).lanes
}

/** The enemies on their lanes for a screen with no draft recommendation to read them from (the Jev matchup page). */
export async function enemyLanesFromSource(provider: Provider, enemies: number[]): Promise<EnemyLane[]> {
  if (!enemies.length) return []
  return enemyLanes(enemies, {}, entriesOf(await provider.tierList({})))
}

interface RecommendationRequest {
  position: string
  enemyChampions: number[]
  pinnedEnemyLanes?: Record<string, string>
  /** The lanes on screen, kept when a re-solve finds another placement just as likely. */
  previousEnemyLanes?: Record<string, string>
  allies?: Record<string, number>
  hoveredAllies?: Record<string, number>
  bans?: number[]
  candidates: number[]
  eloBracket?: string | null
}

/** Each ally on the board with its synergy table on our lane; an ally no source answered for is left out. */
async function allyTables(request: RecommendationRequest): Promise<AllyTable[]> {
  const board = [
    ...Object.entries(request.allies ?? {}).map(([lane, championId]) => ({ lane, championId, tentative: false })),
    ...Object.entries(request.hoveredAllies ?? {}).map(([lane, championId]) => ({ lane, championId, tentative: true })),
  ].filter(ally => ally.lane !== request.position)
  const tables = await Promise.all(board.map(async (ally) => {
    const rows = await readAllySynergies(ally.championId, ally.lane, request.position, request.eloBracket ?? null)
    return rows?.length ? { championId: ally.championId, tentative: ally.tentative, rows: new Map(rows.map(row => [row.allyChampionId, { delta: row.delta, games: row.games }])) } : null
  }))
  return tables.filter(table => table !== null)
}

export async function draftRecommendationFromSource(provider: Provider, request: RecommendationRequest): Promise<DraftRecommendation> {
  const elo = request.eloBracket ?? undefined
  const list = await provider.tierList({ eloBracket: elo })
  const rows = entriesOf(list)
  const lane = rows.filter(row => row.position === request.position)
  const average = lane.length ? lane.reduce((sum, row) => sum + row.winRate, 0) / lane.length : 0.5
  const share = sharesOf(rows)
  const previous = request.previousEnemyLanes ?? {}
  const solution = solveEnemyLanes(request.enemyChampions, request.pinnedEnemyLanes ?? {}, share, previous)
  const opponent = laneOpponent(solution, request.position, share, previous)

  // Nothing to rank is an empty answer, never a stand-in list: the panel then says why (no pool on the lane, #1783).
  const taken = new Set([...request.enemyChampions, ...(request.bans ?? []), ...Object.values(request.allies ?? {}), ...Object.values(request.hoveredAllies ?? {})])
  const pool = request.candidates.filter(id => !taken.has(id))
  const [versus, allies] = await Promise.all([
    pool.length && opponent ? provider.matchups(opponent.championId, { position: request.position, eloBracket: elo }).catch(() => null) : null,
    pool.length ? allyTables(request) : [] as AllyTable[],
  ])

  const patch = list.patchVersion || null
  const candidates = pool.map((championId) => {
    const own = lane.find(row => row.championId === championId)
    const row = versus?.matchups.find(entry => entry.opponentChampionId === championId)
    return scoreCandidate({
      championId,
      position: request.position,
      own: own ? { winRate: own.winRate, games: gamesOf(own.games) } : null,
      average,
      opponent,
      matchupsRead: versus !== null,
      versus: row ? { winRate: row.winRate, games: row.games } : null,
      allies,
      patch,
    })
  }).sort(byScore)

  return {
    position: request.position,
    patch,
    eloBracket: elo ?? 'ALL',
    enemyLanes: solution.lanes,
    laneOpponentChampionId: opponent?.championId ?? null,
    laneOpponentConfidence: opponent?.confidence ?? 0,
    candidates,
  }
}

interface BansRequest {
  position: string
  plannedPick: number | null
  pool: { championId: number, weight: number }[]
  allyChampions: number[]
  enemyChampions: number[]
  bans: number[]
  eloBracket?: string | null
}

/** How many ban suggestions the strip shows. */
const BANS = 5

export async function draftBansFromSource(provider: Provider, request: BansRequest): Promise<DraftBans> {
  const elo = request.eloBracket ?? undefined
  const target = request.plannedPick ?? request.pool[0]?.championId ?? null
  const taken = new Set([...request.allyChampions, ...request.enemyChampions, ...request.bans, ...(target ? [target] : [])])
  const list = await provider.tierList({ position: request.position, eloBracket: elo })
  const lane = entriesOf(list).filter(row => row.position === request.position)

  let candidates: DraftBanCandidate[] = []
  if (target) {
    const own = lane.find(row => row.championId === target)
    const versus = await provider.matchups(target, { position: request.position, eloBracket: elo }).catch(() => null)
    candidates = (versus?.matchups ?? [])
      .filter(row => !taken.has(row.opponentChampionId) && row.games > 0)
      .map((row) => {
        // How much worse the player's pick does into it than it does on the lane.
        const delta = row.winRate - (own?.winRate ?? 0.5)
        const share = lane.find(entry => entry.championId === row.opponentChampionId)?.pickRate ?? null
        return {
          championId: row.opponentChampionId,
          score: -shrinkDelta(delta, row.games),
          reasons: [reason({ kind: 'laneThreat', championId: target, position: request.position, delta, games: row.games, share })],
        }
      })
      .filter(candidate => candidate.score > 0)
  }
  if (!candidates.length) {
    candidates = lane
      .filter(row => !taken.has(row.championId) && row.banRate !== null)
      .map(row => ({ championId: row.championId, score: row.banRate!, reasons: [reason({ kind: 'banRate', position: request.position, rate: row.banRate, games: gamesOf(row.games) })] }))
  }
  return {
    position: request.position,
    patch: list.patchVersion || null,
    eloBracket: elo ?? 'ALL',
    target: target ? (request.plannedPick ? 'pick' : 'pool') : 'none',
    targetChampionIds: target ? [target] : [],
    candidates: candidates.sort((a, b) => b.score - a.score).slice(0, BANS),
  }
}
