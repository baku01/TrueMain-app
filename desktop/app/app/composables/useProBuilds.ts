import type { ChampionBuildResponse } from '~/types/build'
import { LANES } from '~/utils/site-build'

/**
 * ProBuild's data: what truemain.lol measured for a champion on each lane
 * (the champion page's endpoint, through the shell's `champion_build`), the
 * five lanes read together so the page opens on the one most played. Kept for
 * the session, as the draft's builds are (`useChampionBuilds`).
 */
export function useProBuilds() {
  const cache = useState<Record<number, Record<string, ChampionBuildResponse>>>('pro-builds', () => ({}))

  async function readLane(championId: number, position: string): Promise<ChampionBuildResponse | null> {
    try {
      if (insideTauri()) {
        const { invoke } = await import('@tauri-apps/api/core')
        return await invoke<ChampionBuildResponse>('champion_build', { championId, position, opponentChampionId: null })
      }
      return await $fetch<ChampionBuildResponse>(`/api/champions/${championId}`, { query: { position } })
    }
    catch {
      return null
    }
  }

  /** The champion's lanes by name; a lane the site has no games for is absent. */
  async function lanes(championId: number): Promise<Record<string, ChampionBuildResponse>> {
    const known = cache.value[championId]
    if (known) return known
    const answers = await trackLoad(Promise.all(LANES.map(async lane => [lane, await readLane(championId, lane)] as const)))
    const read = Object.fromEntries(answers.filter((entry): entry is [typeof LANES[number], ChampionBuildResponse] => entry[1] !== null))
    // Every lane failing is a read that failed, not a champion nobody plays: not kept, so the next pick asks again.
    if (Object.keys(read).length > 0) cache.value = { ...cache.value, [championId]: read }
    return read
  }

  return { lanes }
}
