import type { Ref } from 'vue'
import type { MatchDetailResponse } from '#shared/types/match-detail'
import type { PlayerGame } from '~/types/record'
import type { FormBenchmarkResponse } from '~/utils/form-benchmark'
import type { PostMatchBenchmark } from '~/utils/post-match'
import type { BlitzDurationRow, BlitzMinuteRow } from '~/utils/post-match-benchmark'
import { SOLO_QUEUE, blitzGet, blitzRole } from '~/utils/blitz/client'
import { dataSource } from '~/utils/data-source'
import { deathTimes, ownAverage, postMatchInsights } from '~/utils/post-match'
import { benchmarkOrder, firstBenchmark, fromBlitzRows, fromTruemainForm } from '~/utils/post-match-benchmark'

/** The game a yardstick is read for. */
export interface BenchmarkSubject {
  championId: number
  /** `TOP` … `UTILITY`; null where the game had no lanes. */
  position: string | null
  /** The player's tier as the client spells it (`EMERALD`); null while unranked. */
  tier: string | null
  durationSeconds: number
}

/**
 * The post-match yardstick for a game: the CS and vision per minute — and
 * the deaths — of the player's tier on the game's lane.
 *
 * Which sources carry it, each probed (November 2026):
 * - TrueMain — yes. `/benchmarks/form?position=` serves every tier's
 *   quartiles of CS/min, vision/min and deaths on a lane, over the last
 *   three patches (#2076); the median is read. Lane-wide, not per champion.
 * - Blitz — yes. `champion_by_game_duration_stats` (vision score and deaths,
 *   by game length) and `champion_by_minute_stats` (lane and jungle CS, by
 *   minute), per champion, lane and tier; the mean is read.
 * - op.gg (its MCP API) — no. `lol_get_champion_analysis` averages KDA and
 *   the win, pick and ban rates only.
 * - lolalytics — no. A champion's minions and deaths per game at a tier, but
 *   no game length to make a rate of them, and no vision.
 * - Tencent — no. Minions and play time per champion and lane, but no tier
 *   and no vision.
 *
 * The picked source answers when it carries the figures; otherwise Blitz
 * does, whatever the pick (`benchmarkOrder`), and a source that fails or has
 * nothing hands over to the next. Null when none answered, or the game has
 * no lane or the player no tier: the caller then sets the game against the
 * player's own recent games (`ownAverage`).
 */
export async function readPostMatchBenchmark(subject: BenchmarkSubject): Promise<PostMatchBenchmark | null> {
  const { position, tier } = subject
  if (!position || !tier) return null
  const upper = tier.toUpperCase()
  return firstBenchmark(benchmarkOrder(dataSource.value), {
    truemain: async () => fromTruemainForm(await apiGet<FormBenchmarkResponse>('/benchmarks/form', { position }, { background: true }), upper),
    blitz: async () => {
      const query = { champion_id: subject.championId, queue_id: SOLO_QUEUE, tier: upper, individual_position: blitzRole(position) }
      const [byLength, byMinute] = await Promise.all([
        blitzGet<{ data?: BlitzDurationRow[] }>('data', 'champion_by_game_duration_stats', query),
        // The farm alone is lost without it; the vision and the deaths still stand.
        blitzGet<{ data?: BlitzMinuteRow[] }>('data', 'champion_by_minute_stats', query).catch(() => ({ data: [] as BlitzMinuteRow[] })),
      ])
      return fromBlitzRows(byLength.data ?? [], byMinute.data ?? [], subject.durationSeconds, upper)
    },
  })
}

/** A tier the yardstick can be read at: none while unranked (`NONE`, empty). */
function rankedTier(tier: string | null | undefined): string | null {
  return tier && tier !== 'NONE' ? tier : null
}

/**
 * The post-match of `game`: the yardstick (`readPostMatchBenchmark`, else
 * the player's own games), read once per game, and the insights set against
 * it, the death times taken from the game's detail once it is read.
 */
export function usePostMatch(
  game: Ref<PlayerGame>,
  games: Ref<PlayerGame[]>,
  tier: Ref<string | null>,
  detail: Ref<MatchDetailResponse | null | undefined>,
) {
  const benchmark = ref<PostMatchBenchmark | null>(null)
  const pending = ref(true)
  let asked = 0

  watch(() => `${game.value.gameId}:${tier.value}`, async () => {
    const turn = ++asked
    pending.value = true
    const subject = { championId: game.value.championId, position: game.value.position, tier: rankedTier(tier.value), durationSeconds: game.value.durationSeconds }
    const read = await readPostMatchBenchmark(subject).catch(() => null)
    if (turn !== asked) return
    benchmark.value = read ?? ownAverage(games.value, game.value)
    pending.value = false
  }, { immediate: true })

  const insights = computed(() => postMatchInsights(game.value, benchmark.value, deathTimes(detail.value, game.value.participantId)))

  return { benchmark, pending, insights }
}
