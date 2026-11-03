import type { ChampionMatchups, ChampionTierListResponse, ChampionTrendResponse, ChampionSummaryResponse } from '#shared/types/champions'
import type { ChampionBuildResponse } from '~/types/build'
import type { BuildOptions, ItemOption, RunePageOption, SkillOption, SlotGroup, SpellOption } from '~/utils/sources/model'
import type { OpggValue } from '~/utils/sources/opgg-format'
import { buildsFromOptions, measure, skillOption } from '~/utils/sources/model'
import { parseOpgg } from '~/utils/sources/opgg-format'
import { championIdOf, championSlug, currentPatch } from '~/utils/sources/champions'
import { keepBounded } from '~/utils/bounded'

/**
 * op.gg through its official API (its MCP server, which op.gg publishes for
 * third parties): a champion's analysis on a lane — stats, rune pages, items
 * slot by slot, spells, skills, counters, trend — and the lanes' tier lists.
 * Inside Tauri the shell calls it (`opgg_call` in `sources.rs`); in
 * `npm run dev` the dev server's `/__opgg` proxy does.
 */

export type Obj = Record<string, OpggValue>
export const asList = (value: OpggValue | undefined): Obj[] =>
  (Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : []).filter((entry): entry is Obj => !!entry && typeof entry === 'object' && !Array.isArray(entry))
export const num = (value: OpggValue | undefined) => (typeof value === 'number' ? value : 0)
const ids = (value: OpggValue | undefined) => (Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : [])

/** One call to op.gg's API, its answer read back into objects. */
export async function callOpgg(tool: string, args: Record<string, unknown>): Promise<Obj> {
  let text: string
  if (insideTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    text = await invoke<string>('opgg_call', { tool, arguments: args })
  }
  else {
    const body = await $fetch<string>('/__opgg', {
      method: 'POST',
      headers: { Accept: 'application/json, text/event-stream' },
      body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } },
      responseType: 'text',
    })
    const json = body.split('\n').find(line => line.startsWith('data:'))?.slice(5) ?? body
    const reply = JSON.parse(json) as { result?: { isError?: boolean, content?: { text?: string }[] } }
    text = reply.result?.content?.[0]?.text ?? ''
    if (reply.result?.isError) throw new Error(`op.gg answered ${text}`)
  }
  const parsed = parseOpgg(text)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Obj : {}
}

/** TrueMain's lanes as op.gg names them. */
const LANE: Record<string, string> = { TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'mid', BOTTOM: 'adc', UTILITY: 'support' }
export const POSITION: Record<string, string> = { top: 'TOP', jungle: 'JUNGLE', mid: 'MIDDLE', adc: 'BOTTOM', support: 'UTILITY' }

/** TrueMain's elo bracket as op.gg's tier filter: `MASTER_PLUS` is `master_plus`; every tier is no filter. */
function opggTier(eloBracket: unknown): string | undefined {
  const bracket = typeof eloBracket === 'string' && eloBracket ? eloBracket : 'MASTER_PLUS'
  return bracket === 'ALL' ? undefined : bracket.toLowerCase()
}

/** op.gg grades a champion 0 (OP) or 1 (best) to 5; TrueMain names the steps S to D. */
const tierLetter = (tier: number) => ['S', 'S', 'A', 'B', 'C', 'D'][Math.min(Math.max(Math.round(tier), 0), 5)]!

const analyses = new Map<string, Promise<Obj | null>>()

/** A champion's analysis on a lane, kept for the session: the panel, the list and the matchups all read it. */
export function analysis(championId: number, position: string, eloBracket?: unknown): Promise<Obj | null> {
  const tier = opggTier(eloBracket)
  const key = `${championId}:${position}:${tier ?? 'all'}`
  let answer = analyses.get(key)
  if (!answer) {
    answer = championSlug(championId).then(async (slug) => {
      if (!slug) return null
      const read = await callOpgg('lol_get_champion_analysis', {
        game_mode: 'ranked',
        champion: slug.toUpperCase(),
        position: LANE[position] ?? 'mid',
        ...(tier ? { tier } : {}),
      })
      return (read.data as Obj | undefined) ?? null
    })
    answer.catch(() => analyses.delete(key))
    keepBounded(analyses, key, answer)
  }
  return answer
}

/** An option's games and rates: op.gg counts games played and won, and a share of the lane. */
export const measured = (entry: Obj) => measure(num(entry.play), num(entry.play) > 0 ? num(entry.win) / num(entry.play) : 0, num(entry.pick_rate))

export const items = (value: OpggValue | undefined): ItemOption[] => asList(value).map(entry => ({ ...measured(entry), itemIds: ids(entry.ids) }))

export function optionsOf(data: Obj): BuildOptions {
  const summary = data.summary as Obj | undefined
  const average = summary?.average_stats as Obj | undefined
  const pages: RunePageOption[] = asList(data.runes).map((entry) => {
    const primary = ids(entry.primary_rune_ids)
    const secondary = ids(entry.secondary_rune_ids)
    const shards = ids(entry.stat_mod_ids)
    return {
      ...measured(entry),
      page: {
        primaryStyleId: num(entry.primary_page_id),
        primaryKeystoneId: primary[0] ?? 0,
        primaryPerk1Id: primary[1] ?? 0,
        primaryPerk2Id: primary[2] ?? 0,
        primaryPerk3Id: primary[3] ?? 0,
        secondaryStyleId: num(entry.secondary_page_id),
        secondaryPerk1Id: secondary[0] ?? 0,
        secondaryPerk2Id: secondary[1] ?? 0,
        statOffense: shards[0] ?? 0,
        statFlex: shards[1] ?? 0,
        statDefense: shards[2] ?? 0,
      },
    }
  })
  const spells: SpellOption[] = asList(data.summoner_spells).map(entry => ({ ...measured(entry), spellIds: ids(entry.ids) }))
  const LETTER: Record<string, number> = { Q: 1, W: 2, E: 3, R: 4 }
  const orders = asList((asList(data.skill_masteries)[0]?.builds) as OpggValue).length
    ? asList(asList(data.skill_masteries)[0]!.builds)
    : asList(data.skills)
  const skills: SkillOption[] = orders.map(entry => skillOption(
    (Array.isArray(entry.order) ? entry.order : []).map(letter => LETTER[String(letter)] ?? 0),
    measured(entry),
  ))
  const slots: SlotGroup[] = [
    { slot: 4, options: items(data.fourth_items) },
    { slot: 5, options: items(data.fifth_items) },
    { slot: 6, options: items(data.sixth_items) },
  ].filter(group => group.options.length > 0)
  return {
    patch: (asList((data.trends as Obj | undefined)?.win)[0]?.version as string | undefined) ?? null,
    games: num(average?.play),
    pages,
    shares: null,
    spells,
    starters: items(data.starter_items),
    boots: items(data.boots),
    cores: items(data.core_items),
    followUps: () => slots,
    skills,
  }
}

export async function opggOptions(championId: number, position: string): Promise<BuildOptions | null> {
  const data = await analysis(championId, position)
  return data ? optionsOf(data) : null
}

export async function opggBuilds(championId: number, position: string): Promise<ChampionBuildResponse> {
  return buildsFromOptions(championId, position, await opggOptions(championId, position))
}

/** The lanes' tier lists: one row per champion and lane, the rows a tier list and the champions list are made of. */
export async function opggRows(query: Record<string, unknown>): Promise<ChampionSummaryResponse[]> {
  const [answer, patch] = await Promise.all([callOpgg('lol_list_lane_meta_champions', { position: 'all' }), currentPatch()])
  const lanes = ((answer.data as Obj | undefined)?.positions as Obj | undefined) ?? {}
  const now = new Date().toISOString()
  const rows = await Promise.all(Object.entries(lanes).flatMap(([lane, list]) => asList(list).map(async (entry): Promise<ChampionSummaryResponse | null> => {
    const championId = typeof entry.champion === 'number' ? entry.champion : await championIdOf(String(entry.champion ?? ''))
    if (championId === null || entry.is_rip === true) return null
    const games = num(entry.play)
    const grade = num(entry.tier)
    return {
      championId,
      games,
      wins: Math.round(games * num(entry.win_rate)),
      winRate: num(entry.win_rate),
      pickRate: num(entry.pick_rate),
      lanePlayRate: num(entry.role_rate),
      trueMainCount: 0,
      banRate: num(entry.ban_rate),
      tier: tierLetter(grade),
      tierScore: 6 - Math.max(grade, 1),
      position: POSITION[lane] ?? lane.toUpperCase(),
      patchVersion: patch,
      lastUpdatedAtUtc: now,
      topBuild: null,
    }
  })))
  const position = typeof query.position === 'string' && query.position ? query.position : null
  return rows.filter((row): row is ChampionSummaryResponse => row !== null && (position === null || row.position === position))
}

export async function opggTierList(query: Record<string, unknown>): Promise<ChampionTierListResponse> {
  const rows = await opggRows(query)
  const position = typeof query.position === 'string' && query.position ? query.position : null
  const tiers = ['S', 'A', 'B', 'C', 'D'].map(tier => ({
    tier,
    entries: rows.filter(row => row.tier === tier).sort((a, b) => b.winRate - a.winRate)
      .map(row => ({ championId: row.championId, position: row.position, games: row.games, winRate: row.winRate, pickRate: row.pickRate, banRate: row.banRate })),
  })).filter(group => group.entries.length > 0)
  return { patchVersion: rows[0]?.patchVersion ?? await currentPatch(), position, tiers }
}

/**
 * A champion's matchups as op.gg's analysis lists them: its strongest and
 * weakest opponents and the lane's common ones — a handful, not every
 * opponent; op.gg's API gives no more.
 */
export async function opggMatchups(championId: number, query: Record<string, unknown>): Promise<ChampionMatchups> {
  const position = typeof query.position === 'string' && query.position ? query.position : 'MIDDLE'
  const data = await analysis(championId, position, query.eloBracket)
  const lane = asList((data?.summary as Obj | undefined)?.positions).find(entry => POSITION[String(entry.name).toLowerCase()] === position || String(entry.name) === LANE[position]?.toUpperCase())
  const seen = new Map<number, { games: number, wins: number }>()
  for (const entry of [...asList(data?.strong_counters), ...asList(data?.weak_counters), ...asList(lane?.counters)]) {
    const id = num(entry.champion_id)
    if (id && !seen.has(id)) seen.set(id, { games: num(entry.play), wins: num(entry.win) })
  }
  const opponent = Number(query.opponent) || null
  const matchups = [...seen].filter(([id]) => opponent === null || id === opponent).map(([id, { games, wins }]) => ({
    opponentChampionId: id,
    games,
    wins,
    winRate: games > 0 ? wins / games : 0,
    playRate: 0,
    winRateLowerBound: 0,
    winRateUpperBound: 1,
    laneWinRate: null,
    decidedLaneGames: 0,
    averageGoldDiffAt15: null,
    goldDiffLaneGames: 0,
    averageXpDiffAt15: null,
    xpDiffLaneGames: 0,
  })).sort((a, b) => b.games - a.games)
  return { championId, position, patch: null, matchups }
}

/** op.gg's trend is the patch on screen: one point. */
export async function opggTrend(championId: number, query: Record<string, unknown>): Promise<ChampionTrendResponse> {
  const position = typeof query.position === 'string' && query.position ? query.position : 'MIDDLE'
  const data = await analysis(championId, position, query.eloBracket)
  const trends = data?.trends as Obj | undefined
  const average = (data?.summary as Obj | undefined)?.average_stats as Obj | undefined
  const win = asList(trends?.win)[0]
  if (!win) return { championId, position, points: [] }
  return {
    championId,
    position,
    points: [{
      patch: String(win.version ?? ''),
      winRate: num(win.rate),
      pickRate: num(asList(trends?.pick)[0]?.rate),
      banRate: num(asList(trends?.ban)[0]?.rate),
      games: num(average?.play),
    }],
  }
}
