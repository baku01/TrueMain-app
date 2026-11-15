import type { GameParticipant, PlayerGame, TimelineMark } from '~/types/record'

/**
 * A made-up match history for `npm run dev`: the games older than a
 * scenario's record — those its client would page back through
 * (`olderGames`), those Blitz's match list would hold past them (`blitzGames`,
 * served in Riot's shape by `synthetic-blitz`) and those this machine would
 * have saved before (`savedGames`) — so the history can be paged and the nerd
 * statistics have a sample of a couple of hundred games to read.
 *
 * Dev-only, like every fixture: nothing here is a measurement. The games are
 * drawn from a seeded generator so a scenario always gives the same ones, and
 * shaped after the record's own — its champions, lanes, runes and Riot ID —
 * with a few relations planted in so the page has something to find: a lane
 * lead and a team strength behind each result, a little tilt after a loss
 * within a sitting, worse games deep in the night, a small blue-side edge.
 * Every participant carries the 5/10/15/20/30 marks the client's timeline
 * gives, the teams their objectives.
 */

/** mulberry32: a small, fast, seeded uniform generator. */
function generator(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

const LANES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const
const MARK_MINUTES = [5, 10, 15, 20, 30]
/** Champions the other nine players are drawn from. */
const OTHERS = [266, 103, 84, 12, 32, 34, 1, 22, 136, 268, 432, 53, 63, 201, 51, 164, 69, 31, 42, 122, 131, 119, 36, 245, 60, 28, 81, 9, 114, 105, 3, 41, 86, 150, 79, 104, 120, 74, 420, 39, 427, 40, 59, 24, 126, 202, 222, 145, 429, 43]
const LEGENDARY = [6655, 4645, 3089, 3135, 3157, 3165, 4628, 3116, 6653, 3102, 4629]
const KEYSTONES: [keystone: number, primary: number, sub: number, weight: number][] = [
  [8112, 8100, 8200, 0.6],
  [8229, 8200, 8300, 0.25],
  [8010, 8000, 8100, 0.15],
]
const QUEUES: [queueId: number, weight: number][] = [[420, 0.72], [440, 0.12], [400, 0.1], [450, 0.06]]

export function syntheticHistory(record: readonly PlayerGame[], count: number, seed: string): PlayerGame[] {
  const random = generator(hash(seed))
  const normal = (mean = 0, sd = 1) => {
    const u = Math.max(random(), 1e-12)
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
  }
  const pick = <T>(entries: readonly [T, number][]): T => {
    let left = random() * entries.reduce((sum, [, weight]) => sum + weight, 0)
    for (const [value, weight] of entries) {
      left -= weight
      if (left <= 0) return value
    }
    return entries.at(-1)![0]
  }
  const between = (low: number, high: number) => low + (high - low) * random()
  const whole = (value: number, low = 0, high = Number.POSITIVE_INFINITY) => Math.round(Math.min(Math.max(value, low), high))
  const sigmoid = (t: number) => 1 / (1 + Math.exp(-t))

  const tally = <T>(values: T[]) => [...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<T, number>())]
  const champions = tally(record.map(game => game.championId))
  const positions = tally(record.map(game => game.position ?? 'MIDDLE'))
  const self = record.flatMap(game => game.participants.filter(p => p.participantId === game.participantId))[0]
  // Each of the player's champions is a little better or worse than the rest: the main a touch better.
  const form = new Map<number, number>(champions.map(([id], index) => [id, index === 0 ? 0.25 : normal(0, 0.3)]))

  const oldest = record.reduce((earliest, game) => Math.min(earliest, game.playedAt), Date.now())
  const firstId = record.reduce((lowest, game) => Math.min(lowest, game.gameId), 7_212_000_001)
  const games: PlayerGame[] = []
  let cursor = oldest

  while (games.length < count) {
    // A sitting, placed before the last one: most in the evening, some by day, some deep in the night.
    const size = Math.min(count - games.length, pick([[1, 0.2], [2, 0.3], [3, 0.25], [4, 0.15], [5, 0.1]] as [number, number][]))
    const day = new Date(cursor - between(10, 40) * 3_600_000)
    const hour = pick([[20, 0.3], [21, 0.25], [19, 0.15], [15, 0.1], [17, 0.08], [1, 0.07], [0, 0.05]] as [number, number][])
    day.setHours(hour, Math.floor(between(0, 59)), 0, 0)
    let start = day.getTime()
    if (start + size * 60 * 60_000 > cursor) start = cursor - size * 60 * 60_000 - 3_600_000
    cursor = start
    let lostLast = false
    const sitting: PlayerGame[] = []
    for (let i = 0; i < size; i++) {
      const championId = pick(champions)
      const position = pick(positions) as string
      const queueId = pick(QUEUES)
      const aram = queueId === 450
      const teamId = random() < 0.5 ? 100 : 200
      const late = new Date(start).getHours() < 4
      // Typed: the loop's `lostLast` feeds `lane`, which feeds `win`, which sets `lostLast`.
      const lane: number = normal(form.get(championId) ?? 0, 1) - (lostLast ? 0.35 : 0)
      const team = normal(teamId === 100 ? 0.15 : 0, 1) - (late ? 0.4 : 0)
      const win: boolean = random() < sigmoid(1.1 * lane + 1.0 * team)
      const w = win ? 1 : 0
      const minutes = Math.min(Math.max(normal(30, 5.5) - 1.6 * Math.abs(lane + team), 16), 48)
      const durationSeconds = Math.round(minutes * 60)

      const kills = whole(normal(4.5 + 1.8 * lane + 1.2 * w, 2.2))
      const deaths = whole(normal(5.2 - 1.3 * lane - 1.6 * w, 2))
      const assists = whole(normal(6 + 2.4 * team + 2.6 * w, 3))
      const teamKills = Math.max(kills + assists, whole(normal(24 + 9 * w + 3 * team, 6), 4))
      const enemyKills = Math.max(deaths, whole(normal(24 - 6 * w - 2 * team, 6), 3))
      const cs = whole(normal(7.3 + 0.45 * lane, 0.6) * minutes * (aram ? 0.55 : 1))
      const gold = whole((380 + 40 * lane + 55 * w) * minutes + normal(0, 400))
      const damage = whole((880 + 140 * lane + 110 * w + normal(0, 140)) * minutes)
      const share = Math.min(Math.max(normal(0.27 + 0.02 * lane, 0.04), 0.12), 0.45)
      const visionScore = whole((aram ? 0.2 : normal(0.85, 0.2) + 0.06 * w) * minutes)
      const largestMultiKill = kills >= 3 ? pick([[1, 0.45], [2, 0.4], [3, 0.12], [4, 0.03]] as [number, number][]) : Math.min(kills, 1)

      const laneIndex = Math.max(0, LANES.indexOf(position as typeof LANES[number]))
      const participantId = (teamId === 100 ? 0 : 5) + laneIndex + 1
      const participants: GameParticipant[] = []
      // Kills and deaths dealt out so each side's line adds up to what the other side suffered.
      const split = (total: number, parts: number) => {
        const cuts = Array.from({ length: parts }, () => random() + 0.2)
        const sum = cuts.reduce((a, b) => a + b, 0)
        const out = cuts.map(cut => Math.floor(total * cut / sum))
        out[0]! += total - out.reduce((a, b) => a + b, 0)
        return out
      }
      const allyKills = split(teamKills - kills, 4)
      const allyDeaths = split(enemyKills - deaths, 4)
      const foeKills = split(enemyKills, 5)
      const foeDeaths = split(teamKills, 5)
      let ally = 0
      for (const side of [100, 200]) {
        for (const [index, role] of LANES.entries()) {
          const id = (side === 100 ? 0 : 5) + index + 1
          const mine = id === participantId
          const ours = side === teamId
          const lead = mine ? lane : ours ? team * 0.6 + normal(0, 0.8) : 0
          const opponentLead = !ours && role === position ? -lane : 0
          const edge = mine || ours ? lead : opponentLead - (team * 0.5)
          const marks: TimelineMark[] = MARK_MINUTES.filter(minute => minute <= minutes).map(minute => ({
            minute,
            gold: whole(500 + 360 * minute + (edge * 260 + normal(0, 120)) * minute / 10),
            cs: whole((role === 'UTILITY' ? 1.2 : role === 'JUNGLE' ? 5.5 : 7.4) * Math.max(minute - 1.5, 0) + edge * 6 * minute / 10 + normal(0, 4)),
            xp: whole(420 * minute + (edge * 220 + normal(0, 100)) * minute / 10),
          }))
          const k = mine ? kills : ours ? allyKills[ally]! : foeKills[index]!
          const d = mine ? deaths : ours ? allyDeaths[ally]! : foeDeaths[index]!
          const a = mine ? assists : whole(normal(ours ? teamKills * 0.4 : enemyKills * 0.4, 3))
          participants.push({
            participantId: id,
            championId: mine ? championId : OTHERS[Math.floor(random() * OTHERS.length)]!,
            teamId: side,
            position: aram ? null : role,
            gameName: mine ? self?.gameName ?? 'Synthetic' : `Bot${id}`,
            tagLine: mine ? self?.tagLine ?? 'TAPE' : '0000',
            win: side === teamId ? win : !win,
            kills: k,
            deaths: d,
            assists: a,
            cs: mine ? cs : whole(normal(role === 'UTILITY' ? 1.3 : 7, 0.8) * minutes),
            goldEarned: mine ? gold : whole((370 + ((side === teamId) === win ? 55 : 0)) * minutes + normal(0, 500)),
            damageToChampions: mine ? damage : whole(normal(820, 220) * minutes),
            visionScore: mine ? visionScore : whole(normal(role === 'UTILITY' ? 2.2 : 0.9, 0.25) * minutes),
            damageSelfMitigated: whole(normal(mine ? 520 : 700, 200) * minutes),
            damageToTurrets: whole(((side === teamId) === win ? 3200 : 1100) + normal(0, 800)),
            marks: aram ? [] : marks,
          })
          if (ours && !mine) ally++
        }
      }
      const teamDamage = participants.filter(p => p.teamId === teamId).reduce((sum, p) => sum + p.damageToChampions, 0)
      const winners = { towers: whole(normal(8, 1.5), 3, 11), dragons: whole(normal(3, 1), 0, 5), barons: minutes > 25 && random() < 0.7 ? 1 : 0, heralds: random() < 0.6 ? 1 : 0, grubs: whole(normal(4, 1.5), 0, 6), inhibitors: whole(normal(2, 1), 1, 3) }
      const losers = { towers: whole(normal(3, 1.8), 0, 9), dragons: whole(normal(1.3, 1), 0, 4), barons: random() < 0.15 ? 1 : 0, heralds: winners.heralds ? 0 : random() < 0.5 ? 1 : 0, grubs: 6 - winners.grubs, inhibitors: whole(normal(0.3, 0.6), 0, 2) }
      const items = [3020, ...Array.from({ length: whole(minutes / 7, 2, 5) }, () => LEGENDARY[Math.floor(random() * LEGENDARY.length)]!)]
      const keystone = pick(KEYSTONES.map(entry => [entry, entry[3]] as [typeof entry, number]))
      sitting.push({
        gameId: 0,
        participantId,
        playedAt: start,
        durationSeconds,
        queueId,
        mapId: aram ? 12 : 11,
        championId,
        championLevel: whole(10 + minutes * 0.22 + w, 1, 18),
        teamId,
        position: aram ? null : position,
        win,
        remake: false,
        kills,
        deaths,
        assists,
        cs,
        gold,
        damageToChampions: damage,
        visionScore,
        largestMultiKill,
        multiKills: { double: largestMultiKill >= 2 ? 1 + (random() < 0.3 ? 1 : 0) : 0, triple: largestMultiKill >= 3 ? 1 : 0, quadra: largestMultiKill >= 4 ? 1 : 0, penta: 0 },
        firstBlood: random() < sigmoid(-1.2 + 0.7 * lane),
        items: [...new Set(items), 0, 0, 0, 0, 0, 0].slice(0, 6),
        trinket: 3340,
        roleBoundItem: 0,
        spells: random() < 0.7 ? [4, 14] : [4, 12],
        keystone: keystone[0],
        primaryStyle: keystone[1],
        subStyle: keystone[2],
        teamKills,
        teamDamageToChampions: Math.max(teamDamage, Math.round(damage / share)),
        participants,
        teams: [100, 200].map(side => ({ teamId: side, bans: [], ...((side === teamId) === win ? winners : losers) })),
      })
      start += durationSeconds * 1000 + between(2, 8) * 60_000
      lostLast = !win
    }
    games.push(...sitting.reverse())
  }
  return games.map((game, index) => ({ ...game, gameId: firstId - index - 1 }))
}
