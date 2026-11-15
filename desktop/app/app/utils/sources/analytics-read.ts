import type { ChampionAnalytics } from '~/utils/sources/analytics'
import type { DataSource } from '~/utils/data-source'
import { blitzAnalytics } from '~/utils/sources/analytics-blitz'
import { lolalyticsAnalytics } from '~/utils/sources/analytics-lolalytics'
import { mobalyticsAnalytics } from '~/utils/sources/analytics-mobalytics'
import { tencentAnalytics } from '~/utils/sources/analytics-tencent'
import { opggAnalytics } from '~/utils/sources/analytics-opgg'
import { combineAnalytics } from '~/utils/sources/analytics-combined'
import { settled } from '~/utils/sources'

type Reader = (championId: number, position: string, eloBracket: unknown, region?: string, opponentId?: number | null) => Promise<ChampionAnalytics>

/** The sources whose analytics are read together, most complete first: they count the same ranked games (`utils/sources/combined`). */
const POOLED: [DataSource, Reader][] = [
  ['lolalytics', lolalyticsAnalytics],
  ['mobalytics', mobalyticsAnalytics],
  ['blitz', blitzAnalytics],
  ['opgg', opggAnalytics],
]

/** The sources that read a champion against one opponent (`ChampionAnalytics.versus`). */
export const MATCHUP_SOURCES: readonly DataSource[] = ['lolalytics', 'blitz']

/** The page's figures and the sources they were read from, most complete first. */
export interface AnalyticsRead { analytics: ChampionAnalytics, sources: DataSource[] }

const answered = (analytics: ChampionAnalytics | null): analytics is ChampionAnalytics => !!analytics && (!!analytics.header || !!analytics.options)

/**
 * One champion's lane, every source's analytics as one (`combineAnalytics`):
 * lolalytics, Mobalytics, Blitz and op.gg at once. Blitz's builds count
 * other games than the lane's — its keystones win 4 to 6 points above the
 * others' over the lane's games, Ahri's 57.0 % to lolalytics' 51.2 % —, so
 * its build options join only when no other source answered any. `region`
 * narrows the read to one server, which only lolalytics measures: it alone
 * then. `opponentId` reads the lane against that champion, where a source
 * measures it (`MATCHUP_SOURCES`). Tencent, China's servers, another
 * population, answers only when none of them did — never TrueMain.
 */
export async function readAnalytics(championId: number, position: string, eloBracket: unknown, region = 'all', opponentId: number | null = null): Promise<AnalyticsRead> {
  if (region !== 'all') return { analytics: await lolalyticsAnalytics(championId, position, eloBracket, region, opponentId), sources: ['lolalytics'] }
  const reads = await settled(POOLED.map(([, read]) => read(championId, position, eloBracket, region, opponentId)))
  const all = POOLED.flatMap(([source], index) => (answered(reads[index] ?? null) ? [{ source, analytics: reads[index]! }] : []))
  const present = opponentId === null ? all : all.filter(entry => entry.analytics.versus === opponentId)
  if (present.length) {
    const others = present.some(entry => entry.source !== 'blitz' && entry.analytics.options)
    const answers = present.map(entry => (entry.source === 'blitz' && others ? withoutBuilds(entry.analytics) : entry.analytics))
    return { analytics: combineAnalytics(answers, opponentId), sources: present.map(entry => entry.source) }
  }
  // None read the matchup: the first lane's figures, said so by the page (`versus` null).
  const lane = all[0]
  if (lane) return { analytics: lane.analytics, sources: [lane.source] }
  return { analytics: await tencentAnalytics(championId, position), sources: ['tencent'] }
}

/** A source's analytics without its builds: its options and the two builds and skill orders read from them. */
function withoutBuilds(analytics: ChampionAnalytics): ChampionAnalytics {
  return { ...analytics, options: null, summary: { common: null, winning: null }, skillPaths: { ...analytics.skillPaths, priority: [] } }
}
