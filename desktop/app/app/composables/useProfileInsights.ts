import type { DetailedStats } from '~/utils/player-stats'
import type { OpggProfile } from '~/utils/sources/opgg-profile'
import type { QueueFilter } from '~/utils/player-form'
import type { MatchAnswer } from '~/utils/blitz/player'
import { readMatch, readPlayerAccount, readPlayerMatchIds, splitRiotId } from '~/utils/blitz/player'
import { detailedStats } from '~/utils/player-stats'
import { readOpggProfile } from '~/utils/sources/opgg-profile'

/** How many of the player's latest games, in the chosen queue, the detail reads. */
const SAMPLE = 20
/** Matches looked through to find them: a queue the player rarely plays has few among the latest. */
const SCAN = 60

const QUEUES: Record<QueueFilter, number[] | null> = {
  all: null,
  solo: [420],
  flex: [440],
  normal: [400, 430, 490],
  aram: [450],
}

/**
 * The profile's detail beyond the history — for the player's own profile and
 * for any other: their play in detail over their latest games in the queue
 * shown (`detailedStats`, from Riot's match data on Blitz), and what op.gg
 * knows of them — their place on the ladder, past seasons, this season's
 * peak. Each part stands alone: one that fails to read leaves the other.
 */
export function useProfileInsights(player: Ref<{ riotId: string, region: string } | null>, queue: Ref<QueueFilter>) {
  const stats = shallowRef<DetailedStats | null>(null)
  const opgg = shallowRef<OpggProfile | null>(null)
  const loading = ref(false)
  let read = 0

  async function load() {
    const current = player.value
    const parts = current ? splitRiotId(current.riotId) : null
    const mine = ++read
    stats.value = null
    if (!current || !parts) {
      opgg.value = null
      return
    }
    loading.value = true
    try {
      const account = await readPlayerAccount(current.region, parts.gameName, parts.tagLine)
      if (!account || mine !== read) return
      const ids = (await readPlayerMatchIds(current.region, parts.gameName, parts.tagLine)).slice(0, SCAN)
      const wanted = QUEUES[queue.value]
      const answers: MatchAnswer[] = []
      for (let start = 0; start < ids.length && answers.length < SAMPLE; start += 5) {
        const batch = await Promise.all(ids.slice(start, start + 5).map(id => readMatch(id).catch(() => null)))
        for (const answer of batch) {
          if (answer?.info && (!wanted || wanted.includes(answer.info.queueId)) && answers.length < SAMPLE) answers.push(answer)
        }
      }
      if (mine === read) stats.value = detailedStats(answers, account.puuid)
    }
    catch {
      // No detail: the card says so.
    }
    finally {
      if (mine === read) loading.value = false
    }
  }

  watch(() => (player.value ? `${player.value.riotId}|${player.value.region}|${queue.value}` : ''), () => void load(), { immediate: true })
  watch(() => (player.value ? `${player.value.riotId}|${player.value.region}` : ''), async () => {
    opgg.value = null
    const current = player.value
    const parts = current ? splitRiotId(current.riotId) : null
    if (!current || !parts) return
    opgg.value = await readOpggProfile(current.region, parts.gameName, parts.tagLine).catch(() => null)
  }, { immediate: true })

  return { stats, opgg, loading }
}
