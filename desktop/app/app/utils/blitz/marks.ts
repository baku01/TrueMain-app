import type { PlayerGame, TimelineMark } from '~/types/record'
import type { RiotTimeline } from '~/utils/blitz/player'

/**
 * Each player's standing at the timeline's canonical marks — 5, 10, 15, 20
 * and 30 minutes — read from a match-v5 timeline (Blitz's `timeline`), by the
 * rule the shell reads the client's own timelines with (`crates/lcu/src/
 * marks.rs`): the frame nearest the mark, only within half a minute of it, of
 * two equally near the later one. A game over before a mark lacks it, never
 * gets a zeroed one. So a game read from Blitz carries the same marks — and
 * the same lane leads in the nerd statistics — as one read from the client.
 */

/** The canonical marks, in minutes — `MARK_MINUTES` in `marks.rs`. */
export const MARK_MINUTES = [5, 10, 15, 20, 30] as const

/** A mark is only read from a frame this close to it. */
const FRAME_TOLERANCE_MS = 30_000

type Frame = NonNullable<RiotTimeline['info']>['frames'][number]

/** The frame nearest `targetMs`, when one sits within the tolerance; frames come in ascending time. */
function frameNear(frames: readonly Frame[], targetMs: number): Frame | null {
  let best: Frame | null = null
  let bestDelta = Number.POSITIVE_INFINITY
  for (const frame of frames) {
    const delta = Math.abs(frame.timestamp - targetMs)
    if (delta > bestDelta) break
    bestDelta = delta
    best = frame
  }
  return best && bestDelta <= FRAME_TOLERANCE_MS ? best : null
}

/** Every player's marks, keyed by participant id, in ascending minutes. */
export function marksByParticipant(timeline: RiotTimeline | null | undefined): Map<number, TimelineMark[]> {
  const byParticipant = new Map<number, TimelineMark[]>()
  const frames = timeline?.info?.frames ?? []
  for (const minute of MARK_MINUTES) {
    const frame = frameNear(frames, minute * 60_000)
    if (!frame) continue
    for (const [key, player] of Object.entries(frame.participantFrames ?? {})) {
      const id = Number(key)
      if (!Number.isInteger(id)) continue
      const marks = byParticipant.get(id) ?? []
      marks.push({
        minute,
        gold: player.totalGold ?? 0,
        cs: (player.minionsKilled ?? 0) + (player.jungleMinionsKilled ?? 0),
        xp: player.xp ?? 0,
      })
      byParticipant.set(id, marks)
    }
  }
  return byParticipant
}

/** The game with every participant's marks filled in from its timeline; unchanged without one. */
export function withMarks(game: PlayerGame, timeline: RiotTimeline | null | undefined): PlayerGame {
  const marks = marksByParticipant(timeline)
  if (!marks.size) return game
  return {
    ...game,
    participants: game.participants.map(participant => ({ ...participant, marks: marks.get(participant.participantId) ?? participant.marks })),
  }
}
