import type { RankHistoryEntry } from '#shared/types/rank-history'
import type { Obj } from '~/utils/sources/opgg'
import { asList, callOpgg, num } from '~/utils/sources/opgg'

/**
 * What op.gg's official API adds to a player's profile beyond their games:
 * their place on the region's ladder, the tier they ended each past season on,
 * the highest they reached this season, and their LP over recent weeks — so
 * any player's profile has the curve the player's own keeps locally.
 */
export interface SeasonTier { seasonId: number, tier: string, division: string, leaguePoints: number }

export interface OpggProfile {
  ladder: { rank: number, total: number } | null
  /** Newest season first. */
  previousSeasons: SeasonTier[]
  /** The highest Solo/Duo rank this season. */
  peak: SeasonTier | null
  lpHistory: RankHistoryEntry[]
}

const ROMAN = ['', 'I', 'II', 'III', 'IV']
const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER'])

function tierOf(seasonId: number, info: Obj | undefined): SeasonTier | null {
  const tier = typeof info?.tier === 'string' ? info.tier.toUpperCase() : ''
  if (!tier) return null
  return { seasonId, tier, division: APEX.has(tier) ? 'I' : ROMAN[num(info?.division)] ?? '', leaguePoints: num(info?.lp) }
}

/** op.gg names regions without their digit: `BR1` and `br` are `BR`, `EUN1` and `eune` are `EUNE`. */
export function opggRegion(region: string): string {
  const lower = region.toLowerCase().replace(/\d+$/, '')
  return ({ eun: 'EUNE', la: 'LAN', oc: 'OCE' } as Record<string, string>)[lower] ?? lower.toUpperCase()
}

const profiles = new Map<string, Promise<OpggProfile | null>>()

export function readOpggProfile(region: string, gameName: string, tagLine: string): Promise<OpggProfile | null> {
  const key = `${opggRegion(region)}:${gameName}#${tagLine}`.toLowerCase()
  let answer = profiles.get(key)
  if (!answer) {
    answer = callOpgg('lol_get_summoner_profile', {
      game_name: gameName,
      tag_line: tagLine,
      region: opggRegion(region),
      desired_output_fields: ['data.summoner.ladder_rank', 'data.summoner.previous_seasons[]', 'data.summoner.current_season_high_tiers', 'data.summoner.lp_histories[]'],
    }).then((root) => {
      const summoner = ((root.data as Obj | undefined)?.summoner) as Obj | undefined
      if (!summoner) return null
      const ladder = summoner.ladder_rank as Obj | undefined
      const high = summoner.current_season_high_tiers as Obj | undefined
      const solo = asList(high?.rank_entries).find(entry => entry.game_type === 'SOLORANKED')?.high_rank_info as Obj | undefined
      return {
        ladder: ladder && num(ladder.rank) > 0 ? { rank: num(ladder.rank), total: num(ladder.total) } : null,
        previousSeasons: asList(summoner.previous_seasons)
          .map(season => tierOf(num(season.season_id), season.tier_info as Obj | undefined))
          .filter((season): season is SeasonTier => season !== null)
          .sort((a, b) => b.seasonId - a.seasonId),
        peak: tierOf(num(high?.season_id), solo),
        lpHistory: asList(summoner.lp_histories)
          .map((entry) => {
            const tier = tierOf(0, entry.tier_info as Obj | undefined)
            return tier && typeof entry.created_at === 'string'
              ? { capturedAtUtc: new Date(entry.created_at).toISOString(), tier: tier.tier, division: tier.division, leaguePoints: tier.leaguePoints }
              : null
          })
          .filter((entry): entry is RankHistoryEntry => entry !== null)
          .sort((a, b) => a.capturedAtUtc.localeCompare(b.capturedAtUtc)),
      }
    })
    answer.catch(() => profiles.delete(key))
    profiles.set(key, answer)
  }
  return answer
}
