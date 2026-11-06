import type { DataSource } from '~/utils/data-source'
import type { FormBenchmarkResponse } from '~/utils/form-benchmark'
import type { PostMatchBenchmark } from '~/utils/post-match'

/**
 * The post-match yardstick's sources, read into one shape (`PostMatchBenchmark`):
 * which source is asked in which order, and how each one's answer is read.
 * The reads themselves are `readPostMatchBenchmark`'s (`usePostMatch`), which
 * says which sources carry the figures at all.
 */

/** A source that carries the yardstick. */
export type BenchmarkSource = 'truemain' | 'blitz'

/**
 * The sources asked, in turn, with `picked` chosen in Settings: the picked one
 * first when it carries the figures, then the others that do. TrueMain is
 * asked only when it is the one picked: with another source the shell refuses
 * every request to it (`api.rs`, `NotFromSourceError`), a rule this read does
 * not get around. op.gg, lolalytics and Tencent carry none (see
 * `readPostMatchBenchmark`), so with them Blitz answers.
 */
export function benchmarkOrder(picked: DataSource): BenchmarkSource[] {
  return picked === 'truemain' ? ['truemain', 'blitz'] : ['blitz']
}

/**
 * The first answer of `order`'s readers: a reader that fails or has nothing
 * hands over to the next. Null when none answered — the caller's last resort
 * is the player's own games (`ownAverage`).
 */
export async function firstBenchmark(
  order: BenchmarkSource[],
  readers: Record<BenchmarkSource, () => Promise<PostMatchBenchmark | null>>,
): Promise<PostMatchBenchmark | null> {
  for (const source of order) {
    const answer = await readers[source]().catch(() => null)
    if (answer && (answer.csPerMinute !== null || answer.visionPerMinute !== null)) return answer
  }
  return null
}

/** TrueMain's form benchmark (`/benchmarks/form`, #2076) at `tier`: the tier's medians on the lane. */
export function fromTruemainForm(answer: FormBenchmarkResponse, tier: string): PostMatchBenchmark | null {
  const row = answer.tiers.find(entry => entry.tier === tier.toUpperCase())
  if (!row) return null
  return {
    origin: 'truemain',
    tier: row.tier,
    samples: row.samples,
    csPerMinute: row.csPerMinute?.median ?? null,
    visionPerMinute: row.visionPerMinute?.median ?? null,
    deaths: row.deaths?.median ?? null,
  }
}

interface BlitzStat {
  mean?: number
}

/** A row of Blitz's `champion_by_game_duration_stats`: a champion's games on a lane and tier, by length in minutes. */
export interface BlitzDurationRow {
  tier?: string
  stats_by_game_duration?: Record<string, { num_games?: number, stats?: Record<string, BlitzStat> }>
}

/** A row of Blitz's `champion_by_minute_stats`: the same games' running figures at each minute. */
export interface BlitzMinuteRow {
  stats_by_minute?: Record<string, Record<string, BlitzStat>>
}

/** The entry of `table` filed at the largest minute at or under `minutes`, and that minute — how Blitz's own post-match picks one. */
function atMinute<T>(table: Record<string, T> | undefined, minutes: number): [number, T] | null {
  let best: [number, T] | null = null
  for (const [key, value] of Object.entries(table ?? {})) {
    const minute = Number(key)
    if (Number.isFinite(minute) && minute <= minutes && (!best || minute > best[0])) best = [minute, value]
  }
  return best
}

/**
 * Blitz's figures for a game of `durationSeconds`: the vision and the deaths
 * of the champion's games that long, and the farm at the game's last minute —
 * lane and jungle together, as the client counts a player's CS; the
 * by-length table counts lane minions alone, which would sink a jungler.
 */
export function fromBlitzRows(
  durationRows: BlitzDurationRow[],
  minuteRows: BlitzMinuteRow[],
  durationSeconds: number,
  tier: string,
): PostMatchBenchmark | null {
  const minutes = Math.round(durationSeconds / 60) || 1
  const games = atMinute(durationRows[0]?.stats_by_game_duration, minutes)?.[1] ?? null
  const stats = games?.stats ?? {}
  // The bucket's own length when it says, so a rate is per minute played.
  const time = stats.time_played?.mean
  const played = time && time > 0 ? time / 60 : minutes
  const vision = stats.vision_score?.mean
  const at = atMinute(minuteRows[0]?.stats_by_minute, Math.floor(durationSeconds / 60))
  const lane = at?.[1].creep_score?.mean
  const csPerMinute = at && at[0] > 0 && lane !== undefined ? (lane + (at[1].jungle_creep_score?.mean ?? 0)) / at[0] : null
  const visionPerMinute = vision !== undefined ? vision / played : null
  if (csPerMinute === null && visionPerMinute === null) return null
  return {
    origin: 'blitz',
    tier: durationRows[0]?.tier ?? tier,
    samples: games?.num_games ?? null,
    csPerMinute,
    visionPerMinute,
    deaths: stats.deaths?.mean ?? null,
  }
}
