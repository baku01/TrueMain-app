import type { ChampionMatchups, ChampionSummaryResponse, ChampionTierListResponse, ChampionTrendResponse } from '#shared/types/champions'
import type { ChampionBuildResponse } from '~/types/build'
import type { BuildOptions, ItemOption, Measure, RunePageOption } from '~/utils/sources/model'
import { isBoots } from '~/utils/blitz/builds'
import { buildsFromOptions, liveRuneTree, measure, ranked, skillOption } from '~/utils/sources/model'
import { currentPatch } from '~/utils/sources/champions'
import { keepBounded } from '~/utils/bounded'

/**
 * Tencent (experimental): the guides lol.qq.com's own champion pages load —
 * Chinese servers, refreshed daily, read off public scripts it does not
 * document. One script per champion (`champDetail_<id>.js`) carries every lane:
 * its figures, whole rune pages, spells, starters, boots, three-item cores,
 * skill orders, its matchups and its win rate by game length. The tier list is
 * one more (`guideschampion_rank.js`). Inside Tauri the shell reads them
 * (`source_get`, which unwraps the script's object); in `npm run dev` the dev
 * server's `/__tencent` proxy does, and the object is unwrapped here.
 */

/** Tencent writes counts and rates as strings, rates in ten-thousandths: "5104" is 0.5104. */
type Num = string | number

interface Entry { igamecnt: Num, wincnt: Num, winrate: Num, showrate: Num }
type Ranked<T> = Record<string, T & Entry>

export interface TencentLane {
  gameversion: string
  igamecnt: Num
  wincnt: Num
  lanewinrate: Num
  lanshowrate: Num
  champlanorder: Num
  /** JSON strings, each a ranked list (`"1"`, `"2"`…). */
  perkdetail: string
  spellidjson: string
  itemoutjson: string
  core3itemjson: string
  shoesjson: string
  skilljson: string
  kills: Num
  deaths: Num
  assists: Num
  goldearnedpergame: Num
  minionskilled: Num
}

export interface TencentFight { championid2: Num, igamecnt: Num, iwincnt: Num, winrate: Num, gamerate: Num, goldpermin: Num, kda: Num }

export interface TencentDetail {
  championLane: Record<string, TencentLane>
  championFight: Record<string, TencentFight[]>
  /** `playtime_json`: by game length, `"wins|games|win rate"` per band. */
  championTrend: Record<string, { playtime_json: string }>
}

interface RankAnswer {
  list: Record<string, { winrate: Num, showrate: Num, banrate: Num, lanes: string } & Record<string, { lanewinrate: Num, lanshowrate: Num, champlanorder: Num } | string | Num>>
}

const LANE: Record<string, string> = { TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'mid', BOTTOM: 'bottom', UTILITY: 'support' }
export const TENCENT_POSITION: Record<string, string> = { top: 'TOP', jungle: 'JUNGLE', mid: 'MIDDLE', bottom: 'BOTTOM', support: 'UTILITY' }
export const tencentLane = (position: string) => LANE[position] ?? 'mid'

export const num = (value: Num | undefined) => Number(value ?? 0) || 0
export const rate = (value: Num | undefined) => num(value) / 10_000
const ids = (joined: string) => joined.split('&').map(Number).filter(Boolean)
const entryMeasure = (entry: Entry): Measure => measure(num(entry.igamecnt), rate(entry.winrate), rate(entry.showrate))

/** A ranked list, written as a JSON string of `{ "1": …, "2": … }`; best first. */
export function rankedList<T>(json: string | undefined): (T & Entry)[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json) as Ranked<T>
    return Object.keys(parsed).sort((a, b) => Number(a) - Number(b)).map(key => parsed[key]!)
  }
  catch {
    return []
  }
}

/** The script's object, from its first brace: `var X={…};/* … *\/`. */
export function scriptObject<T>(text: string): T {
  const start = text.indexOf('{')
  if (start < 0) throw new Error('no object in the script')
  let depth = 0
  let quoted = false
  for (let index = start; index < text.length; index++) {
    const char = text[index]
    if (quoted) {
      if (char === '\\') index++
      else if (char === '"') quoted = false
    }
    else if (char === '"') quoted = true
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) return JSON.parse(text.slice(start, index + 1)) as T
  }
  throw new Error('the script\'s object never closes')
}

async function read<T>(path: string): Promise<T> {
  if (insideTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<T>('source_get', { source: 'tencent', path, query: [] })
  }
  return scriptObject<T>(await $fetch<string>(`/__tencent/${path}`, { responseType: 'text' }))
}

const details = new Map<number, Promise<TencentDetail | null>>()

/** A champion's whole guide, kept for the session; null when Tencent has none. */
export function readTencentDetail(championId: number): Promise<TencentDetail | null> {
  let answer = details.get(championId)
  if (!answer) {
    answer = read<{ list?: TencentDetail }>(`champDetail/champDetail_${championId}.js`).then(script => script.list?.championLane ? script.list : null)
    answer.catch(() => details.delete(championId))
    keepBounded(details, championId, answer)
  }
  return answer
}

/** A lane's guide, when Tencent measured the champion there. */
export async function readTencentLane(championId: number, position: string): Promise<TencentLane | null> {
  const lane = (await readTencentDetail(championId))?.championLane[tencentLane(position)]
  return lane && num(lane.igamecnt) > 0 ? lane : null
}

const itemOptions = (json: string, count: number, withoutBoots = false): ItemOption[] =>
  ranked(rankedList<{ itemid: string }>(json).map(entry => ({ ...entryMeasure(entry), itemIds: ids(entry.itemid).filter(id => !withoutBoots || !isBoots(id)) })).filter(option => option.itemIds.length), count)

/** A lane's guide as the build panel's options. A page's ids are `keystone&3 primary&2 secondary&offense&flex&defense`. */
export async function tencentOptionsOf(lane: TencentLane): Promise<BuildOptions> {
  const tree = await liveRuneTree()
  // Grouped by keystone and secondary tree, each group a ranked list of whole pages.
  const groups = rankedList<unknown>(lane.perkdetail) as unknown as Record<string, Entry & { perk: string }>[]
  const measured = groups.flatMap(group => Object.values(group)).map(entry => ({ ...entryMeasure(entry), perk: entry.perk }))
  const pages: RunePageOption[] = ranked(measured, 5).flatMap((entry) => {
    const [keystone, perk1, perk2, perk3, secondary1, secondary2, offense, flex, defense] = ids(entry.perk)
    const primary = tree.styles.find(style => style.keystones.includes(keystone ?? -1))
    const secondary = tree.styles.find(style => style.styleId !== primary?.styleId && style.subRows.flat().includes(secondary1 ?? -1))
    if (!primary || !secondary) return []
    return [{
      games: entry.games,
      pickRate: entry.pickRate,
      winRate: entry.winRate,
      page: {
        primaryStyleId: primary.styleId,
        primaryKeystoneId: keystone!,
        primaryPerk1Id: perk1 ?? 0,
        primaryPerk2Id: perk2 ?? 0,
        primaryPerk3Id: perk3 ?? 0,
        secondaryStyleId: secondary.styleId,
        secondaryPerk1Id: secondary1 ?? 0,
        secondaryPerk2Id: secondary2 ?? 0,
        statOffense: offense ?? 0,
        statFlex: flex ?? 0,
        statDefense: defense ?? 0,
      },
    }]
  })
  const games = num(lane.igamecnt)
  // Skill orders are grouped by their max order; each group's paths carry a share (`sk_s`) and win rate (`sk_w`) only.
  const skills = rankedList<{ sks: Record<string, { sk: string, sk_s: Num, sk_w: Num }> }>(lane.skilljson)
    .flatMap(group => Object.values(group.sks ?? {}))
    .map(path => skillOption(ids(path.sk), measure(Math.round(games * rate(path.sk_s)), rate(path.sk_w), rate(path.sk_s))))
  return {
    patch: lane.gameversion || null,
    games,
    pages,
    shares: null,
    spells: ranked(rankedList<{ spellid: string }>(lane.spellidjson).map(entry => ({ ...entryMeasure(entry), spellIds: ids(entry.spellid) })), 3),
    starters: itemOptions(lane.itemoutjson, 3),
    boots: itemOptions(lane.shoesjson, 3),
    cores: itemOptions(lane.core3itemjson, 5, true),
    followUps: () => [],
    skills: ranked(skills, 3),
  }
}

export async function tencentOptions(championId: number, position: string): Promise<BuildOptions | null> {
  const lane = await readTencentLane(championId, position)
  return lane ? await tencentOptionsOf(lane) : null
}

export async function tencentBuilds(championId: number, position: string): Promise<ChampionBuildResponse> {
  return buildsFromOptions(championId, position, await tencentOptions(championId, position))
}

/** The share of a lane's ranked champions each grade holds, best first: S the top tenth, D the last fifth. */
const GRADE_SHARES: [string, number][] = [['S', 0.1], ['A', 0.3], ['B', 0.6], ['C', 0.8], ['D', 1]]

let rankList: Promise<RankAnswer> | null = null
const readRank = () => {
  if (!rankList) {
    rankList = read<RankAnswer>('guideschampion_rank.js')
    rankList.catch(() => (rankList = null))
  }
  return rankList
}

/** One row per champion and lane Tencent ranks; it counts no games, so the rows carry none. */
export async function tencentRows(query: Record<string, unknown>): Promise<ChampionSummaryResponse[]> {
  const position = typeof query.position === 'string' && query.position ? query.position : null
  const [answer, patch] = await Promise.all([readRank(), currentPatch()])
  const now = new Date().toISOString()
  const byLane = new Map<string, { championId: number, banRate: number, lane: { lanewinrate: Num, lanshowrate: Num, champlanorder: Num } }[]>()
  for (const [id, champion] of Object.entries(answer.list ?? {})) {
    for (const lane of String(champion.lanes ?? '').split(',').filter(Boolean)) {
      const figures = champion[lane] as { lanewinrate: Num, lanshowrate: Num, champlanorder: Num } | undefined
      if (!figures || !num(figures.champlanorder)) continue
      const list = byLane.get(lane) ?? []
      list.push({ championId: Number(id), banRate: rate(champion.banrate), lane: figures })
      byLane.set(lane, list)
    }
  }
  return [...byLane].flatMap(([lane, list]) => {
    list.sort((a, b) => num(a.lane.champlanorder) - num(b.lane.champlanorder))
    return list.map((entry, index) => {
      const grade = GRADE_SHARES.find(([, share]) => (index + 1) / list.length <= share)?.[0] ?? 'D'
      return {
        championId: entry.championId,
        games: 0,
        wins: 0,
        winRate: rate(entry.lane.lanewinrate),
        pickRate: rate(entry.lane.lanshowrate),
        lanePlayRate: rate(entry.lane.lanshowrate),
        trueMainCount: 0,
        banRate: entry.banRate,
        tier: grade,
        // Higher is better: the lane's first scores its size, its last 1.
        tierScore: list.length - index,
        position: TENCENT_POSITION[lane] ?? lane.toUpperCase(),
        patchVersion: patch,
        lastUpdatedAtUtc: now,
        topBuild: null,
      }
    })
  }).filter(row => position === null || row.position === position)
}

export async function tencentTierList(query: Record<string, unknown>): Promise<ChampionTierListResponse> {
  const rows = await tencentRows(query)
  const position = typeof query.position === 'string' && query.position ? query.position : null
  const tiers = ['S', 'A', 'B', 'C', 'D'].map(tier => ({
    tier,
    entries: rows.filter(row => row.tier === tier).sort((a, b) => b.tierScore - a.tierScore)
      .map(row => ({ championId: row.championId, position: row.position, games: row.games, winRate: row.winRate, pickRate: row.pickRate, banRate: row.banRate })),
  })).filter(group => group.entries.length > 0)
  return { patchVersion: rows[0]?.patchVersion ?? await currentPatch(), position, tiers }
}

/** Every opponent on the lane (`championFight`): games, wins, and the share of the lane's games against it. */
export async function tencentMatchups(championId: number, query: Record<string, unknown>): Promise<ChampionMatchups> {
  const position = typeof query.position === 'string' && query.position ? query.position : 'MIDDLE'
  const detail = await readTencentDetail(championId)
  const opponent = Number(query.opponent) || null
  const matchups = (detail?.championFight[tencentLane(position)] ?? [])
    .filter(row => opponent === null || num(row.championid2) === opponent)
    .map(row => ({
      opponentChampionId: num(row.championid2),
      games: num(row.igamecnt),
      wins: num(row.iwincnt),
      winRate: rate(row.winrate),
      playRate: rate(row.gamerate),
      winRateLowerBound: 0,
      winRateUpperBound: 1,
      laneWinRate: null,
      decidedLaneGames: 0,
      averageGoldDiffAt15: null,
      goldDiffLaneGames: 0,
      averageXpDiffAt15: null,
      xpDiffLaneGames: 0,
    }))
  return { championId, position, patch: detail?.championLane[tencentLane(position)]?.gameversion ?? null, matchups }
}

/** Tencent keeps the day's figures only: the trend is that one point, the lane's games and rates on the patch. */
export async function tencentTrend(championId: number, query: Record<string, unknown>): Promise<ChampionTrendResponse> {
  const position = typeof query.position === 'string' && query.position ? query.position : 'MIDDLE'
  const [lane, rows] = await Promise.all([readTencentLane(championId, position), tencentRows({ position }).catch(() => [])])
  if (!lane) return { championId, position, points: [] }
  const games = num(lane.igamecnt)
  return {
    championId,
    position,
    points: [{
      patch: lane.gameversion,
      winRate: num(lane.wincnt) / games,
      pickRate: rate(lane.lanshowrate),
      banRate: rows.find(row => row.championId === championId)?.banRate ?? 0,
      games,
    }],
  }
}
