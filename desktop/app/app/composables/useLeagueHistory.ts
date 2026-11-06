import type { LeagueSnapshot, RankedQueueType } from '~/utils/league-history'
import type { LeagueHistory, ProfilePlayer } from '~/utils/sources/rank-history'
import { readLeagueHistory } from '~/utils/sources/rank-history'

/**
 * The profiled player's LP over time in the queue chosen, for the ranked card
 * and the LP history tab (`readLeagueHistory`): from a source, else — for the
 * player's own Solo/Duo — the snapshots this machine kept (`local`). Read
 * again when the player, the queue or the kept snapshots change.
 */
export function useLeagueHistory(player: Ref<ProfilePlayer | null>, queue: Ref<RankedQueueType>, local: Ref<readonly LeagueSnapshot[]>) {
  const history = shallowRef<LeagueHistory | null>(null)
  const loading = ref(false)
  let read = 0

  watch(() => (player.value ? `${player.value.riotId}|${player.value.region}|${queue.value}|${local.value.length}` : ''), async (key, previous) => {
    const mine = ++read
    const current = player.value
    // Another player or queue: the old curve goes; the same one with a snapshot more keeps it while it is read.
    if (key.split('|').slice(0, 3).join('|') !== previous?.split('|').slice(0, 3).join('|')) history.value = null
    if (!current) return
    loading.value = !history.value
    const answer = await readLeagueHistory(current, queue.value, { local: local.value })
    if (mine !== read) return
    history.value = answer
    loading.value = false
  }, { immediate: true })

  return { history, loading }
}
