import type { ChampionTierListResponse } from '#shared/types/champions'
import type { DataSource } from '~/utils/data-source'
import { apiGet } from '~/composables/useApi'
import { dataSource } from '~/utils/data-source'
import { previousPatch } from '~/utils/data-window'
import { SOLO_QUEUE, blitzRows, blitzTier, truemainPosition } from '~/utils/blitz/client'
import { lolalyticsRows } from '~/utils/sources/lolalytics'
import { readFirst, standInOrder } from '~/utils/sources/stand-in'

/**
 * How much each champion's win rate on each lane moved since the patch
 * before — the champions list's change column, as Blitz's "Win Rate Change".
 * Who measures the patch before:
 * - Blitz: `previous_patch_stats`, beside the patch's own figures, one read;
 * - lolalytics: its tier list read again at the patch before (`ep=tier&patch=`);
 * - TrueMain: its tier list read again at the patch before (asked only when
 *   TrueMain is the pick).
 * Who does not: op.gg (the rank it held, not the rate) and Tencent (a daily
 * snapshot). With one of those picked, Blitz stands in, then lolalytics
 * (`standInOrder`); each change is one source's two patches, never two sources'.
 */
export const PATCH_CHANGE_SOURCES: readonly DataSource[] = ['blitz', 'lolalytics', 'truemain']

export interface LaneRate { championId: number, position: string, winRate: number }

export interface WinRateChanges {
  source: DataSource
  /** The patch the changes are measured from; null when the source did not say. */
  since: string | null
  /** The change by `changeKey`, on the 0–1 scale (0.012 = +1.2 points). */
  changes: Map<string, number>
}

export const changeKey = (championId: number, position: string) => `${championId}:${position}`

/** Each lane measured on both patches: the patch's win rate minus the one before's. */
export function changesBetween(current: LaneRate[], previous: LaneRate[]): Map<string, number> {
  const before = new Map(previous.map(lane => [changeKey(lane.championId, lane.position), lane.winRate]))
  const changes = new Map<string, number>()
  for (const lane of current) {
    const key = changeKey(lane.championId, lane.position)
    const was = before.get(key)
    if (was !== undefined) changes.set(key, lane.winRate - was)
  }
  return changes
}

interface BlitzPatchRow {
  champion_id: number
  individual_position: string
  win_rate: number
  previous_patch_stats: { patch: string, win_rate: number } | null
}

const tierRates = (answer: ChampionTierListResponse): LaneRate[] => answer.tiers.flatMap(group => group.entries)

type Read = Omit<WinRateChanges, 'source'>

const READERS: Partial<Record<DataSource, (eloBracket: unknown) => Promise<Read>>> = {
  blitz: async (eloBracket) => {
    const rows = await blitzRows<BlitzPatchRow>('champion_postmatch_stats', {
      queue_id: SOLO_QUEUE,
      region: 'WORLD',
      tier: blitzTier(eloBracket),
      columns: 'champion_id,individual_position,patch,win_rate,previous_patch_stats',
    })
    const lanes = rows.filter(row => row.individual_position !== 'ALL')
    const at = (row: BlitzPatchRow) => ({ championId: row.champion_id, position: truemainPosition(row.individual_position) })
    return {
      since: lanes.find(row => row.previous_patch_stats)?.previous_patch_stats?.patch ?? null,
      changes: changesBetween(
        lanes.map(row => ({ ...at(row), winRate: row.win_rate })),
        lanes.flatMap(row => (row.previous_patch_stats ? [{ ...at(row), winRate: row.previous_patch_stats.win_rate }] : [])),
      ),
    }
  },
  lolalytics: async (eloBracket) => {
    const current = await lolalyticsRows({ eloBracket })
    const since = previousPatch(current[0]?.patchVersion ?? '')
    if (!since) return { since: null, changes: new Map() }
    return { since, changes: changesBetween(current, await lolalyticsRows({ eloBracket, patch: since })) }
  },
  truemain: async (eloBracket) => {
    const bracket = typeof eloBracket === 'string' && eloBracket ? { eloBracket } : {}
    const current = await apiGet<ChampionTierListResponse>('/champions/tierlist', bracket)
    const since = previousPatch(current.patchVersion)
    if (!since) return { since: null, changes: new Map() }
    return { since, changes: changesBetween(tierRates(current), tierRates(await apiGet<ChampionTierListResponse>('/champions/tierlist', { ...bracket, patch: since }))) }
  },
}

export async function readWinRateChanges(eloBracket?: unknown): Promise<WinRateChanges> {
  const { source, answer } = await readFirst(standInOrder(dataSource.value, PATCH_CHANGE_SOURCES), source => READERS[source]!(eloBracket), read => !read.changes.size)
  return { source, ...answer }
}
