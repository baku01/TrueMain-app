import type { PlayerGame } from '~/types/record'
import type { PlayedWith, PlayedWithSource } from '~/utils/sources/played-with'
import type { ProfilePlayer } from '~/utils/sources/rank-history'
import { readPlayedWith } from '~/utils/sources/played-with'

/**
 * Who the profiled player recently played with (`readPlayedWith`), read again
 * when the player changes or more of their games load — the games on screen
 * are TrueMain's answer for the player's own profile, and everyone's last resort.
 */
export function usePlayedWith(player: Ref<ProfilePlayer | null>, own: Ref<boolean>, games: Ref<readonly PlayerGame[]>, gamesSource: Ref<PlayedWithSource>) {
  const playedWith = shallowRef<PlayedWith | null>(null)
  let read = 0

  watch(() => (player.value ? `${player.value.riotId}|${player.value.region}|${own.value}|${games.value.length}` : ''), async (key, previous) => {
    const mine = ++read
    const current = player.value
    if (key.split('|').slice(0, 2).join('|') !== previous?.split('|').slice(0, 2).join('|')) playedWith.value = null
    if (!current) return
    const answer = await readPlayedWith(current, { own: own.value, games: games.value, gamesSource: gamesSource.value })
    if (mine === read) playedWith.value = answer
  }, { immediate: true })

  return { playedWith }
}
