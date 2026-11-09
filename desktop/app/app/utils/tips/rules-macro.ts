import type { GameObjectives, GameTeam } from '~/types/game'
import type { TipKey } from './catalogue'
import type { Reading } from './reading'
import { say } from './reading'

/**
 * The map's moments the death timers and the objectives' state make: a
 * numbers advantage with an objective standing (take it), an ace, a numbers
 * disadvantage (do not fight), a side one drake from its soul. ABSOL's coach
 * had "3/4 mortos, pressão" within seconds of the deaths; this one names
 * the objective there is to take.
 */

/** Enemies down that make an advantage, and the seconds of it worth saying. */
export const ADVANTAGE = { down: 2, seconds: 15 } as const

/** The objectives standing now, the biggest first: what an advantage should take. */
const STANDING = ['baron', 'dragon', 'herald', 'grubs'] as const

/** The seconds each player of `team` stays down, the dead ones. */
function downOf(reading: Reading, enemies: boolean): number[] {
  const { game, me, clock } = reading
  return game.players
    .filter(player => (player.team !== me.team) === enemies && player.dead && player.respawnAt !== null)
    .map(player => Math.round(player.respawnAt! - clock))
    .filter(seconds => seconds >= ADVANTAGE.seconds)
}

/** What a death count reading says once: the deaths so far key the moment, so a new death is a new one. */
const momentOf = (reading: Reading) => reading.game.players.reduce((sum, player) => sum + player.deaths, 0)

export function numbersTips(reading: Reading) {
  const { game, clock, me } = reading
  if (me.dead) return
  const moment = momentOf(reading)
  const enemiesDown = downOf(reading, true)
  const enemies = game.players.filter(player => player.team !== me.team).length
  if (enemies && enemiesDown.length >= enemies) {
    say(reading, 'macro.ace', { seconds: Math.min(...enemiesDown) }, `ace@${moment}`)
    return
  }
  if (enemiesDown.length >= ADVANTAGE.down) {
    const timers = game.objectives.timers
    const standing = timers ? STANDING.find(key => timers[key].at !== null && timers[key].at! <= clock && (timers[key].until === null || timers[key].until! > clock)) : undefined
    if (standing) {
      const name = standing === 'dragon' && timers!.elder ? 'elder' : standing
      say(reading, `macro.take.${name}` as TipKey, { down: enemiesDown.length, seconds: Math.min(...enemiesDown) }, `advantage@${moment}`)
    }
    return
  }
  const alliesDown = downOf(reading, false)
  if (alliesDown.length >= ADVANTAGE.down) say(reading, 'macro.outnumbered', { down: alliesDown.length, seconds: Math.min(...alliesDown) }, `outnumbered@${moment}`)
}

/** Drakes that make a side's soul point: the next one is its soul. */
const SOUL_POINT = 3

const drakesOf = (objectives: GameObjectives, team: GameTeam) => (team === 'ORDER' ? objectives.order : objectives.chaos).dragons

/** A side reaching its soul point: the next drake decides the soul. Once each side. */
export function soulTips(reading: Reading) {
  const { game, me, last } = reading
  if (!last || !me.team) return
  const enemy: GameTeam = me.team === 'ORDER' ? 'CHAOS' : 'ORDER'
  for (const [team, key] of [[me.team, 'objective.soulPoint.ours'], [enemy, 'objective.soulPoint.theirs']] as const) {
    if (drakesOf(last.objectives, team) < SOUL_POINT && drakesOf(game.objectives, team) >= SOUL_POINT) say(reading, key, {}, key)
  }
}
