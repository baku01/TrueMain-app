import type { ChampionDirectoryResponse } from '#shared/types/champion-directory'
import type { ChampionMatchups, ChampionSummaryResponse, ChampionTierListResponse, ChampionTrendResponse } from '#shared/types/champions'
import type { ChampionBuildResponse } from '~/types/build'
import type { ExternalSource } from '~/utils/data-source'
import type { BuildOptions } from '~/utils/sources/model'
import type { CompositionBuildRequest } from '#shared/types/composition'
import { readBlitzBuild } from '~/utils/blitz/playstyles'
import { damageProfilesFromBlitz, matchupsFromBlitz, tierListFromBlitz, trendFromBlitz } from '~/utils/blitz/stats'
import { directoryFromBlitz } from '~/utils/blitz/directory'
import { blitzOptions } from '~/utils/sources/blitz'
import { compositionFromSource, compositionGamesFromBlitz } from '~/utils/sources/composition'
import { nextItemFromSource } from '~/utils/sources/next-item'
import { championTraits } from '~/utils/sources/champions'
import type { NextItemRequest } from '~/utils/next-item'
import { pageDirectory } from '~/utils/sources/directory'
import { lolalyticsBuilds, lolalyticsMatchups, lolalyticsOptions, lolalyticsRows, lolalyticsTierList, lolalyticsTrend } from '~/utils/sources/lolalytics'
import { tencentBuilds, tencentMatchups, tencentOptions, tencentRows, tencentTierList, tencentTrend } from '~/utils/sources/tencent'
import { opggBuilds, opggMatchups, opggOptions, opggRows, opggTierList, opggTrend } from '~/utils/sources/opgg'
import { externalSource } from '~/utils/data-source'

/**
 * Every source other than TrueMain answers the same reads, in TrueMain's
 * shapes, so the pages draw them unchanged: a lane's builds, every option the
 * build panel lists, the tier list, the champions list, a lane's matchups and
 * its trend. `apiGet` and `readChampionBuild` ask the source Settings picked.
 */
export interface Provider {
  builds: (championId: number, position: string, opponentChampionId?: number | null) => Promise<ChampionBuildResponse>
  /** Every option measured on the lane — against `opponentChampionId` when the source measures builds by matchup (Blitz). */
  options: (championId: number, position: string, opponentChampionId?: number | null) => Promise<BuildOptions | null>
  tierList: (query: Record<string, unknown>) => Promise<ChampionTierListResponse>
  directory: (query: Record<string, unknown>) => Promise<ChampionDirectoryResponse>
  matchups: (championId: number, query: Record<string, unknown>) => Promise<ChampionMatchups>
  trend: (championId: number, query: Record<string, unknown>) => Promise<ChampionTrendResponse>
}

const withRows = (rows: (query: Record<string, unknown>) => Promise<ChampionSummaryResponse[]>, builds: Provider['builds']) =>
  async (query: Record<string, unknown>) => pageDirectory(await rows(query), query, (id, position) => builds(id, position))

const lolalyticsProvider: Provider = {
  builds: lolalyticsBuilds,
  options: lolalyticsOptions,
  tierList: lolalyticsTierList,
  directory: withRows(lolalyticsRows, lolalyticsBuilds),
  matchups: lolalyticsMatchups,
  trend: lolalyticsTrend,
}

const opggProvider: Provider = {
  builds: opggBuilds,
  options: opggOptions,
  tierList: opggTierList,
  directory: withRows(opggRows, opggBuilds),
  matchups: opggMatchups,
  trend: opggTrend,
}

const blitzProvider: Provider = {
  builds: readBlitzBuild,
  options: blitzOptions,
  tierList: tierListFromBlitz,
  directory: directoryFromBlitz,
  matchups: matchupsFromBlitz,
  trend: trendFromBlitz,
}

const tencentProvider: Provider = {
  builds: tencentBuilds,
  options: tencentOptions,
  tierList: tencentTierList,
  directory: withRows(tencentRows, tencentBuilds),
  matchups: tencentMatchups,
  trend: tencentTrend,
}

export const PROVIDERS: Record<ExternalSource, Provider> = { blitz: blitzProvider, opgg: opggProvider, lolalytics: lolalyticsProvider, tencent: tencentProvider }

/** An answer that says nothing: no build, no row, no point — the next source is asked. */
function empty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value !== 'object') return false
  const answer = value as Record<string, unknown>
  if (Array.isArray(answer.builds)) return !answer.builds.length
  if (Array.isArray(answer.tiers)) return !(answer.tiers as { entries: unknown[] }[]).some(group => group.entries.length)
  if (Array.isArray(answer.rows)) return !answer.rows.length
  if (Array.isArray(answer.matchups)) return !answer.matchups.length
  if (Array.isArray(answer.points)) return !answer.points.length
  if ('cores' in answer) return !(answer.cores as unknown[]).length && !(answer.boots as unknown[]).length
  return false
}

/** Each read asked of `sources` in turn, the first that answers something kept. */
function firstAnswering(sources: Provider[]): Provider {
  const chain = <K extends keyof Provider>(method: K) => (async (...args: unknown[]) => {
    let failure: unknown = null
    for (const source of sources) {
      try {
        const answer = await (source[method] as (...a: unknown[]) => Promise<unknown>)(...args)
        if (!empty(answer)) return answer
      }
      catch (error) {
        failure = error
      }
    }
    if (failure) throw failure
    return (sources[0]![method] as (...a: unknown[]) => Promise<unknown>)(...args)
  }) as Provider[K]
  return { builds: chain('builds'), options: chain('options'), tierList: chain('tierList'), directory: chain('directory'), matchups: chain('matchups'), trend: chain('trend') }
}

/**
 * The provider of the source Settings picked; null on TrueMain. The builds and
 * runes are strictly that source's — never filled from another. Every other
 * read asks it first, then lolalytics, then Blitz, for what it does not have:
 * each answer whole from one source, never two pooled.
 */
export function activeProvider(): Provider | null {
  const source = externalSource()
  if (!source) return null
  const own = PROVIDERS[source]
  return { ...firstAnswering([own, lolalyticsProvider, blitzProvider]), builds: own.builds, options: own.options }
}

/**
 * lolalytics, then Blitz for what it does not have, whatever source Settings
 * picked: the Jev matchup page's reads, which pool those two (`combineOptions`)
 * and so read the rest from them too.
 */
export function lolalyticsThenBlitz(): Provider {
  return firstAnswering([lolalyticsProvider, blitzProvider])
}

/**
 * The TrueMain reads the picked source answers, by path, in TrueMain's own
 * shapes. `undefined`: TrueMain is the source, or the path has no counterpart
 * there, and the read goes to TrueMain as always.
 */
export function answerFromSource(path: string, query: Record<string, unknown>): Promise<unknown> | undefined {
  const provider = activeProvider()
  if (!provider) return undefined
  if (path === '/champions/tierlist') return provider.tierList(query)
  if (path === '/champions/directory') return provider.directory(query)
  const matchups = /^\/champions\/(\d+)\/matchups$/.exec(path)
  if (matchups) return provider.matchups(Number(matchups[1]), query)
  const trend = /^\/champions\/(\d+)\/trend$/.exec(path)
  if (trend) return provider.trend(Number(trend[1]), query)
  // TrueMain's situational reading of each item — its model's, which no other
  // source has: none, rather than TrueMain's beside another source's build.
  // Every champion's damage split for the team bars: Blitz's measured split
  // (`damageProfilesFromBlitz`); where it cannot be read, Riot's own 0–10
  // attack and magic ratings (Data Dragon) as the split, the same weight each.
  if (path === '/champions/damage-profiles') {
    return damageProfilesFromBlitz().catch(() => championTraits().then(traits => ({
      patch: null,
      profiles: [...traits.values()].filter(champion => champion.info).map((champion) => {
        const total = Math.max(1, champion.info!.attack + champion.info!.magic)
        return {
          championId: champion.id,
          position: null,
          profilePosition: null,
          source: 'measured' as const,
          patch: null,
          games: null,
          physicalShare: champion.info!.attack / total,
          magicShare: champion.info!.magic / total,
          trueShare: 0,
          damagePerGame: 20000,
          damageClass: null,
          builds: [],
          flexDamage: false,
        }
      }),
    })))
  }
  // The shop's classes are TrueMain's reading of the client: none from another source.
  if (path === '/items/classes') return Promise.resolve({ patch: String(query.patch ?? ''), items: [] })
  const itemContext = /^\/champions\/(\d+)\/item-context$/.exec(path)
  if (itemContext) {
    return Promise.resolve({ championId: Number(itemContext[1]), position: String(query.position ?? ''), patch: typeof query.patch === 'string' ? query.patch : null, allRanks: true, items: [] })
  }
  return undefined
}

/**
 * The matchup tool's POST reads, answered from the picked source
 * (`utils/sources/composition.ts`); `undefined` on TrueMain and for every
 * other POST — the draft's item advice stays TrueMain's model.
 */
export function answerPostFromSource(path: string, body: unknown, query: Record<string, unknown>): Promise<unknown> | undefined {
  const provider = activeProvider()
  if (!provider) return undefined
  const request = body as CompositionBuildRequest
  const games = /^\/champions\/(\d+)\/composition-build\/games$/.exec(path)
  if (games) return compositionGamesFromBlitz(Number(games[1]), request, Math.max(1, Number(query.page) || 1), Math.max(1, Number(query.pageSize) || 13))
  const next = /^\/champions\/(\d+)\/next-item$/.exec(path)
  if (next) return nextItemFromSource(provider, Number(next[1]), request as unknown as NextItemRequest)
  const build = /^\/champions\/(\d+)\/composition-build$/.exec(path)
  if (build) return compositionFromSource(provider, Number(build[1]), request, externalSource() === 'blitz')
  return undefined
}
