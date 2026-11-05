import type { MatchBadge } from '#shared/types/matches'
import type { GameParticipant, PlayerGame } from '~/types/record'
import type { GameScore } from '~/utils/match-summary'
import { sortBadges } from '#common/utils/match-badges'

/**
 * A game's accolades for the player, every one Blitz awards and on Blitz's own
 * rules: the game's score (MVP, SVP, 2nd, 3rd), multi-kills, gold, damage,
 * damage mitigated and tower damage ranked over the ten players (first, then
 * second or third), CS and vision per minute (on Summoner's Rift), deaths,
 * a support's line, first blood and a perfect game. Each family gives one
 * badge at most, its best. Heaviest first (`sortBadges`).
 *
 * None for a game too short to say anything: ten minutes anywhere, fourteen on
 * the Rift. What the client's scoreboard did not carry (an unread scoreboard,
 * the objectives of an older game) simply earns nothing.
 */

const SUMMONERS_RIFT = 11
const HOWLING_ABYSS = 12
const ARENA = 30

/** The player's place among the ten on a measure, 1 for the most; null without the scoreboard. */
function rankOf(game: PlayerGame, measure: (p: GameParticipant) => number | undefined): number | null {
  const me = game.participants.find(p => p.participantId === game.participantId)
  const mine = me ? measure(me) : undefined
  if (!me || mine === undefined || mine <= 0) return null
  return 1 + game.participants.filter(p => (measure(p) ?? 0) > mine).length
}

export function matchBadges(game: PlayerGame, score: GameScore | null = null): MatchBadge[] {
  const rift = game.mapId === SUMMONERS_RIFT
  if (game.remake || game.durationSeconds <= 600 || (rift && game.durationSeconds <= 840)) return []
  const minutes = game.durationSeconds / 60
  const badges: MatchBadge[] = []
  const add = (badge: MatchBadge | null) => badge && badges.push(badge)

  if (score?.placement) {
    if (score.isMvp || score.placement === 1) add({ kind: 'mvp' })
    else if (score.isAce) add({ kind: 'svp' })
    else if (score.placement === 2) add({ kind: 'second' })
    else if (score.placement === 3) add({ kind: 'third' })
  }

  const multi = game.multiKills
  const largest = game.largestMultiKill
  if (multi?.penta || largest >= 5) add({ kind: 'pentaKill', value: multi?.penta || 1 })
  else if (multi?.quadra || largest === 4) add({ kind: 'quadraKill', value: multi?.quadra || 1 })
  else if (multi?.triple || largest === 3) add({ kind: 'tripleKill', value: multi?.triple || 1 })
  else if (multi?.double || largest === 2) add({ kind: 'doubleKill', value: multi?.double || 1 })

  const gold = rankOf(game, p => p.goldEarned)
  add(gold === 1 ? { kind: 'filthyRich', value: game.gold } : gold === 2 ? { kind: 'cashMoney', value: game.gold } : gold === 3 ? { kind: 'goldDigger', value: game.gold } : null)

  if (rift) {
    const csPerMin = Math.round(game.cs / minutes * 10) / 10
    add(csPerMin > 9 ? { kind: 'csGod', value: csPerMin } : csPerMin > 8 ? { kind: 'csLegend', value: csPerMin } : csPerMin > 7 ? { kind: 'csMaster', value: csPerMin } : null)
  }

  add(game.deaths === 0 ? { kind: 'unkillable' } : game.deaths === 1 ? { kind: 'stable' } : null)

  if (rift) {
    const perMinute = game.visionScore / minutes
    if (perMinute > 2.5) add({ kind: 'allSeeing', value: game.visionScore, target: Math.ceil(minutes * 2.5) })
    else if (perMinute > 2) add({ kind: 'goodEye', value: game.visionScore, target: Math.ceil(minutes * 2) })
  }

  const kda = (game.kills + game.assists) / Math.max(1, game.deaths)
  if (kda > 3 && game.assists > game.kills * 3) add({ kind: 'trueSupport', value: game.assists, target: Math.round(kda * 100) / 100 })

  if (game.firstBlood && game.mapId !== ARENA) add({ kind: 'firstBlood' })

  const dpm = Math.round(game.damageToChampions / minutes)
  const damage = rankOf(game, p => p.damageToChampions)
  add(damage === 1 ? { kind: 'topDamage', value: dpm } : damage === 2 ? { kind: 'goodDamage', value: dpm } : null)

  const me = game.participants.find(p => p.participantId === game.participantId)
  const mitigatedPerMin = Math.round((me?.damageSelfMitigated ?? 0) / minutes)
  const mitigated = rankOf(game, p => p.damageSelfMitigated)
  add(mitigated === 1 ? { kind: 'bigChungus', value: mitigatedPerMin } : mitigated === 2 ? { kind: 'beefy', value: mitigatedPerMin } : null)

  const turrets = rankOf(game, p => p.damageToTurrets)
  add(turrets === 1 ? { kind: 'wreckingBall', value: me?.damageToTurrets } : turrets === 2 ? { kind: 'bulldozer', value: me?.damageToTurrets } : null)

  if (game.win && perfect(game)) add({ kind: 'perfectGame' })

  return sortBadges(badges)
}

/**
 * Won without giving the enemy anything: on the Rift no tower, kill, dragon,
 * inhibitor or herald to them and at least one of those for us; in ARAM no
 * tower lost and at least one taken.
 */
function perfect(game: PlayerGame): boolean {
  const ours = game.teams?.find(team => team.teamId === game.teamId)
  const theirs = game.teams?.find(team => team.teamId !== game.teamId)
  if (!ours || !theirs) return false
  if (game.mapId === HOWLING_ABYSS) return theirs.towers === 0 && ours.towers > 0
  if (game.mapId !== SUMMONERS_RIFT || !game.participants.length) return false
  const kills = (teamId: number) => game.participants.filter(p => p.teamId === teamId).reduce((sum, p) => sum + p.kills, 0)
  const enemyTook = theirs.towers + kills(theirs.teamId) + theirs.dragons + theirs.inhibitors + theirs.heralds
  const weTook = ours.towers + kills(ours.teamId) + ours.dragons + ours.inhibitors + ours.heralds
  return enemyTook === 0 && weTook > 0
}
