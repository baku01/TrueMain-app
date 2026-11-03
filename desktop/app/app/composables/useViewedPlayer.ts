import type { RankHistoryEntry } from '#shared/types/rank-history'
import type { PlayerGame, PlayerRecord } from '~/types/record'
import type { PlayerAccount } from '~/utils/blitz/player'
import { homeRegionOf, platformOf, readPlayerAccount, splitRiotId } from '~/utils/blitz/player'
import { profileMatchIds, rankedOf, readProfileGames } from '~/utils/blitz/profile'
import { readOpggProfile } from '~/utils/sources/opgg-profile'

const PAGE = 10

/**
 * Another player on the dashboard — clicked in a game, or found by the
 * search: their account and ranks, then their games ten at a time, read from
 * Blitz, and their LP over recent weeks from op.gg. The same shape the
 * player's own record has (`usePlayerRecord`), so the dashboard draws either.
 * Without a region the one their games are played on is found.
 */
export function useViewedPlayer(target: Ref<{ riotId: string, region: string | null } | null>) {
  const account = shallowRef<PlayerAccount | null>(null)
  const region = ref<string | null>(null)
  const record = shallowRef<PlayerRecord | null>(null)
  const games = shallowRef<PlayerGame[]>([])
  const rankHistory = shallowRef<RankHistoryEntry[]>([])
  const status = ref<'idle' | 'pending' | 'ready' | 'error' | 'missing'>('idle')
  const loadingOlder = ref(false)
  let ids: string[] = []
  /** The next match id to read: a match without the player is skipped, so it runs ahead of the games held. */
  const next = ref(0)
  let read = 0

  async function load() {
    const current = target.value
    const parts = current ? splitRiotId(current.riotId) : null
    account.value = null
    record.value = null
    games.value = []
    rankHistory.value = []
    ids = []
    next.value = 0
    if (!current || !parts) {
      status.value = current ? 'missing' : 'idle'
      return
    }
    const mine = ++read
    status.value = 'pending'
    try {
      const home = current.region ?? await homeRegionOf(parts.gameName, parts.tagLine) ?? 'br'
      const found = await trackLoad(readPlayerAccount(home, parts.gameName, parts.tagLine))
      if (mine !== read) return
      if (!found) {
        status.value = 'missing'
        return
      }
      region.value = home
      account.value = found
      ids = await profileMatchIds(home, parts.gameName, parts.tagLine)
      const first = await trackLoad(readProfileGames(ids, found.puuid, 0, PAGE))
      next.value = PAGE
      if (mine !== read) return
      games.value = first
      record.value = { platformId: platformOf(home), ranked: rankedOf(found), backgroundSkinId: null, games: first }
      status.value = 'ready'
      // The LP curve is op.gg's; the profile stands without it.
      readOpggProfile(home, parts.gameName, parts.tagLine)
        .then((profile) => {
          if (mine === read) rankHistory.value = profile?.lpHistory ?? []
        })
        .catch(() => {})
    }
    catch {
      if (mine === read) status.value = 'error'
    }
  }

  const hasOlder = computed(() => games.value.length > 0 && next.value < ids.length)

  async function loadOlder() {
    const found = account.value
    if (!found || loadingOlder.value || !hasOlder.value) return
    loadingOlder.value = true
    try {
      const more = await readProfileGames(ids, found.puuid, next.value, PAGE)
      next.value += PAGE
      games.value = [...games.value, ...more]
    }
    finally {
      loadingOlder.value = false
    }
  }

  watch(() => (target.value ? `${target.value.riotId}|${target.value.region ?? ''}` : ''), () => void load(), { immediate: true })

  return { account, region, record, games, rankHistory, status, hasOlder, loadingOlder, loadOlder, refresh: load }
}
