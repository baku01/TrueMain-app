import type { MatchBadge } from '#shared/types/matches'
import type { PlayerGame } from '~/types/record'

/**
 * A game's standouts for the player, as Blitz tags them under a match: the
 * game's top damage and gold (ranked over the ten players of the scoreboard),
 * a multi-kill, a farm, a deathless game, vision against the game's length.
 * Ordered rarest first, so a row short on room keeps the ones that matter.
 * A remake earns none; a game whose scoreboard could not be read earns only
 * what the player's own line says.
 */
export function matchBadges(game: PlayerGame): MatchBadge[] {
  if (game.remake) return []
  const minutes = Math.max(game.durationSeconds / 60, 1)
  const badges: MatchBadge[] = []

  if (game.largestMultiKill >= 5) badges.push({ kind: 'pentaKill' })
  else if (game.largestMultiKill === 4) badges.push({ kind: 'quadraKill' })
  else if (game.largestMultiKill === 3) badges.push({ kind: 'tripleKill' })

  const others = game.participants.filter(p => p.participantId !== game.participantId)
  if (others.length) {
    const dpm = Math.round(game.damageToChampions / minutes)
    if (others.every(p => p.damageToChampions < game.damageToChampions)) badges.push({ kind: 'topDamage', value: dpm })
    else if (others.filter(p => p.teamId === game.teamId).every(p => p.damageToChampions < game.damageToChampions)) {
      badges.push({ kind: 'teamDamage', value: dpm })
    }
    if (others.every(p => p.goldEarned < game.gold)) badges.push({ kind: 'topGold', value: game.gold })
  }

  if (game.deaths === 0) badges.push({ kind: 'unkillable' })

  const csPerMin = Math.round(game.cs / minutes * 10) / 10
  if (csPerMin >= 10) badges.push({ kind: 'csGod', value: csPerMin })
  else if (csPerMin >= 9) badges.push({ kind: 'csLegend', value: csPerMin })
  else if (csPerMin >= 8) badges.push({ kind: 'csMaster', value: csPerMin })

  if (game.visionScore >= minutes * 2.5) badges.push({ kind: 'allSeeing', value: game.visionScore, target: Math.ceil(minutes * 2.5) })
  else if (game.visionScore >= minutes * 2) badges.push({ kind: 'goodEye', value: game.visionScore, target: Math.ceil(minutes * 2) })

  return badges
}
