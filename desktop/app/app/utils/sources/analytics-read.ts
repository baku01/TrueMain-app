import type { ChampionAnalytics } from '~/utils/sources/analytics'
import type { DataSource } from '~/utils/data-source'
import { blitzAnalytics } from '~/utils/sources/analytics-blitz'
import { lolalyticsAnalytics } from '~/utils/sources/analytics-lolalytics'
import { tencentAnalytics } from '~/utils/sources/analytics-tencent'
import { opggAnalytics } from '~/utils/sources/analytics-opgg'
import { truemainAnalytics } from '~/utils/sources/analytics-truemain'
import { dataSource } from '~/utils/data-source'

/** One champion's analytics on a lane, from the source Settings picked. */
const READERS: Record<DataSource, (championId: number, position: string, eloBracket: unknown) => Promise<ChampionAnalytics>> = {
  truemain: truemainAnalytics,
  blitz: blitzAnalytics,
  opgg: opggAnalytics,
  lolalytics: lolalyticsAnalytics,
  tencent: tencentAnalytics,
}

export function readAnalytics(championId: number, position: string, eloBracket: unknown): Promise<ChampionAnalytics> {
  return READERS[dataSource.value](championId, position, eloBracket)
}
