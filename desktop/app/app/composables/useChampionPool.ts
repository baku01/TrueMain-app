import type { DataSource } from '~/utils/data-source'
import type { PoolRole } from '~/utils/champion-pool'
import type { QueueFilter } from '~/utils/player-form'
import type { ProfilePlayer } from '~/utils/sources/rank-history'
import { poolRoles } from '~/utils/champion-pool'
import { readChampionPool } from '~/utils/sources/champion-pool'

/**
 * The profiled player's season champion pool in the queue filter shown, lane
 * by lane (`readChampionPool`), read once the tab opens (`enabled`): a whole
 * season of rows is no read to make for a profile only glanced at.
 */
export function useChampionPool(player: Ref<ProfilePlayer | null>, filter: Ref<QueueFilter>, enabled: Ref<boolean>) {
  const pool = shallowRef<{ source: DataSource, roles: PoolRole[] } | null>(null)
  const status = ref<'idle' | 'pending' | 'ready'>('idle')
  let read = 0

  watch(() => (enabled.value && player.value ? `${player.value.riotId}|${player.value.region}|${filter.value}` : ''), async (key) => {
    const mine = ++read
    const current = player.value
    if (!key || !current) return
    status.value = 'pending'
    const answer = await readChampionPool(current, filter.value)
    if (mine !== read) return
    pool.value = answer ? { source: answer.source, roles: poolRoles(answer.rows) } : null
    status.value = 'ready'
  }, { immediate: true })

  return { pool, status }
}
