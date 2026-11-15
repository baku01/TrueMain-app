import type { ChampionDirectoryResponse } from '#shared/types/champion-directory'
import type { ChampionMatchups, ChampionSummaryResponse, ChampionTierListResponse, ChampionTrendResponse } from '#shared/types/champions'
import type { ChampionBuildResponse } from '~/types/build'
import type { ExternalSource } from '~/utils/data-source'
import type { BuildOptions } from '~/utils/sources/model'
import type { CompositionBuildRequest } from '#shared/types/composition'
import { readBlitzBuild } from '~/utils/blitz/playstyles'
import { damageProfilesFromBlitz, matchupsFromBlitz, tierListFromBlitz, trendFromBlitz } from '~/utils/blitz/stats'
import { directoryFromBlitz } from '~/utils/blitz/directory'
import { MIN_MATCHUP_GAMES, blitzOptions, blitzOptionsOf } from '~/utils/sources/blitz'
import { readBlitzBuildDoc } from '~/utils/blitz/builds'
import { compositionFromSource, compositionGamesFromBlitz } from '~/utils/sources/composition'
import { nextItemFromSource } from '~/utils/sources/next-item'
import { championTraits, currentPatch  } from '~/utils/sources/champions'
import type { NextItemRequest } from '~/utils/next-item'
import { pageDirectory } from '~/utils/sources/directory'
import { lolalyticsBuilds, lolalyticsMatchups, lolalyticsOptions, lolalyticsRows, lolalyticsTierList, lolalyticsTrend } from '~/utils/sources/lolalytics'
import { tencentBuilds, tencentMatchups, tencentOptions, tencentRows, tencentTierList, tencentTrend } from '~/utils/sources/tencent'
import { opggBuilds, opggMatchups, opggOptions, opggRows, opggTierList, opggTrend } from '~/utils/sources/opgg'
import { mobalyticsBuilds, mobalyticsMatchups, mobalyticsOptions, mobalyticsTrend } from '~/utils/sources/mobalytics'
import { combineMatchups, combineOptions, combineRows, combineTrends } from '~/utils/sources/combined'
import { buildsFromOptions } from '~/utils/sources/model'

/**
 * Every source other than TrueMain answers the same reads, in TrueMain's
 * shapes, so the pages draw them unchanged: a lane's builds, every option the
 * build panel lists, the tier list, the champions list, a lane's matchups and
 * its trend. `apiGet` and `readChampionBuild` ask them all as one
 * (`activeProvider`).
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

/** Mobalytics measures no tier list or champions list of its own: the next source answers those. */
const mobalyticsProvider: Provider = {
  builds: mobalyticsBuilds,
  options: mobalyticsOptions,
  tierList: async query => ({ patchVersion: '', position: typeof query.position === 'string' ? query.position : null, tiers: [] }),
  directory: async () => ({ rows: [], page: 1, pageSize: 0, total: 0, patchVersion: '' }),
  matchups: mobalyticsMatchups,
  trend: mobalyticsTrend,
}

export const PROVIDERS: Record<ExternalSource, Provider> = { lolalytics: lolalyticsProvider, mobalytics: mobalyticsProvider, blitz: blitzProvider, opgg: opggProvider, tencent: tencentProvider }

/**
 * The global sources, most complete first (`DATA_SOURCES`): every read asks
 * them all and averages their answers (`utils/sources/combined`), for they
 * count the same games. Tencent — China's servers, another population and
 * meta — is never averaged in: it answers only when they all answer nothing.
 */
const POOLED: Provider[] = [lolalyticsProvider, mobalyticsProvider, blitzProvider, opggProvider]

/** How long a read waits for a slow source: past it, the others' answers stand without it. */
const SOURCE_BUDGET_MS = 8000

/** Each read's answer, or null when it failed or outlasted the budget. */
function settled<T>(reads: Promise<T>[]): Promise<(T | null)[]> {
  return Promise.all(reads.map(read => Promise.race([
    read.catch(() => null),
    new Promise<null>(resolve => setTimeout(resolve, SOURCE_BUDGET_MS, null)),
  ])))
}

const present = <T>(answers: (T | null)[]) => answers.filter((answer): answer is T => answer !== null)

/** Every source's rows of the tier list and the champions list, as one (`combineRows`): Mobalytics lists none. */
async function pooledRows(query: Record<string, unknown>): Promise<ChampionSummaryResponse[]> {
  const answers = await settled([
    lolalyticsRows(query),
    directoryFromBlitz({ ...query, page: 1, pageSize: 5000 }).then(answer => answer.rows),
    opggRows(query),
  ])
  return combineRows(present(answers))
}

/**
 * The sources whose lane builds are read on the same games (Emerald+): not
 * Blitz's, whose build documents take no bracket and count every rank —
 * Ahri's mid lane on 16.22 is 309,020 games there against ~264,000
 * Emerald+ on lolalytics and Mobalytics, another stratum, never averaged
 * in. Its builds stay its own rows (playstyles, one-tricks, the matchup's).
 */
const POOLED_BUILDS: Provider[] = [lolalyticsProvider, mobalyticsProvider, opggProvider]

/** The global sources as one provider: each read their answers averaged, the games the largest source's. */
const pooledProvider: Provider = {
  options: async (championId, position) => combineOptions(...await settled(POOLED_BUILDS.map(source => source.options(championId, position)))),
  builds: async (championId, position) => buildsFromOptions(championId, position, await pooledProvider.options(championId, position)),
  tierList: async (query) => {
    const position = typeof query.position === 'string' && query.position ? query.position : null
    // Across every lane, only the lanes that make up a real share of the champion's games.
    const rows = (await pooledRows(query)).filter(row => (position === null ? row.lanePlayRate >= 0.08 : row.position === position))
    const tiers = ['S', 'A', 'B', 'C', 'D'].map(tier => ({
      tier,
      entries: rows.filter(row => row.tier === tier).sort((a, b) => b.tierScore - a.tierScore || b.winRate - a.winRate)
        .map(row => ({ championId: row.championId, position: row.position, games: row.games, winRate: row.winRate, pickRate: row.pickRate, banRate: row.banRate })),
    })).filter(group => group.entries.length > 0)
    return { patchVersion: rows[0]?.patchVersion ?? await currentPatch(), position, tiers }
  },
  directory: async query => pageDirectory(await pooledRows(query), query, (championId, position) => pooledProvider.builds(championId, position)),
  matchups: async (championId, query) => {
    const position = typeof query.position === 'string' && query.position ? query.position : 'MIDDLE'
    return combineMatchups(championId, position, await settled(POOLED.map(source => source.matchups(championId, query))))
  },
  trend: async (championId, query) => {
    const position = typeof query.position === 'string' && query.position ? query.position : 'MIDDLE'
    return combineTrends(championId, position, present(await settled(POOLED.map(source => source.trend(championId, query)))))
  },
}

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
 * Blitz's builds in the games against one opponent — the only source that
 * measures builds by matchup —, once there are enough of them to stand on
 * their own; nothing otherwise, and the lane's are read instead.
 */
const blitzVersus: Provider = {
  ...blitzProvider,
  builds: async (championId, position, opponent) => (opponent ? readBlitzBuild(championId, position, opponent) : { championId, patch: null, position, totalGames: 0, builds: [] }),
  options: async (championId, position, opponent) => {
    if (!opponent) return null
    const doc = await readBlitzBuildDoc(championId, position, opponent)
    return doc && doc.games >= MIN_MATCHUP_GAMES ? await blitzOptionsOf(doc) : null
  },
}

/**
 * Every source as one: the global ones averaged, never their games added up
 * (`pooledProvider`, `utils/sources/combined`); Tencent only when they all
 * answer nothing. Against a lane opponent, Blitz's builds in those very
 * games come first — no other source measures builds by matchup.
 */
export function activeProvider(): Provider {
  const lane = firstAnswering([pooledProvider, tencentProvider])
  const versus = firstAnswering([blitzVersus, pooledProvider, tencentProvider])
  return {
    ...lane,
    builds: (championId, position, opponent) => (opponent ? versus : lane).builds(championId, position, opponent),
    options: (championId, position, opponent) => (opponent ? versus : lane).options(championId, position, opponent),
  }
}

/**
 * The TrueMain reads the sources answer, by path, in TrueMain's own shapes.
 * `undefined`: the path has no counterpart there, and the read fails
 * (`NotFromSourceError`) — TrueMain itself is never asked.
 */
export function answerFromSource(path: string, query: Record<string, unknown>): Promise<unknown> | undefined {
  const provider = activeProvider()
  if (path === '/champions/tierlist') return provider.tierList(query)
  if (path === '/champions/directory') return provider.directory(query)
  const matchups = /^\/champions\/(\d+)\/matchups$/.exec(path)
  if (matchups) return provider.matchups(Number(matchups[1]), query)
  const trend = /^\/champions\/(\d+)\/trend$/.exec(path)
  if (trend) return provider.trend(Number(trend[1]), query)
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
  // The shop's classes and each item's situational reading are TrueMain's
  // model's, which no other source has — and TrueMain is never asked: none.
  if (path === '/items/classes') return Promise.resolve({ patch: String(query.patch ?? ''), items: [] })
  const itemContext = /^\/champions\/(\d+)\/item-context$/.exec(path)
  if (itemContext) {
    return Promise.resolve({ championId: Number(itemContext[1]), position: String(query.position ?? ''), patch: typeof query.patch === 'string' ? query.patch : null, allRanks: true, items: [] })
  }
  return undefined
}

/**
 * The matchup tool's POST reads, answered from the sources
 * (`utils/sources/composition.ts`); `undefined` for every other POST, which
 * then fails — TrueMain is never asked.
 */
export function answerPostFromSource(path: string, body: unknown, query: Record<string, unknown>): Promise<unknown> | undefined {
  const provider = activeProvider()
  const request = body as CompositionBuildRequest
  const games = /^\/champions\/(\d+)\/composition-build\/games$/.exec(path)
  if (games) return compositionGamesFromBlitz(Number(games[1]), request, Math.max(1, Number(query.page) || 1), Math.max(1, Number(query.pageSize) || 13))
  const next = /^\/champions\/(\d+)\/next-item$/.exec(path)
  if (next) return nextItemFromSource(provider, Number(next[1]), request as unknown as NextItemRequest)
  const build = /^\/champions\/(\d+)\/composition-build$/.exec(path)
  if (build) return compositionFromSource(provider, Number(build[1]), request, true)
  return undefined
}
