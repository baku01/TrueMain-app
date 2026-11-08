import type { StaticItemData } from '#shared/types/static-data'
import type { GameState, GameTeam } from '~/types/game'
import { itemGold } from '~/utils/item-value'
import type { TipKey, TipParams } from './catalogue'
import type { Reading } from './reading'
import { crossed, isJungler, laneOf, say } from './reading'

/**
 * The tips the clock and our own state call for: the objectives' countdowns,
 * the minimap, the cannon wave to back on, the trinket, the farm, the gold
 * lead. Thresholds after ABSOL's coach, timings after patch 26.1's.
 */

/** Seconds before a spawn each warning is said at; the last only to a jungler, and not for the grubs. */
const MARKS = [['60s', 60], ['30s', 30], ['smite', 10]] as const

/** A warning a minute and half a minute before each objective spawns, and a jungler's Smite line ten seconds before. */
export function objectiveTips(reading: Reading) {
  const timers = reading.game.objectives.timers
  if (!timers) return
  const smite = isJungler(reading.me)
  for (const key of ['dragon', 'grubs', 'herald', 'baron'] as const) {
    const at = timers[key].at
    if (at === null) continue
    const name = key === 'dragon' && timers.elder ? 'elder' : key
    const params: TipParams = key === 'dragon' ? { drake: timers.drake ?? '' } : {}
    for (const [mark, before] of MARKS) {
      if (mark === 'smite' && (!smite || key === 'grubs')) continue
      const tip = `objective.${name}.${mark}` as TipKey
      if (crossed(reading, at - before)) say(reading, tip, params, `${tip}@${at}`)
    }
  }
}

/** Seconds between two looks at the minimap: a minute and a half through the laning phase, two minutes after. */
export function minimapEvery(clock: number) {
  return clock < 900 ? 90 : 120
}

/** Seconds without another tip before a filler (the minimap, a cannon wave with nothing to buy) may take the screen. */
export const QUIET = 20

/** Whether the screen has had nothing but fillers for `QUIET` seconds. */
export const quiet = (reading: Reading) => reading.memory.spokeAt === null || reading.clock - reading.memory.spokeAt >= QUIET

/**
 * From 2:00: a nudge to glance at the minimap every `minimapEvery`, never
 * while dead, and only on a quiet screen — it is the one line that is never
 * news, so it never stands in another's way.
 */
export function minimapTips(reading: Reading) {
  const memory = reading.memory
  if (reading.clock < 120 || reading.me.dead) return
  if (memory.minimapAt === null) {
    memory.minimapAt = reading.clock
    return
  }
  if (reading.clock - memory.minimapAt < minimapEvery(reading.clock) || !quiet(reading)) return
  memory.minimapAt = reading.clock
  say(reading, 'map.minimap')
}

/**
 * The waves that carry a cannon (patch 26.1): the third, at 1:30, then every
 * third one — every 90 s — until 14:00, after which the waves come every
 * 25 s and the cannons' pattern changes. Not the first: 1:30 is no time to back.
 */
export const CANNON_WAVES = Array.from({ length: 8 }, (_, index) => 180 + index * 90)

/** Seconds a wave walks to where it meets the other: mid's is shorter (waves after the first, before 14:00). */
export const WAVE_WALK = { mid: 19, side: 25 } as const

/** Gold that makes a back worth it: a real component, not a potion. */
export const RECALL_GOLD = 1100

/**
 * A laner's cannon wave reaching the lane: the moment to shove it into
 * their tower and back, so the crash costs no minions and the cannon's gold
 * is not lost. With gold for an item, said outright; without, only on a
 * quiet screen, as a reminder of the wave.
 */
export function cannonTips(reading: Reading) {
  const lane = laneOf(reading.me)
  if (!lane || reading.me.dead) return
  const walk = lane === 'mid' ? WAVE_WALK.mid : WAVE_WALK.side
  for (const spawn of CANNON_WAVES) {
    if (!crossed(reading, spawn + walk)) continue
    const gold = reading.game.gold
    if (gold >= RECALL_GOLD) say(reading, 'recall.cannon', { gold }, `cannon@${spawn}`)
    else if (quiet(reading)) say(reading, 'lane.cannon', {}, `cannon@${spawn}`)
  }
}

const STEALTH_WARD = 3340

/** Still on the yellow trinket: a jungler from 3:00 should sweep (red), a mid or a carry from level 9 should scout (blue). */
export function trinketTips(reading: Reading) {
  const { me } = reading
  if (me.items.find(item => item.slot === 6)?.itemId !== STEALTH_WARD) return
  if (isJungler(me)) {
    if (reading.clock >= 180) say(reading, 'ward.redLens', {}, 'ward.redLens')
  }
  else if ((me.position === 'MIDDLE' || me.position === 'BOTTOM') && me.level >= 9) {
    say(reading, 'ward.blueLens', {}, 'ward.blueLens')
  }
}

/** The minutes the farm is judged at: 10:00, then every five minutes to 35:00. */
export const FARM_MINUTES = [10, 15, 20, 25, 30, 35] as const

/** CS per minute above which the farm is great, and above which it is fine: a jungler clears fewer. */
const FARM_BARS = { jungle: { great: 5, ok: 3 }, lane: { great: 7, ok: 5 } }

/** The farm's verdict once the minute's sample is in (within half a minute of it); a support is not judged on it. */
export function farmTips(reading: Reading) {
  const { me, clock } = reading
  if (!me.position || me.position === 'UTILITY') return
  for (const minute of FARM_MINUTES) {
    if (clock < minute * 60 || clock >= minute * 60 + 30) continue
    const sample = reading.game.pace.samples.find(entry => entry.minute === minute)
    if (!sample) continue
    const perMinute = sample.cs / minute
    const bars = isJungler(me) ? FARM_BARS.jungle : FARM_BARS.lane
    const key: TipKey = perMinute > bars.great ? 'farm.great' : perMinute > bars.ok ? 'farm.ok' : 'farm.low'
    say(reading, key, { csPerMin: Math.round(perMinute * 10) / 10, minute }, `farm@${minute}`)
  }
}

/** The lead at which a side is said to be ahead, and below which it is even again. */
export const GOLD_LEAD = { ahead: 6, even: 3, from: 600, every: 300 } as const

/**
 * How far our side is ahead, from −10 to 10 and a little past with the map:
 * the item-gold gap as a share of all item gold — 15 % is the whole scale —
 * plus a point a drake, half a turret, a fifth a kill, and two for a Baron
 * buff running. Enemy gold in hand is not in the API: items are what is seen.
 */
export function goldLead(game: GameState, team: GameTeam, clock: number, items: Record<number, StaticItemData>) {
  const side = (ours: boolean) => game.players.filter(player => (player.team === team) === ours)
  const gold = (ours: boolean) => side(ours).reduce((sum, player) => sum + itemGold(player, items), 0)
  const kills = (ours: boolean) => side(ours).reduce((sum, player) => sum + player.kills, 0)
  const [mine, theirs] = team === 'ORDER' ? [game.objectives.order, game.objectives.chaos] : [game.objectives.chaos, game.objectives.order]
  const total = gold(true) + gold(false)
  const share = total > 0 ? (gold(true) - gold(false)) / total : 0
  const buff = (until: number | null) => (until !== null && until > clock ? 2 : 0)
  return Math.max(-10, Math.min(10, (share / 0.15) * 10))
    + (mine.dragons - theirs.dragons)
    + (mine.turrets - theirs.turrets) * 0.5
    + (kills(true) - kills(false)) * 0.2
    + buff(mine.baronUntil) - buff(theirs.baronUntil)
}

/** From 10:00, once a side pulls clearly ahead — said again only after it came back to even, and five minutes apart at least. */
export function goldTips(reading: Reading) {
  const { clock, memory } = reading
  if (clock < GOLD_LEAD.from || Object.keys(reading.items).length === 0) return
  const lead = goldLead(reading.game, reading.me.team, clock, reading.items)
  if (Math.abs(lead) < GOLD_LEAD.even) {
    memory.goldStanding = 'even'
    return
  }
  const standing = lead >= GOLD_LEAD.ahead ? 'ahead' : lead <= -GOLD_LEAD.ahead ? 'behind' : null
  if (!standing || standing === memory.goldStanding) return
  if (memory.goldAt !== null && clock - memory.goldAt < GOLD_LEAD.every) return
  memory.goldStanding = standing
  memory.goldAt = clock
  say(reading, standing === 'ahead' ? 'gold.ahead' : 'gold.behind')
}
