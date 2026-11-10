import type { ChampionMatchups, ChampionSummaryResponse, ChampionTierListResponse, ChampionTrendResponse } from '#shared/types/champions'
import type { ChampionBuildResponse } from '~/types/build'
import type { BuildOptions, ItemOption, Measure, RunePageOption, RuneShares, SlotGroup } from '~/utils/sources/model'
import { assemblePage, buildsFromOptions, liveRuneTree, measure, ranked, skillOption } from '~/utils/sources/model'
import { isBoots } from '~/utils/blitz/builds'
import { isQuestReward, questRewardsOf, rewardPlace } from '~/utils/support-quest'
import { STARTER_LINE } from '~/utils/item-groups'
import { championSlug, currentPatch } from '~/utils/sources/champions'
import { keepBounded } from '~/utils/bounded'
import { dataWindow, previousPatch } from '~/utils/data-window'
import { SOURCE_ELO_BRACKET } from '~/utils/data-source'

/**
 * lolalytics (experimental): the public endpoint its own pages read
 * (`a1.lolalytics.com/mega/?ep=…`), which it does not document — it may change
 * without notice, hence the label in Settings. One read per champion and lane
 * (`build-full`) carries everything: stats, every rune and shard, items slot by
 * slot, spells, starters, skills, every lane's matchups, the trend by elo,
 * objectives, game length, the top players. The tier lists are one more
 * (`tier`). Inside Tauri the shell reads it (`source_get`); in `npm run dev`
 * the dev server's `/__lolalytics` proxy does.
 */

type Row = [number | string, number, number, number, number?]

export interface LolalyticsSummary {
  skillpriority?: { id: string, n: number, wr: number }
  skillorder?: { id: number, n: number, wr: number }
  sums?: { ids: number[], n: number, wr: number }
  runes?: { wr: number, n: number, set: { pri: number[], sec: number[], mod: number[] } }
  items?: {
    start?: { n: number, wr: number, set: number[] }
    core?: { set: number[], wr: number, n: number }
    item4?: { id: number, n: number, wr: number }[]
    item5?: { id: number, n: number, wr: number }[]
    item6?: { id: number, n: number, wr: number }[]
  }
}

export interface LolalyticsBuild {
  header: { patch: string, lane?: string, n: number, wr: number, pr: number, br: number, tier: string, rank: number, rankTotal: number, avgWr: number, topWin?: number, topElo?: string, damage?: Record<string, number>, counters?: { strong: number[], weak: number[] } }
  runes: { stats: Record<string, [number, number, number][]> }
  spells?: [string, number, number, number][]
  startSet?: [string, number, number, number][]
  boots?: Row[]
  item1?: Row[]
  item2?: Row[]
  item3?: Row[]
  item4?: Row[]
  item5?: Row[]
  /** A support's quest reward picked: `[id, win rate, pick rate, games]`, id 0 for none. */
  supportItem?: Row[]
  builtBootSet3?: [string, number, number, number][]
  skillOrder?: [string, number, number, number][]
  skill15?: [number, number, number, number][]
  skillEarly?: [number, number, number][][]
  enemy?: Record<string, [number, number, number, number, number, number][]>
  graph?: { dates: string[], wr: Record<string, number[]>, pr: Record<string, number[]>, br: Record<string, number[]>, n: Record<string, number[]> }
  nav?: { lanes: Record<string, number> }
  summary?: Record<'pick' | 'win', LolalyticsSummary>
  skill6?: [number, number, number, number][]
  skill10?: [number, number, number, number][]
  /** Every starting item, every item bought by ten minutes, and the items most bought, winning most, and all: `[id, win rate, pick rate, games, minute?]`. */
  startItem?: Row[]
  earlyItem?: Row[]
  popularItem?: Row[]
  winningItem?: Row[]
  item?: Row[]
  /** The sets of one, two and three items actually built, boots included: `{ "a_b": [games, wins] }`. */
  itemSets?: Record<string, Record<string, [number, number]>>
  sidebar?: {
    /** The best players on the champion over the last seven days. */
    topStats?: { toppick: number, toprank: number, topcount: number, topwin: number, topelo: string }
    depth?: [number, number, string, string, string]
    stats?: { stats: [string, number, number, number, number][] }
    topList?: [number, string, string, string, string, string, string, Record<string, string>][]
    time?: { time: Record<string, number>, timeWin: Record<string, number> }
    objective?: Record<string, number[]>
  }
  analysed?: number
}

const LANE: Record<string, string> = { TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'middle', BOTTOM: 'bottom', UTILITY: 'support' }
const POSITION: Record<string, string> = { top: 'TOP', jungle: 'JUNGLE', middle: 'MIDDLE', bottom: 'BOTTOM', support: 'UTILITY' }
export const lolalyticsLane = (position: string) => LANE[position] ?? 'middle'

/** TrueMain's elo bracket as lolalytics' tier: `MASTER_PLUS` is `master_plus`, every tier is `all`; none reads lolalytics' own default, Emerald+ (`SOURCE_ELO_BRACKET`). */
export function lolalyticsTier(eloBracket: unknown): string {
  const bracket = typeof eloBracket === 'string' && eloBracket ? eloBracket : SOURCE_ELO_BRACKET
  return bracket.toLowerCase()
}

/**
 * The games lolalytics reads (`patch=`, Settings' window, `utils/data-window.ts`):
 * a patch (`16.21`), or none for the current one. `auto` takes the current
 * patch once it holds a quarter of the one before's games, and the one before
 * until then: asked once a session, across every champion.
 */
let windowParam: Promise<string | null> | null = null
function lolalyticsWindow(): Promise<string | null> {
  if (!windowParam) {
    windowParam = (async () => {
      const chosen = dataWindow.value
      if (chosen === 'current') return null
      if (chosen.startsWith('patch:')) return chosen.slice('patch:'.length)
      const previous = previousPatch(await currentPatch())
      if (chosen === 'previous' || !previous) return previous
      const probe = (patch?: string) => fetchRaw<{ analysed?: number }>({ ep: 'build-full', c: 'ahri', lane: 'middle', tier: 'emerald_plus', ...(patch ? { patch } : {}) })
      const [now, before] = await Promise.all([probe(), probe(previous)])
      return (now.analysed ?? 0) >= (before.analysed ?? 0) * 0.25 ? null : previous
    })()
    windowParam.catch(() => (windowParam = null))
  }
  return windowParam
}

/** The patch a read without one reads: the window's (Settings), else the live one, as `16.22`. */
async function patchRead(): Promise<string> {
  const window = await lolalyticsWindow().catch(() => null)
  return window && window.includes('.') ? window : (await currentPatch()).split('.').slice(0, 2).join('.')
}

/** A patch the page picked (`16.22.1`, `16.22`) as lolalytics names it; null for none. */
const pickedPatch = (value: unknown) => (typeof value === 'string' && /^\d+\.\d+/.test(value) ? value.split('.').slice(0, 2).join('.') : null)

async function read<T>(query: Record<string, string>): Promise<T> {
  const patch = await lolalyticsWindow().catch(() => null)
  return await fetchRaw<T>(patch ? { patch, ...query } : query)
}

async function fetchRaw<T>(query: Record<string, string>): Promise<T> {
  const full = { p: 'd', v: '1', queue: '420', region: 'all', ...query }
  if (insideTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<T>('source_get', { source: 'lolalytics', path: '', query: Object.entries(full) })
  }
  return await $fetch<T>('/__lolalytics', { query: full })
}

const builds = new Map<string, Promise<LolalyticsBuild | null>>()

/** The whole `build-full` read for a champion's lane, kept for the session; null when lolalytics has no such champion. */
/** lolalytics' regions: `all` (global) or one server. */
export const LOLALYTICS_REGIONS = ['all', 'br', 'na', 'euw', 'eune', 'kr', 'lan', 'las', 'oce', 'tr', 'ru', 'jp', 'vn', 'tw', 'sg', 'ph', 'th', 'me'] as const

export function readLolalyticsBuild(championId: number, position: string, eloBracket?: unknown, region = 'all', patch?: string): Promise<LolalyticsBuild | null> {
  const key = `${championId}:${position}:${lolalyticsTier(eloBracket)}:${region}:${patch ?? ''}`
  let answer = builds.get(key)
  if (!answer) {
    answer = championSlug(championId).then(async (slug) => {
      if (!slug) return null
      const read_ = await read<LolalyticsBuild & { status?: number }>({ ep: 'build-full', c: slug, lane: lolalyticsLane(position), tier: lolalyticsTier(eloBracket), region, ...(patch ? { patch } : {}) })
      return read_.header ? read_ : null
    })
    answer.catch(() => builds.delete(key))
    keepBounded(builds, key, answer)
  }
  return answer
}

/** lolalytics writes rates as percentages: 53.2 is 0.532. */
const rate = (percent: number) => percent / 100
const option = (wr: number, pr: number, n: number): Measure => measure(n, rate(wr), rate(pr))

const OFFENSE = new Set([5005, 5007, 5008])
const DEFENSE = new Set([5001, 5011, 5013])

/**
 * Each rune's share: a rune lolalytics counts twice was taken in the primary
 * tree (first) or as a secondary pick (second); a keystone or a shard once.
 * A flex shard carries an `f` after its id.
 */
function sharesOf(build: LolalyticsBuild): RuneShares {
  const primary = new Map<number, Measure>()
  const secondary = new Map<number, Measure>()
  const shards: RuneShares['shards'] = [new Map(), new Map(), new Map()]
  for (const [key, entries] of Object.entries(build.runes?.stats ?? {})) {
    const id = Number.parseInt(key, 10)
    const [first, second] = entries
    if (!first) continue
    if (key.endsWith('f')) shards[1].set(id, option(first[1], first[0], first[2]))
    else if (OFFENSE.has(id)) shards[0].set(id, option(first[1], first[0], first[2]))
    else if (DEFENSE.has(id)) shards[2].set(id, option(first[1], first[0], first[2]))
    else {
      primary.set(id, option(first[1], first[0], first[2]))
      if (second) secondary.set(id, option(second[1], second[0], second[2]))
    }
  }
  return { primary, secondary, shards }
}

const itemRows = (rows: Row[] | undefined): ItemOption[] =>
  (rows ?? []).filter(row => Number(row[0]) > 0).map(row => ({ ...option(row[1], row[2], row[3]), itemIds: [Number(row[0])] }))

/**
 * lolalytics counts the games without boots as an item of its own, `9999`:
 * not an item to buy. When it is the most played (Yuumi, Cassiopeia), the
 * champion buys none, and no pair is offered.
 */
const NO_BOOTS = 9999
const bootsRows = (rows: Row[] | undefined): ItemOption[] => {
  const options = itemRows(rows)
  if ([...options].sort((a, b) => b.games - a.games)[0]?.itemIds[0] === NO_BOOTS) return []
  return ranked(options.filter(option => option.itemIds[0] !== NO_BOOTS), 3)
}

const setRows = (rows: [string, number, number, number][] | undefined): ItemOption[] =>
  (rows ?? []).map(row => ({ ...option(row[1], row[2], row[3]), itemIds: String(row[0]).split('_').map(Number).filter(Boolean) }))

/**
 * The cores without a support's quest reward — lolalytics counts it as the
 * first item (Lulu's `3870_3504_3158`: Dream Maker, Ardent Censer, Ionian
 * Boots), but it is picked, not bought — those then alike as one, games
 * added and wins weighed.
 */
function boughtCores(cores: ItemOption[]): ItemOption[] {
  const merged = new Map<string, ItemOption>()
  for (const core of cores) {
    const itemIds = core.itemIds.filter(id => !isQuestReward(id))
    const key = itemIds.join('_')
    const known = merged.get(key)
    const games = (known?.games ?? 0) + core.games
    merged.set(key, known
      ? { itemIds, games, pickRate: known.pickRate + core.pickRate, winRate: games ? (known.winRate * known.games + core.winRate * core.games) / games : 0 }
      : { ...core, itemIds })
  }
  return [...merged.values()]
}

export async function lolalyticsOptionsOf(build: LolalyticsBuild): Promise<BuildOptions> {
  const tree = await liveRuneTree()
  const shares = sharesOf(build)
  const keystones = tree.styles.flatMap(style => style.keystones)
  const pages: RunePageOption[] = ranked(keystones.filter(id => shares.primary.has(id)).map(id => ({ id, ...shares.primary.get(id)! })), 3)
    .flatMap((keystone) => {
      const page = assemblePage(keystone.id, () => shares, tree)
      return page ? [{ games: keystone.games, pickRate: keystone.pickRate, winRate: keystone.winRate, page }] : []
    })
  // Each place of the buying order, the first completed item first: a support's first, its quest's reward, is no place.
  const measured = [build.item1, build.item2, build.item3, build.item4, build.item5].map(itemRows)
  const places = (rewardPlace(measured[0] ?? []) ? measured.slice(1) : measured).map(list => list.filter(entry => !isQuestReward(entry.itemIds[0]!)))
  const cores = ranked(boughtCores(setRows(build.builtBootSet3)), 5)
  // What follows a core, place by place: the item after its last completed one (Ashe's third after Hexoptics C44 and
  // Phantom Dancer, her boots among them), each slot numbered as the core's items and boots are counted.
  const followUps = (core: ItemOption | null): SlotGroup[] => {
    const path = core ?? cores[0]
    if (!path) return []
    const done = path.itemIds.filter(id => !isBoots(id)).length
    return places.slice(done)
      .map((list, index) => ({ slot: path.itemIds.length + 1 + index, options: ranked(list, 4) }))
      .filter(group => group.options.length > 0)
  }
  return {
    patch: build.header.patch,
    games: build.header.n,
    pages,
    shares: () => shares,
    spells: ranked((build.spells ?? []).map(row => ({ ...option(row[1], row[2], row[3]), spellIds: row[0].split('_').map(Number) })), 3),
    starters: ranked(setRows(build.startSet), 3),
    boots: bootsRows(build.boots),
    cores,
    followUps,
    skills: ranked((build.skill15 ?? []).map(row => skillOption(String(row[0]).split('').map(Number), option(row[1], row[2], row[3]))), 3),
    priorities: ranked((build.skillOrder ?? []).map(row => ({ ...option(row[1], row[2], row[3]), order: row[0].split('') })), 3),
    // Every item bought, the support quest's line and the jungle pets apart: bought at the start, never a choice later.
    situational: itemRows(build.item).filter(entry => !STARTER_LINE.has(entry.itemIds[0]!)),
    places,
    questRewards: questRewardsOf(itemRows(build.supportItem), build.header.lane === 'support'),
  }
}

export async function lolalyticsOptions(championId: number, position: string): Promise<BuildOptions | null> {
  const build = await readLolalyticsBuild(championId, position)
  return build ? await lolalyticsOptionsOf(build) : null
}

export async function lolalyticsBuilds(championId: number, position: string): Promise<ChampionBuildResponse> {
  return buildsFromOptions(championId, position, await lolalyticsOptions(championId, position))
}

/** lolalytics grades a champion on a lane S+ to D- in 15 steps (`tier` keys 1–15); TrueMain names five, S to D. */
const GRADES = ['S+', 'S', 'S-', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-']

interface TierAnswer {
  analysed: number
  tier: Record<string, { lane: Record<string, { cid: Record<string, { rank: number, pctLane: number, wr: number, pr: number, br: number, games: number }> }> }>
}

export async function lolalyticsRows(query: Record<string, unknown>): Promise<ChampionSummaryResponse[]> {
  const position = typeof query.position === 'string' && query.position ? query.position : null
  // The patch picked on the page wins over the window; the list says which patch it is.
  const picked = pickedPatch(query.patch)
  const [answer, patch] = await Promise.all([
    read<TierAnswer>({ ep: 'tier', lane: position ? lolalyticsLane(position) : 'all', tier: lolalyticsTier(query.eloBracket), ...(picked ? { patch: picked } : {}) }),
    picked ?? patchRead(),
  ])
  const now = new Date().toISOString()
  return Object.entries(answer.tier ?? {}).flatMap(([grade, group]) => {
    const step = Number(grade)
    const letter = (GRADES[step - 1] ?? 'D')[0]!
    return Object.entries(group.lane ?? {}).flatMap(([lane, { cid }]) => Object.entries(cid ?? {}).map(([id, entry]) => ({
      championId: Number(id),
      games: entry.games,
      wins: Math.round(entry.games * rate(entry.wr)),
      winRate: rate(entry.wr),
      pickRate: rate(entry.pr),
      lanePlayRate: rate(entry.pctLane),
      trueMainCount: 0,
      banRate: rate(entry.br),
      tier: letter,
      // Higher is better: S+ scores 15, D- 1.
      tierScore: 16 - step,
      position: POSITION[lane] ?? lane.toUpperCase(),
      patchVersion: patch,
      lastUpdatedAtUtc: now,
      topBuild: null,
    })))
  })
}

export async function lolalyticsTierList(query: Record<string, unknown>): Promise<ChampionTierListResponse> {
  const position = typeof query.position === 'string' && query.position ? query.position : null
  // Across every lane, only the lanes that make up a real share of the champion's games (`pctLane`, as a fraction).
  const rows = (await lolalyticsRows(query)).filter(row => position !== null || row.lanePlayRate >= 0.08)
  const tiers = ['S', 'A', 'B', 'C', 'D'].map(tier => ({
    tier,
    entries: rows.filter(row => row.tier === tier).sort((a, b) => b.tierScore - a.tierScore || b.winRate - a.winRate)
      .map(row => ({ championId: row.championId, position: row.position, games: row.games, winRate: row.winRate, pickRate: row.pickRate, banRate: row.banRate })),
  })).filter(group => group.entries.length > 0)
  return { patchVersion: rows[0]?.patchVersion ?? await currentPatch(), position, tiers }
}

/** Every opponent on the lane: lolalytics' `enemy` rows are `[id, win rate, delta 1, delta 2, pick rate, games]`. */
export async function lolalyticsMatchups(championId: number, query: Record<string, unknown>): Promise<ChampionMatchups> {
  const position = typeof query.position === 'string' && query.position ? query.position : 'MIDDLE'
  const build = await readLolalyticsBuild(championId, position, query.eloBracket)
  const opponent = Number(query.opponent) || null
  const matchups = (build?.enemy?.[lolalyticsLane(position)] ?? [])
    .filter(row => opponent === null || row[0] === opponent)
    .map(([id, wr, , , pr, n]) => ({
      opponentChampionId: id,
      games: n,
      wins: Math.round(n * rate(wr)),
      winRate: rate(wr),
      playRate: rate(pr),
      winRateLowerBound: 0,
      winRateUpperBound: 1,
      laneWinRate: null,
      decidedLaneGames: 0,
      averageGoldDiffAt15: null,
      goldDiffLaneGames: 0,
      averageXpDiffAt15: null,
      xpDiffLaneGames: 0,
    }))
  return { championId, position, patch: build?.header.patch ?? null, matchups }
}

/**
 * The champion's figures patch by patch, as the champion page reads them (its
 * current point, and the one before for the change): the patch the window
 * reads, whole — the same figures the tier list shows —, and the patch before
 * it. lolalytics' own chart is by day; its last day is a few hundred games,
 * no figure for a page to lead with.
 */
export async function lolalyticsTrend(championId: number, query: Record<string, unknown>): Promise<ChampionTrendResponse> {
  const position = typeof query.position === 'string' && query.position ? query.position : 'MIDDLE'
  const build = await readLolalyticsBuild(championId, position, query.eloBracket)
  const header = build?.header
  if (!header) return { championId, position, points: [] }
  const point = (from: LolalyticsBuild['header']) => ({ patch: from.patch, winRate: rate(from.wr), pickRate: rate(from.pr), banRate: rate(from.br), games: from.n })
  const before = String(header.patch).includes('.') ? previousPatch(`${header.patch}.1`) : null
  const earlier = before ? await readLolalyticsBuild(championId, position, query.eloBracket, 'all', before).catch(() => null) : null
  return { championId, position, points: [...(earlier?.header ? [point(earlier.header)] : []), point(header)] }
}

/** The allies on every lane (`build-team`): `[id, win rate, delta 1, delta 2, pick rate, games]` per lane. */
export interface LolalyticsTeam { team?: Record<string, [number, number, number, number, number, number][]> }

const teams = new Map<string, Promise<LolalyticsTeam | null>>()

export function readLolalyticsTeam(championId: number, position: string, eloBracket?: unknown, region = 'all'): Promise<LolalyticsTeam | null> {
  const key = `${championId}:${position}:${lolalyticsTier(eloBracket)}:${region}`
  let answer = teams.get(key)
  if (!answer) {
    answer = championSlug(championId).then(slug => (slug ? read<LolalyticsTeam>({ ep: 'build-team', c: slug, lane: lolalyticsLane(position), tier: lolalyticsTier(eloBracket), region }) : null))
    answer.catch(() => teams.delete(key))
    keepBounded(teams, key, answer)
  }
  return answer
}
