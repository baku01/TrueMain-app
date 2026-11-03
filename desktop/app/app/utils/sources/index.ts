import type { ChampionDirectoryResponse } from '#shared/types/champion-directory'
import type { ChampionMatchups, ChampionSummaryResponse, ChampionTierListResponse, ChampionTrendResponse } from '#shared/types/champions'
import type { ChampionBuildResponse } from '~/types/build'
import type { ExternalSource } from '~/utils/data-source'
import type { BuildOptions } from '~/utils/sources/model'
import type { CompositionBuildRequest } from '#shared/types/composition'
import { readBlitzBuild } from '~/utils/blitz/builds'
import { matchupsFromBlitz, tierListFromBlitz, trendFromBlitz } from '~/utils/blitz/stats'
import { directoryFromBlitz } from '~/utils/blitz/directory'
import { blitzOptions } from '~/utils/sources/blitz'
import { compositionFromSource, compositionGamesFromBlitz } from '~/utils/sources/composition'
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
  options: (championId: number, position: string) => Promise<BuildOptions | null>
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

/** The provider of the source Settings picked; null on TrueMain. */
export function activeProvider(): Provider | null {
  const source = externalSource()
  return source ? PROVIDERS[source] : null
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
  const build = /^\/champions\/(\d+)\/composition-build$/.exec(path)
  if (build) return compositionFromSource(provider, Number(build[1]), request, externalSource() === 'blitz')
  return undefined
}
