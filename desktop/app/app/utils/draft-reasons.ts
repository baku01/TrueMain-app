import type { DraftReason } from '~/types/draft'
import { formatCount } from '#shared/utils/counts'
import { formatPercentage } from '#shared/utils/ddragon'
import { formatPointDelta } from '#shared/utils/deltas'
import { tr } from '#common/utils/i18n'
import { positionLabel } from '#common/utils/positions'

/**
 * How a draft suggestion's reasons read (#1906). The endpoint returns them as
 * data — kind, champion, delta, games — and this is the one place that turns
 * them into words, so every number on a card is a field of the answer and
 * none is computed here.
 */
export interface ReasonText {
  /** The figure the card leads with: a signed delta, or a rate… */
  headline: string
  /** …and its unit, drawn smaller: `pts` or `%`. */
  unit: string
  /** One short line under the champion. */
  short: string
  /** The whole fact, for the hover. */
  full: string
  tone: 'good' | 'bad' | 'neutral'
}

/** Win-rate points, signed: `+3.1 pts`. */
export function draftPoints(delta: number): string {
  return formatPointDelta(delta)
}

/** A delta as the card's headline figure, its unit drawn apart: `+3.1`. */
function signed(delta: number): string {
  return formatPointDelta(delta, { unit: false })
}

/** A rate, with a decimal under 10% where a whole number would flatten a small share. */
export function draftPercent(rate: number): string {
  return formatPercentage(rate, rate < 0.1 ? 1 : 0)
}

const games = (count: number) => tr(count === 1 ? 'draft.reason.gamesOne' : 'draft.reason.gamesOther', { count: formatCount(count) })

/** Below this, the solver's lane guess is said to be one. */
const SURE_OPPONENT = 0.9

function laneLabel(position: string): string {
  return positionLabel(position, { short: true }) ?? position.toLowerCase()
}

/**
 * Our team as a `teamFit` reason's band describes it — the item-context axes'
 * own bands (`DraftAxisThresholds`): allies' magic share under 30% / from 55%,
 * frontliners none / one / two or more.
 */
const TEAM_BANDS: Record<string, Record<string, { short: string, full: string }>> = {
  AllyMagicDamage: {
    Low: { short: 'draft.reason.team.physicalShort', full: 'draft.reason.team.physicalFull' },
    Mid: { short: 'draft.reason.team.mixedShort', full: 'draft.reason.team.mixedFull' },
    High: { short: 'draft.reason.team.magicShort', full: 'draft.reason.team.magicFull' },
  },
  AllyFrontline: {
    Low: { short: 'draft.reason.team.noFrontShort', full: 'draft.reason.team.noFrontFull' },
    Mid: { short: 'draft.reason.team.oneFrontShort', full: 'draft.reason.team.oneFrontFull' },
    High: { short: 'draft.reason.team.frontShort', full: 'draft.reason.team.frontFull' },
  },
}
const TEAM_FALLBACK = { short: 'draft.reason.team.fallbackShort', full: 'draft.reason.team.fallbackFull' }

function signTone(value: number | null): ReasonText['tone'] {
  if (value === null || value === 0) return 'neutral'
  return value > 0 ? 'good' : 'bad'
}

/**
 * The words for one reason. `position` is our lane (for "the most-played mids").
 * An unknown kind — an API newer than the app — still reads, as its figure only.
 */
export function describeReason(reason: DraftReason, nameOf: (championId: number) => string, position: string): ReasonText {
  const name = reason.championId !== null ? nameOf(reason.championId) : ''
  const delta = reason.delta ?? 0
  const lane = laneLabel(position)

  const pts = tr('draft.reason.pts')

  switch (reason.kind) {
    case 'laneMatchup': {
      const guess = reason.probability !== null && reason.probability < SURE_OPPONENT
      const params = { delta: draftPoints(delta), name, games: games(reason.games) }
      return {
        headline: signed(delta),
        unit: pts,
        short: tr(guess ? 'draft.reason.laneMatchup.shortLikely' : 'draft.reason.laneMatchup.short', { name }),
        full: guess
          ? tr('draft.reason.laneMatchup.fullGuess', { ...params, chance: draftPercent(reason.probability!) })
          : tr('draft.reason.laneMatchup.full', params),
        tone: signTone(delta),
      }
    }
    case 'blindSafety': {
      const count = reason.count ?? 0
      const of = reason.of ?? 0
      return {
        headline: signed(delta),
        unit: pts,
        short: count === 0 ? tr('draft.reason.blind.safe') : tr('draft.reason.blind.behind', { count, of }),
        full: tr('draft.reason.blind.full', { delta: draftPoints(delta), lane, count, of, games: games(reason.games) }),
        tone: count > 1 ? 'bad' : signTone(delta),
      }
    }
    case 'laneStrength':
      return {
        headline: signed(delta),
        unit: pts,
        short: tr(delta >= 0 ? 'draft.reason.laneStrength.strong' : 'draft.reason.laneStrength.weak', { lane }),
        full: tr('draft.reason.laneStrength.full', { delta: draftPoints(delta), lane, games: games(reason.games) }),
        tone: signTone(delta),
      }
    case 'synergy':
      return {
        headline: signed(delta),
        unit: pts,
        short: tr(reason.tentative ? 'draft.reason.synergy.shortHover' : 'draft.reason.synergy.short', { name }),
        full: tr(reason.tentative ? 'draft.reason.synergy.fullHover' : 'draft.reason.synergy.full', { delta: draftPoints(delta), name, games: games(reason.games) }),
        tone: signTone(delta),
      }
    case 'teamFit': {
      const team = TEAM_BANDS[reason.axis ?? '']?.[reason.bucket ?? ''] ?? TEAM_FALLBACK
      return {
        headline: signed(delta),
        unit: pts,
        short: tr(reason.tentative ? 'draft.reason.teamFit.shortHover' : 'draft.reason.teamFit.short', { team: tr(team.short) }),
        full: tr(reason.tentative ? 'draft.reason.teamFit.fullHover' : 'draft.reason.teamFit.full', { delta: draftPoints(delta), team: tr(team.full), games: games(reason.games) }),
        tone: signTone(delta),
      }
    }
    case 'lanePhase': {
      const rate = reason.rate ?? 0.5
      return {
        headline: draftPercent(rate).replace('%', ''),
        unit: '%',
        short: tr(rate >= 0.5 ? 'draft.reason.lanePhase.wins' : 'draft.reason.lanePhase.loses', { name }),
        full: tr('draft.reason.lanePhase.full', { rate: draftPercent(rate), games: games(reason.games), name }),
        tone: signTone(rate - 0.5),
      }
    }
    case 'laneThreat': {
      const params = { name, delta: draftPoints(delta), games: games(reason.games) }
      return {
        headline: signed(delta),
        unit: pts,
        short: tr('draft.reason.laneThreat.short', { name }),
        full: reason.share !== null
          ? tr('draft.reason.laneThreat.fullShare', { ...params, share: draftPercent(reason.share), lane })
          : tr('draft.reason.laneThreat.full', params),
        tone: 'bad',
      }
    }
    case 'banRate': {
      const rate = reason.rate ?? 0
      return {
        headline: draftPercent(rate).replace('%', ''),
        unit: '%',
        short: tr('draft.reason.banRate.short', { rate: draftPercent(rate) }),
        full: tr('draft.reason.banRate.full', { rate: draftPercent(rate), games: games(reason.games) }),
        tone: 'neutral',
      }
    }
    default:
      return {
        headline: reason.delta !== null ? signed(delta) : reason.rate !== null ? draftPercent(reason.rate).replace('%', '') : '',
        unit: reason.delta !== null ? pts : reason.rate !== null ? '%' : '',
        short: name,
        full: name,
        tone: signTone(reason.delta),
      }
  }
}
