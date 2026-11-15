import type { ChampionBuildResponse } from '~/types/build'
import { activeProvider } from '~/utils/sources'

/** A champion's builds on one lane: the sources' (`utils/sources`, the most complete that has them). */
export async function readChampionBuild(
  championId: number,
  position: string,
  options: { opponentChampionId?: number | null, signal?: AbortSignal } = {},
): Promise<ChampionBuildResponse> {
  const opponentChampionId = options.opponentChampionId ?? null
  return await activeProvider().builds(championId, position, opponentChampionId)
}
