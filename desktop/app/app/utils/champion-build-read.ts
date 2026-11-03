import type { ChampionBuildResponse } from '~/types/build'
import { activeProvider } from '~/utils/sources'

/**
 * A champion's builds on one lane, from the source Settings picked
 * (`data-source.ts`): TrueMain's champion endpoint — through the shell's
 * `champion_build` inside Tauri, the dev proxy otherwise — or the other
 * source's (`utils/sources`).
 */
export async function readChampionBuild(
  championId: number,
  position: string,
  options: { opponentChampionId?: number | null, signal?: AbortSignal } = {},
): Promise<ChampionBuildResponse> {
  const opponentChampionId = options.opponentChampionId ?? null
  const provider = activeProvider()
  if (provider) return await provider.builds(championId, position, opponentChampionId)
  if (insideTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<ChampionBuildResponse>('champion_build', { championId, position, opponentChampionId })
  }
  return await $fetch<ChampionBuildResponse>(`/api/champions/${championId}`, { query: { position }, signal: options.signal })
}
