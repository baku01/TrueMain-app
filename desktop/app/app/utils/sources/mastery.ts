import type { DataSource } from '~/utils/data-source'
import type { MasteryRow } from '~/utils/blitz/mastery'
import { dataSource } from '~/utils/data-source'
import { masteryFromBlitz } from '~/utils/blitz/mastery'
import { readFirst, standInOrder } from '~/utils/sources/stand-in'

/**
 * Win rate by champion mastery (`StatsMastery`). Only Blitz measures it
 * (`champion_postmatch_stats`' `mastery_stats`): TrueMain computes nothing by
 * mastery, op.gg's leaderboards are of players, not of rates, lolalytics has
 * one-tricks as a single bracket, and Tencent's buckets are undocumented and
 * mostly a single one. So Blitz answers whatever the pick.
 */
export const MASTERY_SOURCES: readonly DataSource[] = ['blitz']

export interface MasterySourceRead { source: DataSource, patch: string | null, rows: MasteryRow[] }

export async function readMastery(): Promise<MasterySourceRead> {
  const { source, answer } = await readFirst(standInOrder(dataSource.value, MASTERY_SOURCES), () => masteryFromBlitz(), read => !read.rows.length)
  return { source, ...answer }
}
