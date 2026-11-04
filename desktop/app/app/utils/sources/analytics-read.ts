import type { ChampionAnalytics } from '~/utils/sources/analytics'
import type { DataSource } from '~/utils/data-source'
import { blitzAnalytics } from '~/utils/sources/analytics-blitz'
import { lolalyticsAnalytics } from '~/utils/sources/analytics-lolalytics'
import { tencentAnalytics } from '~/utils/sources/analytics-tencent'
import { opggAnalytics } from '~/utils/sources/analytics-opgg'
import { truemainAnalytics } from '~/utils/sources/analytics-truemain'
import { dataSource } from '~/utils/data-source'

/** One champion's analytics on a lane, from the source Settings picked. */
const READERS: Record<DataSource, (championId: number, position: string, eloBracket: unknown, region?: string) => Promise<ChampionAnalytics>> = {
  truemain: truemainAnalytics,
  blitz: blitzAnalytics,
  opgg: opggAnalytics,
  lolalytics: lolalyticsAnalytics,
  tencent: tencentAnalytics,
}

/** `region` narrows the read to one server where the source measures them (lolalytics); `all` is every server. */
export function readAnalytics(championId: number, position: string, eloBracket: unknown, region = 'all'): Promise<ChampionAnalytics> {
  return READERS[dataSource.value](championId, position, eloBracket, region)
}
