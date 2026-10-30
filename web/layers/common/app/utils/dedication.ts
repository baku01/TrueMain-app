import { tr } from '#common/utils/i18n'
import type { TruemainDedication, TruemainScorePartKey } from '#shared/types/dedication'
import { formatCompactCount } from '#shared/utils/counts'
import { formatPercentage } from '#shared/utils/ddragon'

// Presentation helpers for the Truemain score (the `dedication` payload,
// #1701). Formatting only — the score and every part are computed by the
// backend (backend/Core/Truemains/DedicationScore.cs) and shipped in the
// payload, so nothing here derives a number the API didn't send. See
// docs/dedication-score.md.

/** The metric's name wherever a reader sees it. */
export const truemainScoreLabel = () => tr('dedication.scoreLabel')

/** One part of the score, ready to render: the fact behind it and what it added. */
export interface TruemainScorePartView {
  key: TruemainScorePartKey
  label: string
  /** The raw fact, phrased for a human. */
  detail: string
  /** Contribution in whole score points; the parts add up to the displayed score. */
  points: number
  /** The most this part can contribute, in whole score points. */
  maxPoints: number
}

/**
 * The score as displayed: a whole number, everywhere. The parts are shown in
 * whole points too and must add up to it in front of the reader, which a
 * decimal on the total alone would break.
 */
export function formatDedicationScore(score: number): string {
  return Math.round(score).toString()
}

/**
 * The verdict, in one word. Read straight off `isOtp` — the flag the OTP badge
 * and the `otpOnly` filter use — so the three can never disagree. Every scored
 * champion is a main, so the only other answer is "Main".
 */
export function dedicationVerdict(dedication: TruemainDedication): 'OTP' | 'Main' {
  return dedication.isOtp ? 'OTP' : 'Main'
}

/** Days-since-last-played phrased for a human; null when mastery has not been read yet. */
export function formatDedicationLastPlayed(days: number | null): string | null {
  if (days === null) return null
  if (days <= 0) return tr('dedication.lastToday')
  if (days === 1) return tr('dedication.lastYesterday')
  return tr('dedication.lastDays', { days })
}

const notChecked = () => tr('dedication.notChecked')

function masteryPointsDetail(points: number | null): string {
  if (points === null) return notChecked()
  if (points === 0) return tr('dedication.noMastery')
  return tr('dedication.points', { points: formatCompactCount(points) })
}

function masteryRankDetail(dedication: TruemainDedication): string {
  if (dedication.masteryPoints === null) return notChecked()
  if (dedication.masteryRank === null) return tr('dedication.noMastery')
  if (dedication.masteryRank === 1) return tr('dedication.mostPlayed')
  return tr('dedication.masteryRankDetail', { rank: dedication.masteryRank })
}

function partDetail(key: TruemainScorePartKey, dedication: TruemainDedication): string {
  switch (key) {
    case 'playRate':
      return tr('dedication.playRateDetail', { rate: formatPercentage(dedication.playRate, 0), games: dedication.recentGames })
    case 'mastery':
      return masteryPointsDetail(dedication.masteryPoints)
    case 'masteryRank':
      return masteryRankDetail(dedication)
  }
}

const PART_LABELS: Record<TruemainScorePartKey, string> = {
  playRate: 'dedication.part.playRate',
  mastery: 'dedication.part.mastery',
  masteryRank: 'dedication.part.masteryRank',
}

/**
 * Whole-point contributions that add up exactly to the rounded score
 * (largest-remainder rounding). Rounding each part on its own could print
 * 28 + 18 + 15 under a total of 62.
 */
function wholePoints(points: number[], total: number): number[] {
  const floors = points.map(Math.floor)
  let missing = total - floors.reduce((sum, value) => sum + value, 0)
  const byRemainder = points
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder)

  for (const { index } of byRemainder) {
    if (missing <= 0) break
    floors[index]! += 1
    missing -= 1
  }
  return floors
}

/** The parts with their facts, in payload order (heaviest first). */
export function dedicationParts(dedication: TruemainDedication): TruemainScorePartView[] {
  const points = wholePoints(
    dedication.parts.map(part => part.points),
    Math.round(dedication.score),
  )

  return dedication.parts.map((part, index) => ({
    key: part.key,
    label: tr(PART_LABELS[part.key]),
    detail: partDetail(part.key, dedication),
    points: points[index]!,
    maxPoints: Math.round(part.maxPoints),
  }))
}
