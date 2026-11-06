import type { ChampionMatchupEntry, ChampionMatchups, ChampionTierListResponse, ChampionTrendResponse } from '#shared/types/champions'
import type { DamageProfile, DamageProfilesResponse } from '~/utils/damage-profile'
import { SOLO_QUEUE, blitzRole, blitzRows, blitzTier, truemainPosition } from '~/utils/blitz/client'

/**
 * Blitz's lane statistics in the shapes of TrueMain's endpoints: the tier list
 * (`GET /champions/tierlist`), a champion's lane matchups
 * (`GET /champions/{id}/matchups`) and its lane's trend (`GET /champions/{id}/trend`).
 */

/** Blitz grades a champion on a lane 1 (best) to 5; TrueMain names the same steps S to D. */
const TIER_BY_GRADE: Record<number, string> = { 1: 'S', 2: 'A', 3: 'B', 4: 'C', 5: 'D' }

interface BlitzChampionRow {
  champion_id: number
  individual_position: string
  patch: string
  games: number
  win_rate: number
  pick_rate: number
  champion_ban_rate: number | null
  champion_role_tier: number | null
}

/** The share of a champion's games a lane needs to be listed when every lane is shown. */
const MIN_LANE_SHARE = 0.08

export async function tierListFromBlitz(query: Record<string, unknown>): Promise<ChampionTierListResponse> {
  const position = typeof query.position === 'string' && query.position ? query.position : null
  const rows = await blitzRows<BlitzChampionRow>('champion_postmatch_stats', {
    queue_id: SOLO_QUEUE,
    region: 'WORLD',
    tier: blitzTier(query.eloBracket),
    columns: 'champion_id,individual_position,patch,games,win_rate,pick_rate,champion_ban_rate,champion_role_tier',
  })
  // Every lane a champion was ever played on is a row; across all lanes only
  // the ones that make up a real share of its games are listed, as the
  // site's own tier list does — a support Yasuo is not a tier list entry.
  const byChampion = new Map<number, number>()
  for (const row of rows) if (row.individual_position !== 'ALL') byChampion.set(row.champion_id, (byChampion.get(row.champion_id) ?? 0) + row.games)
  const lanes = rows.filter(row => row.individual_position !== 'ALL'
    && (position === null
      ? row.games >= MIN_LANE_SHARE * (byChampion.get(row.champion_id) ?? 0)
      : truemainPosition(row.individual_position) === position))
  const tiers = ['S', 'A', 'B', 'C', 'D'].map(tier => ({
    tier,
    entries: lanes
      .filter(row => TIER_BY_GRADE[row.champion_role_tier ?? 0] === tier)
      .sort((a, b) => b.win_rate - a.win_rate)
      .map(row => ({
        championId: row.champion_id,
        position: truemainPosition(row.individual_position),
        games: row.games,
        winRate: row.win_rate,
        pickRate: row.pick_rate,
        banRate: row.champion_ban_rate ?? null,
      })),
  })).filter(group => group.entries.length > 0)
  return { patchVersion: rows[0]?.patch ?? '', position, tiers }
}

interface BlitzMatchupRow {
  matchup_champion_id: number
  individual_position: string
  patch: string
  games: number
  wins: number
  win_rate: number
  pick_rate: number
  lane_win_rate: number | null
  num_lanes: number | null
  matchup_score: number | null
  lane_matchup_score: number | null
}

/**
 * A Blitz matchup with the two scores its counters rank by (`utils/counters.ts`): the
 * win rate, and the lane win rate, minus what the two champions' own rates
 * predict — on the 0–1 scale, so 0.02 is two percentage points. TrueMain's
 * shape has no such field; the other readers ignore it.
 */
export interface BlitzMatchupEntry extends ChampionMatchupEntry {
  matchupScore: number | null
  laneMatchupScore: number | null
}

/**
 * The 95% interval of a win rate over `games` (Wilson), which TrueMain's
 * answer carries and Blitz's does not: the matchup views shade a thin sample by it.
 */
function wilson(wins: number, games: number): [number, number] {
  if (games === 0) return [0, 1]
  const z = 1.96
  const p = wins / games
  const denominator = 1 + z * z / games
  const centre = p + z * z / (2 * games)
  const spread = z * Math.sqrt(p * (1 - p) / games + z * z / (4 * games * games))
  return [(centre - spread) / denominator, (centre + spread) / denominator]
}

export async function matchupsFromBlitz(championId: number, query: Record<string, unknown>): Promise<Omit<ChampionMatchups, 'matchups'> & { matchups: BlitzMatchupEntry[] }> {
  const position = typeof query.position === 'string' && query.position ? query.position : 'MIDDLE'
  const rows = await blitzRows<BlitzMatchupRow>('champion_matchups_stats', {
    champion_id: championId,
    queue_id: SOLO_QUEUE,
    tier: blitzTier(query.eloBracket),
    region: 'WORLD',
    individual_position: blitzRole(position),
  })
  const opponent = Number(query.opponent) || null
  const matchups = rows
    .filter(row => opponent === null || row.matchup_champion_id === opponent)
    .map((row): BlitzMatchupEntry => {
      const [low, high] = wilson(row.wins, row.games)
      return {
        opponentChampionId: row.matchup_champion_id,
        games: row.games,
        wins: row.wins,
        winRate: row.win_rate,
        playRate: row.pick_rate,
        winRateLowerBound: low,
        winRateUpperBound: high,
        laneWinRate: row.lane_win_rate ?? null,
        decidedLaneGames: row.num_lanes ?? 0,
        // Blitz measures no gold or XP difference per matchup.
        averageGoldDiffAt15: null,
        goldDiffLaneGames: 0,
        averageXpDiffAt15: null,
        xpDiffLaneGames: 0,
        matchupScore: row.matchup_score ?? null,
        laneMatchupScore: row.lane_matchup_score ?? null,
      }
    })
    .sort((a, b) => b.games - a.games)
  // Each opponent's row is the last patch it was measured on — a rare one's
  // can be a season old —, so the read's patch is the newest among them.
  const patch = rows.map(row => row.patch).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0] ?? null
  return { championId, position, patch, matchups }
}

interface BlitzTrendRow {
  individual_position: string
  patch: string
  games: number
  win_rate: number
  pick_rate: number
  champion_ban_rate: number | null
  previous_patch_stats: { patch: string, games: number, win_rate: number, role_pickrate: number, ban_rate: number | null } | null
}

/** Blitz keeps the patch on screen and the one before it: the trend is those two points. */
export async function trendFromBlitz(championId: number, query: Record<string, unknown>): Promise<ChampionTrendResponse> {
  const position = typeof query.position === 'string' && query.position ? query.position : 'MIDDLE'
  const rows = await blitzRows<BlitzTrendRow>('champion_postmatch_stats', {
    queue_id: SOLO_QUEUE,
    region: 'WORLD',
    tier: blitzTier(query.eloBracket),
    champion_id: championId,
    columns: 'individual_position,patch,games,win_rate,pick_rate,champion_ban_rate,previous_patch_stats',
  })
  const row = rows.find(entry => truemainPosition(entry.individual_position) === position)
  const previous = row?.previous_patch_stats
  const points = [
    ...(previous ? [{ patch: previous.patch, winRate: previous.win_rate, pickRate: previous.role_pickrate, banRate: previous.ban_rate ?? null, games: previous.games }] : []),
    ...(row ? [{ patch: row.patch, winRate: row.win_rate, pickRate: row.pick_rate, banRate: row.champion_ban_rate ?? null, games: row.games }] : []),
  ]
  return { championId, position, points }
}

interface BlitzDamageRow {
  champion_id: number
  individual_position: string
  games: number
  patch?: string
  postmatch_damage?: { physical_damage_dealt_to_champions: number, magic_damage_dealt_to_champions: number, true_damage_dealt_to_champions: number } | null
}

/**
 * Every champion's damage to champions split into physical, magic and true,
 * as Blitz measures it per lane (`champion_postmatch_stats`, Emerald and above,
 * the live patch) — what its own champion-select damage bars read — in the
 * shape of TrueMain's damage profiles, so the team bars draw them unchanged.
 * A champion's `ALL` row stands for it on a lane it was not measured on.
 */
export async function damageProfilesFromBlitz(): Promise<DamageProfilesResponse> {
  const rows = await blitzRows<BlitzDamageRow>('champion_postmatch_stats', {
    queue_id: SOLO_QUEUE,
    region: 'WORLD',
    tier: blitzTier('EMERALD_PLUS'),
    columns: 'champion_id,individual_position,games,patch,postmatch_damage',
  })
  const profiles = rows.flatMap((row): DamageProfile[] => {
    const damage = row.postmatch_damage
    if (!damage || !row.games) return []
    const total = damage.physical_damage_dealt_to_champions + damage.magic_damage_dealt_to_champions + damage.true_damage_dealt_to_champions
    if (total <= 0) return []
    const position = row.individual_position === 'ALL' ? null : truemainPosition(row.individual_position)
    return [{
      championId: row.champion_id,
      position,
      profilePosition: position,
      source: 'measured',
      patch: row.patch ?? null,
      games: row.games,
      physicalShare: damage.physical_damage_dealt_to_champions / total,
      magicShare: damage.magic_damage_dealt_to_champions / total,
      trueShare: damage.true_damage_dealt_to_champions / total,
      damagePerGame: total / row.games,
      damageClass: null,
      builds: [],
      flexDamage: false,
    }]
  })
  if (!profiles.length) throw new Error('Blitz measured no damage profile')
  return { patch: rows[0]?.patch ?? null, profiles }
}
