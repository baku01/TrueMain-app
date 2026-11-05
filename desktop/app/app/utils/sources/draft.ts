import type { ChampionTierListResponse } from '#shared/types/champions'
import type { DraftBanCandidate, DraftBans, DraftCandidate, DraftReason, DraftRecommendation, EnemyLane } from '~/types/draft'
import type { Provider } from '~/utils/sources'
import { POSITIONS } from '#common/utils/positions'

/**
 * Champion select's picks and bans from the source Settings picked, in the
 * shapes TrueMain's draft endpoints answer, so the draft screen draws them
 * unchanged. No source scores a whole draft the way TrueMain's model does, so
 * the reading is the one every source can give:
 *
 * - the enemies share the five lanes (one each): the lanes the player pinned,
 *   then, among the rest, the split that keeps each enemy closest to where the
 *   source sees it played; the lane opponent is the enemy on the player's lane;
 * - a pick is scored by its strength on the lane (its win rate against the
 *   lane's average) and by its matchup against that opponent, each shrunk by
 *   its games so a thin sample does not outrank a measured one;
 * - a ban is a champion the player's pick (or pool) loses to most, or, with
 *   nothing to protect, the lane's most banned.
 */

/** A fact's weight by its games: a hundred games count a quarter, a thousand three quarters. */
const SHRINK = 300
const shrink = (delta: number, games: number) => delta * (games / (games + SHRINK))
/** A source that counts no games (Tencent's tier list) is taken at a usable sample. */
const gamesOf = (games: number) => (games > 0 ? games : 1000)

const reason = (fields: Partial<DraftReason> & Pick<DraftReason, 'kind'>): DraftReason => ({
  championId: null, position: null, delta: null, games: 0, rate: null, probability: null, share: null, count: null, of: null, tentative: false, ...fields,
})

interface Entry { championId: number, position: string, games: number, winRate: number, pickRate: number, banRate: number | null }
const entriesOf = (list: ChampionTierListResponse): Entry[] => list.tiers.flatMap(group => group.entries)

/**
 * Every enemy on its own lane: pinned by the player, else the split of the
 * lanes left that keeps the most of each enemy's play share there. One lane
 * each, as in the game — two enemies the source both sees mid cannot share
 * it, or the board, which draws one enemy per lane, would lose one of them.
 */
export function enemyLanes(enemies: number[], pinned: Record<string, string>, rows: Entry[]): EnemyLane[] {
  const share = (championId: number, position: string) => {
    const lanes = rows.filter(row => row.championId === championId)
    const total = lanes.reduce((sum, row) => sum + row.pickRate, 0)
    return total > 0 ? (lanes.find(row => row.position === position)?.pickRate ?? 0) / total : 0
  }
  const placed = new Map<number, EnemyLane>()
  for (const championId of enemies) {
    const position = pinned[championId]
    if (position && ![...placed.values()].some(lane => lane.position === position)) {
      placed.set(championId, { championId, position, confidence: 1, pinned: true })
    }
  }
  const free = enemies.filter(championId => !placed.has(championId))
  const open = POSITIONS.filter(position => ![...placed.values()].some(lane => lane.position === position))

  // At most five enemies on five lanes: every split is tried (120 at most), the
  // first best kept, so the same draft always reads the same way.
  let best: string[] = []
  let bestScore = -1
  const split = (index: number, taken: string[], score: number) => {
    if (index === free.length || taken.length === open.length) {
      if (score > bestScore) [best, bestScore] = [taken, score]
      return
    }
    for (const position of open) {
      if (!taken.includes(position)) split(index + 1, [...taken, position], score + share(free[index]!, position))
    }
  }
  split(0, [], 0)
  free.forEach((championId, index) => {
    const position = best[index] ?? 'MIDDLE'
    placed.set(championId, { championId, position, confidence: share(championId, position), pinned: false })
  })
  return enemies.map(championId => placed.get(championId)!)
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
  allies?: Record<string, number>
  hoveredAllies?: Record<string, number>
  bans?: number[]
  candidates: number[]
  eloBracket?: string | null
}

export async function draftRecommendationFromSource(provider: Provider, request: RecommendationRequest): Promise<DraftRecommendation> {
  const elo = request.eloBracket ?? undefined
  const list = await provider.tierList({ eloBracket: elo })
  const rows = entriesOf(list)
  const lane = rows.filter(row => row.position === request.position)
  const average = lane.length ? lane.reduce((sum, row) => sum + row.winRate, 0) / lane.length : 0.5
  const lanes = enemyLanes(request.enemyChampions, request.pinnedEnemyLanes ?? {}, rows)
  const opponent = lanes.filter(entry => entry.position === request.position).sort((a, b) => b.confidence - a.confidence)[0] ?? null
  const versus = opponent ? await provider.matchups(opponent.championId, { position: request.position, eloBracket: elo }).catch(() => null) : null

  const taken = new Set([...request.enemyChampions, ...(request.bans ?? []), ...Object.values(request.allies ?? {})])
  const pool = request.candidates.length ? request.candidates : [...lane].sort((a, b) => b.pickRate - a.pickRate).slice(0, 40).map(row => row.championId)
  const candidates: DraftCandidate[] = pool.filter(id => !taken.has(id)).map((championId) => {
    const own = lane.find(row => row.championId === championId)
    const strengthDelta = own ? own.winRate - average : 0
    const strengthGames = own ? gamesOf(own.games) : 0
    // The opponent's matchups are its win rate against each champion: the candidate's is the other side of it.
    const row = versus?.matchups.find(entry => entry.opponentChampionId === championId)
    const matchupDelta = row ? (1 - row.winRate) - (own?.winRate ?? 0.5) : 0
    const matchupGames = row?.games ?? 0
    const reasons: DraftReason[] = []
    if (row && opponent) reasons.push(reason({ kind: 'laneMatchup', championId: opponent.championId, position: request.position, delta: matchupDelta, games: matchupGames, probability: opponent.confidence }))
    if (own) reasons.push(reason({ kind: 'laneStrength', position: request.position, delta: strengthDelta, games: strengthGames }))
    reasons.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
    return {
      championId,
      matchupDelta,
      matchupGames,
      strengthDelta,
      strengthGames,
      synergyDelta: 0,
      synergyGames: 0,
      score: 1.5 * shrink(matchupDelta, matchupGames) + shrink(strengthDelta, strengthGames),
      thinSample: matchupGames + strengthGames < 200,
      reasons,
      patch: list.patchVersion || null,
    }
  }).sort((a, b) => b.score - a.score || a.championId - b.championId)

  return {
    position: request.position,
    patch: list.patchVersion || null,
    eloBracket: elo ?? 'ALL',
    enemyLanes: lanes,
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
          score: -shrink(delta, row.games),
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
