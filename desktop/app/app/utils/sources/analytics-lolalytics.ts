import type { ChampionAnalytics, LaneRows, Objective, RuneStat, SkillPath, SummaryBuild, TrendSeries } from '~/utils/sources/analytics'
import type { LolalyticsSummary } from '~/utils/sources/lolalytics'
import { damageShares, emptyAnalytics, lettersOf, pointsOf } from '~/utils/sources/analytics'
import { measure } from '~/utils/sources/model'
import { lolalyticsLane, lolalyticsOptionsOf, readLolalyticsBuild, readLolalyticsTeam } from '~/utils/sources/lolalytics'

/** One of lolalytics' two named builds — the most played (`pick`) or the one that wins most (`win`). */
function summaryBuild(summary: LolalyticsSummary | undefined): SummaryBuild | null {
  if (!summary) return null
  const m = (entry: { n: number, wr: number } | undefined) => measure(entry?.n ?? 0, rate(entry?.wr ?? 0), 0)
  const runes = summary.runes
  const [keystone = 0, perk1 = 0, perk2 = 0, perk3 = 0] = runes?.set.pri ?? []
  const [secondary1 = 0, secondary2 = 0] = runes?.set.sec ?? []
  const [offense = 0, flex = 0, defense = 0] = runes?.set.mod ?? []
  const items = summary.items
  return {
    skillPriority: summary.skillpriority ? { ...m(summary.skillpriority), order: summary.skillpriority.id.split('') } : null,
    skillOrder: summary.skillorder ? { ...m(summary.skillorder), points: pointsOf(summary.skillorder.id) } : null,
    spells: summary.sums ? { ...m(summary.sums), spellIds: summary.sums.ids } : null,
    runes: runes
      ? {
          ...m(runes),
          // lolalytics names the trees by keystone and by rune: the styles are filled from the tree where the page is drawn.
          page: { primaryStyleId: 0, primaryKeystoneId: keystone, primaryPerk1Id: perk1, primaryPerk2Id: perk2, primaryPerk3Id: perk3, secondaryStyleId: 0, secondaryPerk1Id: secondary1, secondaryPerk2Id: secondary2, statOffense: offense, statFlex: flex, statDefense: defense },
        }
      : null,
    starters: items?.start ? { ...m(items.start), itemIds: items.start.set } : null,
    core: items?.core ? { ...m(items.core), itemIds: items.core.set } : null,
    after: ([4, 5, 6] as const).flatMap((slot) => {
      const options = (items?.[`item${slot}`] ?? []).map(entry => ({ ...m(entry), itemId: entry.id }))
      return options.length ? [{ slot, options }] : []
    }),
  }
}

const paths = (rows: [number | string, number, number, number][] | undefined, letters = false): SkillPath[] =>
  (rows ?? []).map(([code, wr, pr, n]) => {
    const points = letters ? [] : pointsOf(code)
    return { ...measure(n, rate(wr), rate(pr)), points, order: letters ? String(code).split('') : lettersOf(points) }
  })

/**
 * lolalytics' analytics: every section, from the one `build-full` read the
 * build panel makes too — the header with its grade and rank, the lanes, items
 * slot by slot with the minute they are bought, the first six levels skill by
 * skill, every lane's matchups, objectives, game length, the trend by elo and
 * the top players.
 */
const POSITION: Record<string, string> = { top: 'TOP', jungle: 'JUNGLE', middle: 'MIDDLE', bottom: 'BOTTOM', support: 'UTILITY' }
const rate = (percent: number | string) => Number(percent) / 100

/** lolalytics' trend brackets, in the order its charts list them. */
const BRACKETS = ['all', 'diamond_plus', 'emerald', 'platinum', 'gold', 'silver', 'bronze', 'iron']

type Row = [number | string, number, number, number, number?]
/** A row of item ids (`1056_2003_2003` or one id) as the panel's option, rates as fractions, with the minute it is bought when given. */
const itemRow = ([ids, wr, pr, games, minute]: Row) => ({
  itemIds: String(ids).split('_').map(Number).filter(Boolean),
  winRate: rate(wr),
  pickRate: rate(pr),
  games,
  ...(minute !== undefined ? { minute } : {}),
})

export async function lolalyticsAnalytics(championId: number, position: string, eloBracket: unknown, region = 'all'): Promise<ChampionAnalytics> {
  const build = await readLolalyticsBuild(championId, position, eloBracket, region)
  const analytics = emptyAnalytics()
  if (!build) return analytics
  const header = build.header

  analytics.patch = header.patch
  analytics.header = {
    games: header.n,
    winRate: rate(header.wr),
    pickRate: rate(header.pr),
    banRate: rate(header.br),
    tier: header.tier,
    rank: header.rank,
    rankTotal: header.rankTotal,
    averageWinRate: rate(header.avgWr),
    previous: null,
  }
  analytics.lanes = Object.entries(build.nav?.lanes ?? {})
    .map(([lane, share]) => ({ position: POSITION[lane] ?? lane.toUpperCase(), share: rate(share) }))
    .filter(lane => lane.share > 0)
    .sort((a, b) => b.share - a.share)
  analytics.options = await lolalyticsOptionsOf(build)
  analytics.summary = { common: summaryBuild(build.summary?.pick), winning: summaryBuild(build.summary?.win) }
  analytics.skillPaths = {
    priority: paths(build.skillOrder, true),
    level6: paths(build.skill6),
    level10: paths(build.skill10),
    level15: paths(build.skill15),
  }
  for (const [key, entries] of Object.entries(build.runes?.stats ?? {})) {
    const [first, second] = entries
    const stat: RuneStat = {
      primary: first ? measure(first[2], rate(first[1]), rate(first[0])) : null,
      secondary: second ? measure(second[2], rate(second[1]), rate(second[0])) : null,
    }
    // A flex shard carries an `f`: kept under its own key, so the offense row's 5008 and the flex row's are told apart.
    analytics.runeStats.set(key.endsWith('f') ? -Number.parseInt(key, 10) : Number(key), stat)
  }

  const slotRows = [build.boots, build.item1, build.item2, build.item3, build.item4, build.item5]
  analytics.itemSlots = slotRows.flatMap((rows, slot) => {
    const options = (rows ?? []).filter(row => Number(row[0]) > 0).slice(0, 12).map(row => ({
      ...measure(row[3], rate(row[1]), rate(row[2])),
      itemIds: [Number(row[0])],
      minute: row[4],
    }))
    return options.length ? [{ slot, options }] : []
  })

  analytics.skillLevels = (build.skillEarly ?? []).map((skills, index) => ({
    level: index + 1,
    skills: skills.map(entry => (entry[2] > 0 ? measure(entry[2], rate(entry[0]), rate(entry[1])) : null)),
  }))

  const own = lolalyticsLane(position)
  analytics.matchups = Object.entries(build.enemy ?? {})
    .sort(([a], [b]) => Number(b === own) - Number(a === own))
    .map(([lane, rows]): LaneRows => ({
      position: POSITION[lane] ?? lane.toUpperCase(),
      rows: rows.map(([id, wr, delta1, delta2, pr, n]) => ({ championId: id, winRate: rate(wr), pickRate: rate(pr), games: n, delta1, delta2 })),
    }))

  analytics.objectives = Object.entries(build.sidebar?.objective ?? {}).map(([key, values]): Objective => {
    const [secureShare = 0, secureWin = 0, concededShare, concededWin] = values
    return {
      key,
      secure: measure(0, rate(secureWin), rate(secureShare)),
      conceded: concededShare === undefined ? null : measure(0, rate(concededWin ?? 0), rate(concededShare)),
    }
  })

  // lolalytics' bands: 1 is under 15 minutes, then five minutes each, 7 is 40 and over.
  const LENGTH_MINUTES: Record<string, [number, number | null]> = { 1: [0, 15], 2: [15, 20], 3: [20, 25], 4: [25, 30], 5: [30, 35], 6: [35, 40], 7: [40, null] }
  const time = build.sidebar?.time
  if (time) {
    const total = Object.values(time.time).reduce((sum, games) => sum + games, 0)
    analytics.gameLength = Object.keys(time.time).sort((a, b) => Number(a) - Number(b)).map((bucket) => {
      const games = time.time[bucket] ?? 0
      return { ...measure(games, games > 0 ? (time.timeWin[bucket] ?? 0) / games : 0, total > 0 ? games / total : 0), minutes: LENGTH_MINUTES[bucket] }
    })
  }

  const graph = build.graph
  if (graph) {
    const series = (values: Record<string, number[]>, scale: (value: number) => number): TrendSeries[] =>
      BRACKETS.filter(bracket => values[bracket]?.length).map(bracket => ({
        label: bracket,
        points: graph.dates.map((date, index) => ({ label: date, value: scale(values[bracket]![index] ?? 0) })),
      }))
    analytics.trend = { winRate: series(graph.wr, rate), pickRate: series(graph.pr, rate), banRate: series(graph.br, rate), games: series(graph.n, value => value) }
  }

  // lolalytics names its players only: each avatar reads its account icon through Blitz (`PlayerAvatar`).
  analytics.topPlayers = (build.sidebar?.topList ?? []).map(([, name, region, wr, games, elo]) => ({
    name,
    region: region ? region.toUpperCase() : null,
    winRate: rate(wr),
    games: Number(games),
    rank: elo || null,
  }))

  const depth = build.sidebar?.depth
  if (depth) analytics.playerBase = { players: depth[1], breadth: Number(depth[2]), depth: Number(depth[3]), label: depth[4] }
  analytics.stats = (build.sidebar?.stats?.stats ?? []).map(([key, , value, , rank]) => ({ key, value, rank: rank || null }))

  const team = await readLolalyticsTeam(championId, position, eloBracket, region).catch(() => null)
  analytics.synergies = Object.entries(team?.team ?? {}).map(([lane, rows]): LaneRows => ({
    position: POSITION[lane] ?? lane.toUpperCase(),
    rows: rows.map(([id, wr, delta1, delta2, pr, n]) => ({ championId: id, winRate: rate(wr), pickRate: rate(pr), games: n, delta1, delta2 })),
  })).filter(lane => lane.rows.length > 0)

  const damage = header.damage
  analytics.damage = damage ? damageShares(damage.physical ?? 0, damage.magic ?? 0, damage.true ?? 0) : null
  analytics.spellTable = (build.spells ?? []).map(([ids, wr, pr, games]) => ({ spellIds: ids.split('_').map(Number), winRate: rate(wr), pickRate: rate(pr), games }))
  analytics.startingSets = (build.startSet ?? []).map(row => itemRow(row as Row))
  analytics.startingItems = (build.startItem ?? []).map(itemRow)
  analytics.earlyItems = (build.earlyItem ?? []).map(itemRow)
  const total = header.n || 1
  analytics.itemSets = Object.entries(build.itemSets ?? {})
    .map(([key, sets]) => ({
      size: Number(/(\d+)$/.exec(key)?.[1] ?? 0),
      options: Object.entries(sets)
        .map(([ids, [games, wins]]) => ({ itemIds: ids.split('_').map(Number).filter(Boolean), games, winRate: games ? wins / games : 0, pickRate: games / total }))
        .sort((a, b) => b.games - a.games),
    }))
    .filter(group => group.size > 0 && group.options.length > 0)
    .sort((a, b) => a.size - b.size)
  analytics.itemLists = {
    popular: (build.popularItem ?? []).map(itemRow),
    winning: (build.winningItem ?? []).map(itemRow),
    all: (build.item ?? []).map(itemRow),
  }
  analytics.counters = header.counters ? { strong: header.counters.strong, weak: header.counters.weak } : null
  const top = build.sidebar?.topStats
  analytics.best = top ? { winRate: rate(top.topwin), games: top.toppick, players: top.topcount, elo: top.topelo, expertRank: top.toprank } : null
  return analytics
}
