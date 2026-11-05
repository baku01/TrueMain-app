import type { MatchDetailResponse } from '#shared/types/match-detail'
import type { ChampionStaticListItem } from '#shared/types/static-data'
import type { WinProbabilityTimeline } from '#shared/types/win-probability'
import { gradeDetail } from '~/utils/match-summary'
import { matchEvents } from '~/utils/blitz/player'
import { blitzMatchDetail, withRanks } from '~/utils/blitz/match-detail'
import { externalSource } from '~/utils/data-source'

/**
 * The app's side of the composables the twinned site components call, so the
 * components themselves stay verbatim copies. Each answers the same question
 * the site's does, for an app with no image server and no player pages.
 */

/**
 * The site's `useChampionSlugs`, answered with the app's routes: a champion
 * opens its builds page here. The app has no player-scoped champion page, so a
 * true main's champion opens the champion's own page.
 */
export function useChampionSlugs() {
  const pathFor = (championId: number) => `/champions/${championId}`
  return {
    pathFor,
    truemainPathFor: (_nameTag: string, championId: number) => pathFor(championId),
  }
}

/** The site routes icons through its image server; the app uses them as given. */
export function useCanonicalIcon() {
  return (src: string | null | undefined) => src ?? undefined
}

/** The site's loading-screen art goes through its image server too; the app's is the CDN's. */
export function useCanonicalLoadingArt() {
  return (src: string | null | undefined): string | null => src ?? null
}

/**
 * Every champion as the site's static list item, keyed by id — the site's
 * `useChampionsById` over the static list, read from Data Dragon at once.
 */
export function useStaticChampionsById() {
  const { champions, portraitOf } = useChampionStatics()
  return computed(() => new Map<number, ChampionStaticListItem>(
    [...champions.value.values()].map(champion => [champion.id, {
      championId: champion.id,
      name: champion.name,
      iconUrl: portraitOf(champion.id) ?? '',
    }]),
  ))
}

/** TrueMain's copies already read: an ingested game never changes. */
const matchDetails = new Map<string, MatchDetailResponse>()

async function readTruemainDetail(nameTag: string, platformId: string | null, matchId: string): Promise<MatchDetailResponse | null> {
  if (!nameTag || !platformId) return null
  try {
    // In the background: an opened row shows its own skeleton, and the window's
    // loading bar is for a page's load, not for a panel opening in place.
    return await apiGet<MatchDetailResponse>(
      `/truemains/${encodeURIComponent(nameTag)}/matches/${platformId}_${matchId}`,
      {},
      { background: true },
    )
  }
  catch {
    return null
  }
}

/**
 * A game the client read has no purchases and no skill points — its timeline
 * lists neither — so they are read from the game's timeline on Blitz
 * (`matchEvents`, no Riot key) and put on each participant. Nothing changes
 * when Blitz has no timeline for the game: the panel then says there is no
 * build data.
 */
async function withRiotEvents(detail: MatchDetailResponse, platformId: string | null, matchId: string): Promise<MatchDetailResponse> {
  const missing = detail.participants.some(participant => !participant.itemEvents?.length && !participant.skillEvents?.length)
  if (!missing || !platformId) return detail
  try {
    const events = await matchEvents(platformId, matchId)
    const byParticipant = new Map(events.map(entry => [entry.participantId, entry]))
    return {
      ...detail,
      participants: detail.participants.map((participant) => {
        const found = byParticipant.get(participant.participantId)
        return found ? { ...participant, itemEvents: found.itemEvents, skillEvents: found.skillEvents } : participant
      }),
    }
  }
  catch (error) {
    // A game Blitz does not keep, or Blitz unreachable: the build stays empty.
    console.warn('match events failed', error)
    return detail
  }
}

async function readClientDetail(matchId: string): Promise<MatchDetailResponse | null> {
  if (insideTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return gradeDetail(await invoke<MatchDetailResponse>('player_game', { gameId: Number(matchId) }))
  }
  if (import.meta.dev) {
    const fixtures = await import('~/fixtures/match-details.json')
    const detail = (fixtures.default as unknown as Record<string, MatchDetailResponse>)[matchId]
    if (!detail) return null
    // The shared model's fixture game stands in for every game's timeline, so the curve shows in dev.
    const { default: winProbability } = await import('#shared/fixtures/win-probability-timeline.json')
    return gradeDetail({ ...detail, winProbabilityTimeline: winProbability.timeline as WinProbabilityTimeline })
  }
  return null
}

/**
 * One of the player's own games in the site's match-detail shape — the
 * dashboard's counterpart of the site's `useMatchDetail`. TrueMain's copy of the
 * game comes first: it alone has the build and skill orders, since the
 * client's timeline carries no purchases and no skill points. A game TrueMain
 * has not ingested falls back to the client's read (`player_game`): the
 * scoreboard, the roles and the lane at fifteen, without those two, its ten
 * players graded by the site's model (`gradeDetail`, #2075). In
 * `npm run dev` the dev fixtures stand in for the client.
 *
 * The win-probability curve (#1911) is always built from the client's timeline
 * (`winProbabilityTimeline`): TrueMain stores none (#2009), so its copy borrows
 * the client's once the panel is shown, and the Timeline tab appears whenever
 * the game allows it.
 */
/** Whether a game's detail lacks something another source may have. */
function gapsOf(detail: MatchDetailResponse): boolean {
  return !detail.winProbabilityTimeline?.events.length
    || !detail.teams?.length
    || !detail.participants.some(p => p.runes.some(rune => rune.vars))
}

/** `detail` with what it lacks taken from `extra`, the same game read elsewhere; what it has is kept. */
export function fillGaps(detail: MatchDetailResponse, extra: MatchDetailResponse): MatchDetailResponse {
  const fromExtra = new Map(extra.participants.map(p => [p.participantId, p]))
  return {
    ...detail,
    winProbabilityTimeline: detail.winProbabilityTimeline?.events.length ? detail.winProbabilityTimeline : extra.winProbabilityTimeline ?? detail.winProbabilityTimeline,
    teams: detail.teams?.length ? detail.teams : extra.teams,
    participants: detail.participants.map((p) => {
      const other = fromExtra.get(p.participantId)
      if (!other) return p
      return {
        ...p,
        runes: p.runes.some(rune => rune.vars) || !other.runes.some(rune => rune.vars) ? p.runes : other.runes,
        rank: p.rank ?? other.rank,
      }
    }),
  }
}

export function usePlayerGameDetail(nameTag: MaybeRefOrGetter<string>, matchId: MaybeRefOrGetter<string>) {
  const { record } = usePlayerRecord()
  const data = ref<MatchDetailResponse | null>(null)
  const isLoading = ref(true)
  const notFound = ref(false)

  watch(() => toValue(matchId), async (id) => {
    isLoading.value = true
    try {
      const known = matchDetails.get(id)
      // TrueMain's copy only where TrueMain is the source Settings picked.
      const truemain = known ?? (externalSource() ? null : await readTruemainDetail(toValue(nameTag), record.value?.platformId ?? null, id))
      if (truemain) matchDetails.set(id, truemain)
      // The client's fallback is cached by the shell; TrueMain is asked again
      // next time, since it may have ingested the game since.
      const read = truemain ?? await readClientDetail(id)
      data.value = read ? await withRiotEvents(read, record.value?.platformId ?? null, id) : null
    }
    catch {
      data.value = null
    }
    notFound.value = !data.value
    isLoading.value = false
    // What the source read lacks — the curve and the timeline's events, the
    // teams' bans and objectives, the runes' stats (TrueMain's API keeps none),
    // and a player's rank where the other copy has it — is filled from the others, whichever Settings picked:
    // the client's copy first, then Blitz's (Riot's match-v5 and timeline).
    const platformId = record.value?.platformId ?? null
    for (const other of [() => (insideTauri() ? readClientDetail(id) : null), () => (platformId ? blitzMatchDetail(`${platformId}_${id}`) : null)]) {
      if (!data.value || !gapsOf(data.value)) break
      const extra = await Promise.resolve(other()).catch(() => null)
      if (extra && toValue(matchId) === id && data.value) data.value = fillGaps(data.value, extra)
    }
    if (data.value && platformId) {
      const ranked = await withRanks(data.value, platformId).catch(() => null)
      if (ranked && toValue(matchId) === id) data.value = ranked
    }
  }, { immediate: true })

  return { data, isLoading, notFound }
}
