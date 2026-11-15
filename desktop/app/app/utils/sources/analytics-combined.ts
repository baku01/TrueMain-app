import type { ChampionAnalytics, LaneRows, MatchupRow } from '~/utils/sources/analytics'
import type { ItemOption, Measure } from '~/utils/sources/model'
import { summaryFromOptions } from '~/utils/sources/analytics'
import { weighedWinRate } from '~/utils/sources/model'
import { combineOptions, poolLists, poolMeasure, sameGames, sameScale, weightOf } from '~/utils/sources/combined'

/**
 * Several sources' analytics of one champion's lane as one page, section by
 * section, by `utils/sources/combined`'s rules: they count the same ranked
 * games, so a figure several measured is their mean — weighed by each one's
 * games and the sources' spread —, its games the largest source's, never the
 * sum; a source whose games, cell by cell, are another population's is left
 * out of that section (`sameGames`). What only one source measures (the
 * objectives, game length, the trend by elo, the skill levels…) is its own,
 * the first that has it — the order given, most complete first.
 */

const ids = (list: number[]) => list.join(',')
const games = <T extends Measure>(list: T[], key: (entry: T) => string) => new Map(list.map(entry => [key(entry), entry.games]))

/** Lists of one kind from several sources as one (`poolLists`), only the sources counting the same games (`sameGames`). */
function pooled<T extends Measure>(lists: T[][], key: (entry: T) => string): T[] {
  return poolLists(sameGames(lists.filter(list => list.length > 0), list => games(list, key)), key)
}

/** The first non-empty of a section, the order given. */
function first<T>(values: T[], empty: (value: T) => boolean): T {
  return values.find(value => !empty(value)) ?? values[0]!
}

/** Lane rows (opponents, allies) from several sources as one, lane by lane and champion by champion; a source's own deltas kept. */
function pooledLanes(answers: LaneRows[][]): LaneRows[] {
  const positions = [...new Set(answers.flatMap(lanes => lanes.map(lane => lane.position)))]
  return positions.map((position) => {
    const own = answers.map(lanes => (lanes.find(lane => lane.position === position)?.rows ?? []).filter(row => row.games > 0))
    // A share is pooled over the sources measuring it alike (`sameScale`); none is no share.
    const sharing = new Set(sameScale(own, rows => new Map(rows.map(row => [String(row.championId), row.pickRate ?? 0]))).flat())
    const lists = own.map(rows => rows.map(row => ({ ...row, pickRate: row.pickRate ?? 0 })))
    const rows = pooled(lists, row => String(row.championId)).map((row): MatchupRow => {
      const all = own.flat().filter(entry => entry.championId === row.championId)
      const known = all.flatMap(entry => (entry.pickRate === null || !sharing.has(entry) ? [] : [{ ...entry, pickRate: entry.pickRate }]))
      const pickRate = known.length ? poolMeasure(known).pickRate : null
      const deltas = all.find(entry => entry.delta1 !== undefined || entry.delta2 !== undefined)
      return { championId: row.championId, winRate: row.winRate, games: row.games, pickRate, ...(deltas?.delta1 !== undefined ? { delta1: deltas.delta1 } : {}), ...(deltas?.delta2 !== undefined ? { delta2: deltas.delta2 } : {}) }
    })
    return { position, rows: rows.sort((a, b) => b.games - a.games) }
  }).filter(lane => lane.rows.length > 0)
}

/** The weighted mean of the values given, each with its games; null for none. */
function mean(values: { value: number | null, games: number }[]): number | null {
  const known = values.filter((entry): entry is { value: number, games: number } => entry.value !== null && entry.games > 0)
  const total = known.reduce((sum, entry) => sum + weightOf(entry.games), 0)
  return total > 0 ? known.reduce((sum, entry) => sum + weightOf(entry.games) * entry.value, 0) / total : null
}

/** The answers' headers as one: the rates pooled, the games the largest source's, the grade and rank the first source's that gives them. */
function pooledHeader(answers: ChampionAnalytics[]): ChampionAnalytics['header'] {
  type Header = NonNullable<ChampionAnalytics['header']>
  const headers = sameGames(answers.flatMap(answer => (answer.header ? [answer.header] : [])), header => new Map([['lane', header.games]]))
  if (!headers.length) return null
  // The shares and the patch before from the sources measuring them alike (`sameScale`): Blitz's are another measure.
  const sharing = sameScale(headers, header => new Map([['lane', header.pickRate]]))
  const graded = headers.find(header => header.tier !== null) ?? headers[0]!
  const rate = (pick: (header: Header) => number | null, over: Header[] = headers) => mean(over.map(header => ({ value: pick(header), games: header.games })))
  return {
    ...graded,
    games: Math.max(...headers.map(header => header.games)),
    winRate: rate(header => header.winRate) ?? graded.winRate,
    pickRate: rate(header => header.pickRate, sharing) ?? graded.pickRate,
    banRate: rate(header => header.banRate, sharing),
    averageWinRate: headers.find(header => header.averageWinRate !== null)?.averageWinRate ?? null,
    previous: sharing.find(header => header.previous)?.previous ?? null,
  }
}

/**
 * The answers as one page. Against an opponent, only the answers read
 * against it (`versus`); the first answer alone, the lane's figures, when
 * none could be.
 */
export function combineAnalytics(answers: ChampionAnalytics[], opponentId: number | null = null): ChampionAnalytics {
  const read = opponentId === null ? answers : answers.filter(answer => answer.versus === opponentId)
  if (!read.length) return answers[0]!
  if (read.length === 1) return read[0]!
  const lead = read[0]!
  const options = combineOptions(...read.map(answer => answer.options))
  const own = read.find(answer => answer.options === options)
  const items = (pick: (answer: ChampionAnalytics) => ItemOption[]) => pooled(read.map(pick), option => ids(option.itemIds))
  const slots = [...new Set(read.flatMap(answer => answer.itemSlots.map(slot => slot.slot)))].sort((a, b) => a - b)
  const sizes = [...new Set(read.flatMap(answer => answer.itemSets.map(set => set.size)))].sort((a, b) => a - b)
  const paths = (pick: (answer: ChampionAnalytics) => ChampionAnalytics['skillPaths']['priority'], key: (path: ChampionAnalytics['skillPaths']['priority'][number]) => string) =>
    pooled(read.map(pick), key)
  const runeIds = [...new Set(read.flatMap(answer => [...answer.runeStats.keys()]))]
  const rune = (id: number, side: 'primary' | 'secondary') => {
    const measures = read.flatMap(answer => (answer.runeStats.get(id)?.[side] ? [answer.runeStats.get(id)![side]!] : [])).filter((entry: Measure) => entry.games > 0)
    return measures.length ? poolMeasure(measures) : (read.find(answer => answer.runeStats.get(id)?.[side])?.runeStats.get(id)?.[side] ?? null)
  }
  return {
    ...lead,
    patch: read.find(answer => answer.patch)?.patch ?? null,
    versus: opponentId,
    header: pooledHeader(read),
    lanes: first(read.map(answer => answer.lanes), lanes => !lanes.length),
    options,
    // A source's own two builds when the options are its alone, else read from the pooled options.
    summary: own ? own.summary : options ? { common: summaryFromOptions(options, false), winning: summaryFromOptions(options, true) } : lead.summary,
    skillPaths: {
      priority: paths(answer => answer.skillPaths.priority, path => path.order.join('')),
      level6: paths(answer => answer.skillPaths.level6, path => ids(path.points)),
      level10: paths(answer => answer.skillPaths.level10, path => ids(path.points)),
      level15: paths(answer => answer.skillPaths.level15, path => ids(path.points)),
    },
    runeStats: new Map(runeIds.map(id => [id, { primary: rune(id, 'primary'), secondary: rune(id, 'secondary') }])),
    itemSlots: slots.map(slot => ({ slot, options: pooled(read.map(answer => answer.itemSlots.find(entry => entry.slot === slot)?.options ?? []), option => ids(option.itemIds)) }))
      .filter(slot => slot.options.length > 0),
    skillLevels: first(read.map(answer => answer.skillLevels), levels => !levels.length),
    matchups: pooledLanes(read.map(answer => answer.matchups)),
    synergies: pooledLanes(read.map(answer => answer.synergies)),
    objectives: first(read.map(answer => answer.objectives), list => !list.length),
    gameLength: first(read.map(answer => answer.gameLength), list => !list.length),
    trend: first(read.map(answer => answer.trend), trend => !trend.winRate.length),
    topPlayers: first(read.map(answer => answer.topPlayers), list => !list.length),
    damage: read.find(answer => answer.damage)?.damage ?? null,
    playerBase: read.find(answer => answer.playerBase)?.playerBase ?? null,
    stats: first(read.map(answer => answer.stats), list => !list.length),
    spellTable: pooled(read.map(answer => answer.spellTable), option => ids([...option.spellIds].sort((a, b) => a - b))),
    startingSets: items(answer => answer.startingSets),
    startingItems: items(answer => answer.startingItems),
    earlyItems: items(answer => answer.earlyItems),
    itemSets: sizes.map(size => ({ size, options: items(answer => answer.itemSets.find(set => set.size === size)?.options ?? []).sort((a, b) => b.games - a.games) }))
      .filter(set => set.options.length > 0),
    itemLists: {
      popular: items(answer => answer.itemLists.popular),
      winning: items(answer => answer.itemLists.winning).sort((a, b) => weighedWinRate(b) - weighedWinRate(a)),
      all: items(answer => answer.itemLists.all),
    },
    counters: read.find(answer => answer.counters)?.counters ?? null,
    best: read.find(answer => answer.best)?.best ?? null,
  }
}
