import type { ChampionSynergies } from '#shared/types/champions'
import type { DataSource } from '~/utils/data-source'
import type { SynergyRow } from '~/utils/synergies'
import { apiGet } from '~/composables/useApi'
import { dataSource } from '~/utils/data-source'
import { synergyTier, withEnoughGames } from '~/utils/synergies'
import { duosFromBlitz, synergiesFromBlitz } from '~/utils/blitz/synergies'
import { lolalyticsLane, readLolalyticsTeam } from '~/utils/sources/lolalytics'
import { POSITION as OPGG_POSITION, analysis, asList, num } from '~/utils/sources/opgg'
import { readFirst, standInOrder } from '~/utils/sources/stand-in'

/**
 * Champions measured together. A champion's allies on one lane
 * (`ChampionSynergies`) are measured by:
 * - Blitz (`champion_synergies_stats_unlimited`): win rate, delta and grade;
 * - TrueMain (`/champions/{id}/synergies`): win rate and the synergy over
 *   the expected win rate (asked only when TrueMain is the pick);
 * - lolalytics (`build-team`): win rate and its delta 2, in points;
 * - op.gg (the champion analysis' `synergies`): win rate and games, no delta.
 * Tencent measures none: Blitz stands in, then the others (`standInOrder`).
 *
 * The best duos of two lanes across every champion (`StatsDuos`) are Blitz's
 * alone (`champion_synergies_stats`): neither TrueMain, op.gg, lolalytics nor
 * Tencent has such a list, so Blitz answers whatever the pick.
 */
export const SYNERGY_SOURCES: readonly DataSource[] = ['blitz', 'truemain', 'lolalytics', 'opgg']
export const DUO_SOURCES: readonly DataSource[] = ['blitz']

export interface SynergySourceRead { source: DataSource, patch: string | null, rows: SynergyRow[] }
type Read = Omit<SynergySourceRead, 'source'>

/** A row of a source that grades nothing: its tier read off the delta. */
const row = (championId: number, position: string, allyChampionId: number, allyPosition: string, games: number, winRate: number, delta: number | null): SynergyRow =>
  ({ championId, allyChampionId, position, allyPosition, games, winRate, delta, tier: synergyTier(delta) })

const READERS: Partial<Record<DataSource, (championId: number, position: string, ally: string) => Promise<Read>>> = {
  blitz: (championId, position, ally) => synergiesFromBlitz(championId, position, ally),
  truemain: async (championId, position, ally) => {
    const answer = await apiGet<ChampionSynergies>(`/champions/${championId}/synergies`, { position, partnerPosition: ally })
    return { patch: answer.patch, rows: answer.partners.map(entry => row(championId, position, entry.partnerChampionId, entry.partnerPosition || ally, entry.games, entry.winRate, entry.synergy)) }
  },
  lolalytics: async (championId, position, ally) => {
    const team = await readLolalyticsTeam(championId, position)
    // `[id, win rate, delta 1, delta 2, pick rate, games]`, the rates in percent, the deltas in points.
    return { patch: null, rows: (team?.team?.[lolalyticsLane(ally)] ?? []).map(([id, wr, , delta2, , games]) => row(championId, position, id, ally, games, wr / 100, delta2 / 100)) }
  },
  opgg: async (championId, position, ally) => {
    const data = await analysis(championId, position)
    const lane = Object.keys(OPGG_POSITION).find(key => OPGG_POSITION[key] === ally) ?? ''
    const list = asList((data?.synergies as Record<string, never> | undefined)?.[lane])
    // op.gg's analysis measures no delta: the tier stays unknown (`synergyTier`).
    return { patch: null, rows: list.map(entry => row(championId, position, num(entry.synergy_champion_id), ally, num(entry.play), num(entry.win_rate), null)) }
  },
}

const blank = (answer: Read) => !answer.rows.length

/** A champion's allies on `ally`, the ones met too rarely to mean anything left out (`withEnoughGames`). */
export async function readSynergies(championId: number, position: string, ally: string): Promise<SynergySourceRead> {
  const read = async (source: DataSource) => {
    const answer = await READERS[source]!(championId, position, ally)
    return { ...answer, rows: withEnoughGames(answer.rows) }
  }
  const { source, answer } = await readFirst(standInOrder(dataSource.value, SYNERGY_SOURCES), read, blank)
  return { source, ...answer }
}

export async function readDuos(position: string, ally: string): Promise<SynergySourceRead> {
  const { source, answer } = await readFirst(standInOrder(dataSource.value, DUO_SOURCES), () => duosFromBlitz(position, ally), blank)
  return { source, ...answer }
}
