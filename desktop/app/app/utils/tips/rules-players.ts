import type { Reading } from './reading'
import { championParams, crossed, isJungler, laneOpponent, sameItems, say } from './reading'

/**
 * The tips the other players call for: the enemy jungler, the first level 6
 * of our lane, the kills and the deaths. What the shell sends tells who died
 * and whose score moved, not who killed whom: a killer is the one enemy whose
 * kills rose in the reading of our death, and no one when several did.
 */

/** When each jungler usually ends the first clear, in seconds (ABSOL's table); the rest at `DEFAULT_FIRST_CLEAR`. */
export const FIRST_CLEAR: Record<string, number> = { LeeSin: 150, Shaco: 150, Vi: 175, Viego: 185, Sejuani: 185, Graves: 210, Karthus: 240 }
export const DEFAULT_FIRST_CLEAR = 195

/** The jungle's early game, before 15:00. */
const JUNGLE_UNTIL = 900
/** Seconds between two sightings of the enemy jungler said. */
export const SPOTTED_EVERY = 30

/**
 * The enemy jungler before 15:00. To a laner: half a minute before his first
 * clear ends, and when his second gank window opens, 70 s after. To anyone:
 * when his items or his level change while he is alive — the game updates
 * an enemy's on the scoreboard when he is seen — at most every
 * `SPOTTED_EVERY`, and not in the first minute and a half, spent buying at base.
 */
export function jungleTips(reading: Reading) {
  const { game, me, clock, memory } = reading
  if (clock >= JUNGLE_UNTIL) return
  const index = game.players.findIndex(player => player.team !== me.team && isJungler(player))
  const jungler = game.players[index]
  if (!jungler) return
  const params = championParams(jungler)
  if (!isJungler(me)) {
    const clear = FIRST_CLEAR[jungler.champion] ?? DEFAULT_FIRST_CLEAR
    if (crossed(reading, clear - 30)) say(reading, 'jungle.firstClear', params, 'jungle.firstClear')
    if (crossed(reading, clear + 70)) say(reading, 'jungle.gankWindow', params, 'jungle.gankWindow')
  }
  const before = reading.last?.players[index]
  if (!before || before.dead || jungler.dead || clock < 90) return
  if (before.level === jungler.level && sameItems(before.items, jungler.items)) return
  if (memory.spottedAt !== null && clock - memory.spottedAt < SPOTTED_EVERY) return
  memory.spottedAt = clock
  say(reading, 'jungle.spotted', params)
}

/** Which of us and our lane opponent reached level 6 first, said once; nothing when both got there in one reading. */
export function levelTips(reading: Reading) {
  const { memory, me } = reading
  if (memory.said['level.six']) return
  const rival = laneOpponent(reading.game, me)
  if (!rival || (me.level < 6 && rival.level < 6)) return
  if (me.level >= 6 && rival.level >= 6) memory.said['level.six'] = true
  else if (me.level >= 6) say(reading, 'level.sixFirst', {}, 'level.six')
  else say(reading, 'level.enemySixFirst', championParams(rival), 'level.six')
}

/** A shutdown: an enemy this far ahead carries a bounty when he falls (ABSOL's bar). */
export const isFed = (kills: number, deaths: number) => kills >= 6 && kills > deaths + 3

/**
 * What our last reading's kills and deaths say: a kill at level 2, a fed
 * enemy shut down, a third death in a row (and every second one after),
 * the third death to one enemy.
 */
export function fightTips(reading: Reading) {
  const { game, me, memory, last } = reading
  if (!last) return
  const mine = game.players.indexOf(me)
  const was = last.players[mine]
  if (!was) return
  const kills = me.kills - was.kills
  if (kills > 0 && was.level <= 2) say(reading, 'kill.levelTwo', {}, 'kill.levelTwo')
  if (kills > 0 || me.assists > was.assists) memory.deathStreak = 0

  const deaths = me.deaths - was.deaths
  if (deaths > 0) {
    memory.deathStreak += deaths
    const streak = memory.deathStreak
    if (streak >= 3 && (streak - 3) % 2 === 0) say(reading, 'death.streak', { deaths: streak })
    const killers = game.players.filter((player, index) => player.team !== me.team && player.kills > (last.players[index]?.kills ?? player.kills))
    const killer = deaths === 1 && killers.length === 1 ? killers[0]! : null
    if (killer) {
      const id = killer.riotId || killer.champion
      memory.killedBy[id] = (memory.killedBy[id] ?? 0) + 1
      if (memory.killedBy[id] === 3) say(reading, 'death.nemesis', championParams(killer))
    }
  }

  game.players.forEach((player, index) => {
    const before = last.players[index]
    if (!before || player.team === me.team || player.deaths <= before.deaths) return
    if (isFed(before.kills, before.deaths)) say(reading, 'kill.shutdown', championParams(player), `kill.shutdown@${index}:${player.deaths}`)
  })
}
