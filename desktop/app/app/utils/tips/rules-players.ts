import type { Reading } from './reading'
import type { TipKey } from './catalogue'
import { championParams, clockText, crossed, isJungler, laneOf, laneOpponent, sameItems, say } from './reading'
import { finishedItem } from './rules-self'

/**
 * The tips the other players call for: the enemy jungler and where to ward
 * for him, the level 2 and level 6 races of our lane, an enemy down, the
 * kills and the deaths. What the shell sends tells who died
 * and whose score moved, not who killed whom: a killer is the one enemy whose
 * kills rose in the reading of our death, and no one when several did.
 */

/**
 * When each jungler usually ends the first clear, in seconds: the median
 * moment ranked solo queue junglers reach level 4 (a full clear), patch 26.22
 * (lolrecommender.com's jungle clear times) — camps spawn at 0:55 since 26.1.
 * The rest at `DEFAULT_FIRST_CLEAR`, that table's middle.
 */
export const FIRST_CLEAR: Record<string, number> = {
  Jayce: 174, Taliyah: 175, Karthus: 176, Quinn: 176, Zed: 177, Zyra: 177, Hecarim: 178, Shyvana: 178, Volibear: 178,
  JarvanIV: 178, Ambessa: 179, Graves: 179, Sion: 179, Nunu: 180, Sejuani: 180, DrMundo: 180, Udyr: 181, Diana: 181,
  Darius: 181, MonkeyKing: 181, Chogath: 182, Lillia: 182, Trundle: 183, Belveth: 183, Rengar: 184, Olaf: 184,
  Qiyana: 184, Briar: 184, Gwen: 184, MasterYi: 184, Kayn: 184, Nocturne: 185, Ekko: 186, Talon: 186, Malphite: 186,
  Vi: 188, Naafiri: 188, Amumu: 188, Maokai: 188, AurelionSol: 189, LeeSin: 190, XinZhao: 190, Khazix: 191,
  Kindred: 191, Jax: 191, Viego: 191, Nidalee: 192, Rammus: 193, Elise: 194, Zaahen: 194, Warwick: 194,
  Pantheon: 197, Evelynn: 197, Sylas: 198, Fiddlesticks: 200, Zac: 202, Shaco: 203, Locke: 204, RekSai: 205,
}
export const DEFAULT_FIRST_CLEAR = 185

/** Seconds before his clear ends a laner is told where to ward: time to push the wave and walk to the bush. */
export const GANK_WARD_BEFORE = 45
/** Seconds before it ends a laner is told he is about done: play safe until he shows. */
export const CLEAR_WARNING_BEFORE = 10

/** The jungle's early game, before 15:00. */
const JUNGLE_UNTIL = 900
/** Seconds between two sightings of the enemy jungler said. */
export const SPOTTED_EVERY = 20
/** Before this, an enemy's items are the ones he started with, bought in his fountain. */
const SPOTTED_FROM = 40

/**
 * The enemy jungler before 15:00. To a laner: where to ward for his first
 * gank, by lane, `GANK_WARD_BEFORE` his clear ends; that it is about to, just
 * before; and when his second gank window opens, 70 s after. To anyone: that
 * he was seen, when his items change while he is alive — an enemy's items
 * move on the scoreboard only when he is in sight (his level moves anyway, so
 * it tells nothing) —, at most every `SPOTTED_EVERY`.
 */
export function jungleTips(reading: Reading) {
  const { game, me, clock, memory } = reading
  if (clock >= JUNGLE_UNTIL) return
  const index = game.players.findIndex(player => player.team !== me.team && isJungler(player))
  const jungler = game.players[index]
  if (!jungler) return
  const params = championParams(jungler)
  const lane = laneOf(me)
  if (lane) {
    const clear = FIRST_CLEAR[jungler.champion] ?? DEFAULT_FIRST_CLEAR
    if (crossed(reading, clear - GANK_WARD_BEFORE)) say(reading, `ward.gank.${lane}` as TipKey, { ...params, time: clockText(clear) }, 'ward.gank')
    if (crossed(reading, clear - CLEAR_WARNING_BEFORE)) say(reading, 'jungle.firstClear', params, 'jungle.firstClear')
    if (crossed(reading, clear + 70)) say(reading, 'jungle.gankWindow', params, 'jungle.gankWindow')
  }
  const before = reading.last?.players[index]
  if (!before || before.dead || jungler.dead || clock < SPOTTED_FROM) return
  if (sameItems(before.items, jungler.items)) return
  if (memory.spottedAt !== null && clock - memory.spottedAt < SPOTTED_EVERY) return
  memory.spottedAt = clock
  say(reading, 'jungle.spotted', params)
}

/** Plates fall at 14:00: until then a dead lane opponent is a turret to hit. */
const PLATES_UNTIL = 840

/**
 * An enemy down, with how long for: their jungler, to everyone (a window to
 * invade, or to take the next objective, before 15:00); our lane opponent, to
 * a laner in the laning phase (shove, take a plate, ward deep).
 */
export function deathWindowTips(reading: Reading) {
  const { game, me, last, clock } = reading
  if (!last || me.dead) return
  const rival = laneOpponent(game, me)
  game.players.forEach((player, index) => {
    const before = last.players[index]
    if (player.team === me.team || !player.dead || !before || before.dead || player.respawnAt === null) return
    const seconds = Math.round(player.respawnAt - clock)
    if (seconds < 10) return
    if (isJungler(player) && clock < JUNGLE_UNTIL) say(reading, 'jungle.dead', { ...championParams(player), seconds }, `jungle.dead@${player.deaths}`)
    else if (player === rival && laneOf(me) && clock < PLATES_UNTIL) say(reading, 'lane.opponentDead', { ...championParams(player), seconds }, `lane.dead@${player.deaths}`)
  })
}

/** The level 2 race of the first waves: before 3:00, once a game. */
const LEVEL_TWO_UNTIL = 180

/**
 * Who of us and our lane opponent reached level 2 first: the first to get
 * there has a second spell for a short while — trade now, or back off.
 * Nothing when both get there in one reading.
 */
export function levelTwoTips(reading: Reading) {
  const { game, me, memory, clock } = reading
  if (memory.said['lane.levelTwo'] || clock >= LEVEL_TWO_UNTIL || !laneOf(me)) return
  const rival = laneOpponent(game, me)
  if (!rival || (me.level < 2 && rival.level < 2)) return
  memory.said['lane.levelTwo'] = true
  if (me.level >= 2 && rival.level >= 2) return
  if (me.level >= 2) say(reading, 'lane.levelTwoFirst', championParams(rival))
  else say(reading, 'lane.levelTwoBehind', championParams(rival))
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

/**
 * Our lane opponent finishing a legendary: the item shows on the scoreboard
 * once he is seen with it, and his spike is the moment to respect a trade
 * (ABSOL's "fechou o primeiro item! … respeita"). Laners only, once an item.
 */
export function enemySpikeTips(reading: Reading) {
  const { game, me, last, items } = reading
  if (!last || !laneOf(me)) return
  const rival = laneOpponent(game, me)
  if (!rival) return
  const was = last.players[game.players.indexOf(rival)]
  if (!was) return
  const item = finishedItem(was.items, rival.items, items)
  if (item) say(reading, 'lane.spikeTheirs', { ...championParams(rival), item: item.name }, `spike@${rival.champion}@${item.id}`)
}

/** Levels apart from which a lane is won or lost on stats alone (ABSOL's "níveis na frente/atrás"); laning phase only. */
export const LEVEL_GAP = { levels: 2, until: 840 } as const

/** Two levels or more between us and our lane opponent, said once each way until the gap closes. */
export function levelGapTips(reading: Reading) {
  const { game, me, memory, clock } = reading
  if (clock >= LEVEL_GAP.until || !laneOf(me)) return
  const rival = laneOpponent(game, me)
  if (!rival) return
  const gap = me.level - rival.level
  const side = gap >= LEVEL_GAP.levels ? 1 : gap <= -LEVEL_GAP.levels ? -1 : 0
  if (side === 0) {
    memory.levelGap = 0
    return
  }
  if (side === memory.levelGap) return
  memory.levelGap = side
  say(reading, side > 0 ? 'lane.levelAhead' : 'lane.levelBehind', { ...championParams(rival), levels: Math.abs(gap) })
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
