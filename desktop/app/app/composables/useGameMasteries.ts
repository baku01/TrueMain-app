import type { LoadingPlayer } from '~/types/loading'
import { readChampionMastery, regionOfPlatform, splitRiotId } from '~/utils/blitz/player'
import { keepBounded } from '~/utils/bounded'

/** Each player's mastery list, read once a session per Riot ID. */
const reads = new Map<string, Promise<Map<number, number>>>()

function masteryOf(region: string, riotId: string): Promise<Map<number, number>> {
  const key = `${region}:${riotId.toLowerCase()}`
  let read = reads.get(key)
  if (!read) {
    const id = splitRiotId(riotId)
    read = id
      ? readChampionMastery(region, id.gameName, id.tagLine).then(list => new Map(list.map(entry => [entry.championId, entry.championLevel])))
      : Promise.resolve(new Map())
    read = read.catch(() => new Map())
    keepBounded(reads, key, read)
  }
  return read
}

/**
 * The mastery level each player of the game holds on the champion they are
 * on, as Blitz keeps it (`riot_account_v2`), the way Blitz's own game page
 * shows it on each card. Keyed by Riot ID; a player not read yet, anonymous,
 * or without mastery on the champion is not in it.
 */
export function useGameMasteries(lines: () => LoadingPlayer[], platformId: () => string) {
  const levels = ref(new Map<string, number>())
  watch(() => [platformId(), lines().map(line => `${line.riotId}:${line.championId}`).join()] as const, async ([platform]) => {
    const region = platform ? regionOfPlatform(platform) : null
    if (!region) return
    const named = lines().filter(line => line.riotId && !line.anonymous)
    const read = await Promise.all(named.map(async line => [line.riotId, (await masteryOf(region, line.riotId)).get(line.championId)] as const))
    levels.value = new Map(read.filter((entry): entry is readonly [string, number] => entry[1] !== undefined))
  }, { immediate: true })
  return levels
}
