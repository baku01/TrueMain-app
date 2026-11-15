import type { ChampionAnalytics } from '~/utils/sources/analytics'
import type { DataSource } from '~/utils/data-source'
import { blitzAnalytics } from '~/utils/sources/analytics-blitz'
import { lolalyticsAnalytics } from '~/utils/sources/analytics-lolalytics'
import { tencentAnalytics } from '~/utils/sources/analytics-tencent'
import { opggAnalytics } from '~/utils/sources/analytics-opgg'
import { truemainAnalytics } from '~/utils/sources/analytics-truemain'
import { leadSource } from '~/utils/data-source'

type Reader = (championId: number, position: string, eloBracket: unknown, region?: string, opponentId?: number | null) => Promise<ChampionAnalytics>

/** One champion's analytics on a lane, by source: Mobalytics measures none of its own. */
const READERS: Partial<Record<DataSource, Reader>> = {
  truemain: truemainAnalytics,
  blitz: blitzAnalytics,
  opgg: opggAnalytics,
  lolalytics: lolalyticsAnalytics,
  tencent: tencentAnalytics,
}

/** The sources that read a champion against one opponent (`ChampionAnalytics.versus`). */
export const MATCHUP_SOURCES: readonly DataSource[] = ['lolalytics', 'blitz']

/**
 * `region` narrows the read to one server where the source measures them
 * (lolalytics); `all` is every server. `opponentId` reads the lane against
 * that champion where the source measures it (`MATCHUP_SOURCES`).
 */
export async function readAnalytics(championId: number, position: string, eloBracket: unknown, region = 'all', opponentId: number | null = null): Promise<ChampionAnalytics> {
  // The lead source (the most detailed), then the others in turn when it fails — never TrueMain.
  const order = [leadSource.value, 'blitz', 'opgg', 'tencent'] as const
  let failure: unknown = new Error('No source measures these analytics')
  for (const source of [...new Set(order)]) {
    const read = READERS[source]
    if (!read || source === 'truemain') continue
    try {
      return await read(championId, position, eloBracket, region, opponentId)
    }
    catch (error) {
      failure = error
    }
  }
  throw failure
}
