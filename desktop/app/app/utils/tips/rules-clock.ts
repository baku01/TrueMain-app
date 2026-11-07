import type { StaticItemData } from '#shared/types/static-data'
import type { GameState, GameTeam } from '~/types/game'
import { itemGold } from '~/utils/item-value'
import type { TipKey, TipParams } from './catalogue'
import type { Reading } from './reading'
import { crossed, isJungler, say } from './reading'

/**
 * The tips the clock and our own state call for: the objectives' countdowns,
 * the minimap, an early recall, the trinket, the farm, the gold lead.
 * Thresholds after ABSOL's coach.
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

/** Seconds between two looks at the minimap, longer as the game goes on. */
export function minimapEvery(clock: number) {
  if (clock < 300) return 30
  if (clock < 600) return 35
  if (clock < 900) return 40
  if (clock < 1500) return 50
  return 60
}

/** From 1:30, once the lanes are on: bring the minimap up at `minimapEvery`, never while dead. */
export function minimapTips(reading: Reading) {
  const memory = reading.memory
  if (reading.clock < 90 || reading.me.dead) return
  if (memory.minimapAt === null) {
    memory.minimapAt = reading.clock
    return
  }
  if (reading.clock - memory.minimapAt < minimapEvery(reading.clock)) return
  memory.minimapAt = reading.clock
  say(reading, 'map.minimap')
}

/** The first back: from 3:00 to 5:00, enough gold for a real item is worth a recall (once a minute at most). */
export const EARLY_RECALL = { from: 180, until: 300, gold: 1400, every: 60 } as const

export function recallTips(reading: Reading) {
  const { clock, memory } = reading
  if (reading.me.dead || clock < EARLY_RECALL.from || clock >= EARLY_RECALL.until || reading.game.gold < EARLY_RECALL.gold) return
  if (memory.recallAt !== null && clock - memory.recallAt < EARLY_RECALL.every) return
  memory.recallAt = clock
  say(reading, 'recall.earlyGold', { gold: reading.game.gold })
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
