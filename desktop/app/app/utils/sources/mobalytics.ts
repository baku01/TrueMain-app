import type { ChampionMatchups, ChampionTrendResponse } from '#shared/types/champions'
import type { ChampionBuildResponse } from '~/types/build'
import type { BuildOptions, ItemOption, Measure, RunePageOption, SpellOption } from '~/utils/sources/model'
import { isBoots } from '~/utils/blitz/builds'
import { dataWindow, previousPatch } from '~/utils/data-window'
import { championIdOf, championSlug, currentPatch } from '~/utils/sources/champions'
import { buildsFromOptions, measure, ranked, skillOption } from '~/utils/sources/model'
import { isQuestReward } from '~/utils/support-quest'
import { keepBounded } from '~/utils/bounded'

/**
 * Mobalytics (mobalytics.gg), read off the GraphQL endpoint its own pages ask
 * (`app.mobalytics.gg/api/lol/graphql/v1/query`): it answers a plain GET with
 * the query in the address — no key, no browser — in Riot's own ids. A lane's
 * builds come by kind (the most popular, the alternatives, off-meta…), each a
 * whole build with its games and wins: its rune page, spells, skill order and
 * items by stage (starting, early, core, the rest of the build, situational).
 * In the app the shell reads it (`sources.rs`, `mobalytics`); in `npm run dev`
 * the dev server's `/__mobalytics` proxy does.
 *
 * Its counts are the same games lolalytics counts (Briar's jungle on 16.22,
 * Emerald+: 92,683 against 93,083): never added to another source's.
 */

interface Tally { wins: number, matchCount: number }
interface MobalyticsBuild {
  id: string
  type: string
  stats: Tally | null
  perks: { IDs: number[], style: number, subStyle: number } | null
  items: { type: string, items: number[] }[]
  spells: number[]
  skillOrder: number[]
}
interface History { value: number, x: string }
interface MobalyticsChampion {
  stats: { tier: string | null, totalMatchCount: number, winRateHistory: History[], pickRateHistory: History[], banRateHistory: History[] } | null
  buildsOptions: { options: MobalyticsBuild[] } | null
  countersOptions: { options: { matchupSlug: string, matchupRole: string, counterMetrics: { wins: number, looses: number, gd15: number | null } | null }[] } | null
}

/** TrueMain's lanes as Mobalytics' `Rolename`. */
const ROLE: Record<string, string> = { TOP: 'TOP', JUNGLE: 'JUNGLE', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUPPORT' }

/**
 * TrueMain's elo bracket as Mobalytics' rank filter: the "+" brackets it
 * pools (Platinum+ to Master+), else the tier alone — the games nearest a
 * player of it, as `blitzTier` reads Blitz; every tier is `All`, and none
 * reads Mobalytics' own default, Emerald+.
 */
export function mobalyticsRank(eloBracket: unknown): string {
  const bracket = typeof eloBracket === 'string' && eloBracket ? eloBracket.toUpperCase() : 'EMERALD_PLUS'
  if (bracket === 'ALL') return 'All'
  const tier = bracket.replace(/_PLUS$/, '')
  const word = tier === 'GRANDMASTER' ? 'GrandMaster' : tier.charAt(0) + tier.slice(1).toLowerCase()
  const pooled = ['PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER']
  return bracket.endsWith('_PLUS') && pooled.includes(tier) ? `${word}Plus` : word
}

async function gql<T>(query: string): Promise<T> {
  const answer = insideTauri()
    ? await (await import('@tauri-apps/api/core')).invoke<{ data?: T, errors?: unknown[] }>('source_get', { source: 'mobalytics', path: 'query', query: [['query', query]] })
    : await $fetch<{ data?: T, errors?: unknown[] }>('/__mobalytics/query', { query: { query } })
  if (!answer.data) throw new Error('Mobalytics answered no data')
  return answer.data
}

/** The patch Settings' window reads: the one before when it says so, else Mobalytics' current one. */
async function windowPatch(): Promise<string | null> {
  return dataWindow.value === 'previous' ? previousPatch(`${await currentPatch()}.1`) : null
}

const champions = new Map<string, Promise<MobalyticsChampion | null>>()

/** A champion's lane — its builds, figures and counters — read once per lane, bracket and patch for the session. */
export function readMobalyticsChampion(championId: number, position: string, eloBracket?: unknown): Promise<MobalyticsChampion | null> {
  const role = ROLE[position] ?? 'MID'
  const rank = mobalyticsRank(eloBracket)
  const key = `${championId}:${role}:${rank}:${dataWindow.value}`
  let read = champions.get(key)
  if (!read) {
    read = (async () => {
      const [slug, patch] = await Promise.all([championSlug(championId), windowPatch()])
      if (!slug) return null
      const filters = `slug: ${JSON.stringify(slug)}, role: ${role}, rank: ${rank}${patch ? `, patch: ${JSON.stringify(patch)}` : ''}`
      const data = await gql<{ lol: { champion: MobalyticsChampion | null } }>(`{ lol { champion(filters: { ${filters} }) {
        stats(topHistoryPoints: 2) { tier totalMatchCount winRateHistory { value x } pickRateHistory { value x } banRateHistory { value x } }
        buildsOptions { options { id type stats { wins matchCount } perks { IDs style subStyle } items { type items } spells skillOrder } }
        countersOptions(top: 400, skip: 0, sort: { field: WR, order: DESC }) { options { matchupSlug matchupRole counterMetrics { wins looses gd15 } } }
      } } }`)
      return data.lol.champion
    })()
    read.catch(() => champions.delete(key))
    keepBounded(champions, key, read)
  }
  return read
}

/** Each build's games, keyed by what `keyOf` reads off it; added up within Mobalytics only — its kinds are apart. */
function grouped<T>(builds: MobalyticsBuild[], total: number, keyOf: (build: MobalyticsBuild) => T | null): (Measure & { value: T })[] {
  const groups = new Map<string, { value: T, games: number, wins: number }>()
  for (const build of builds) {
    const value = keyOf(build)
    if (value === null || !build.stats?.matchCount) continue
    const key = JSON.stringify(value)
    const known = groups.get(key) ?? { value, games: 0, wins: 0 }
    known.games += build.stats.matchCount
    known.wins += build.stats.wins
    groups.set(key, known)
  }
  return [...groups.values()].map(group => ({ ...measure(group.games, group.games ? group.wins / group.games : 0, total ? group.games / total : 0), value: group.value }))
}

const stage = (build: MobalyticsBuild, type: string) => build.items.find(entry => entry.type === type)?.items ?? []
/** Boots are the build's own option, and a support's quest reward is picked, not bought: neither is a place in the path. */
const completed = (ids: number[]) => ids.filter(id => !isBoots(id) && !isQuestReward(id))
const bootsOf = (build: MobalyticsBuild) => [...stage(build, 'Core'), ...stage(build, 'FullBuild'), ...stage(build, 'Early')].find(id => isBoots(id) && id !== 1001) ?? null

/** A lane's builds as the build panel's options: each part of each build, grouped and measured on its games. */
export function mobalyticsOptionsOf(champion: MobalyticsChampion): BuildOptions | null {
  const builds = (champion.buildsOptions?.options ?? []).filter(build => (build.stats?.matchCount ?? 0) > 0)
  if (!builds.length) return null
  const total = champion.stats?.totalMatchCount || builds.reduce((sum, build) => sum + (build.stats?.matchCount ?? 0), 0)
  const items = (rows: (Measure & { value: number[] })[]): ItemOption[] => rows.map(({ value, ...measured }) => ({ ...measured, itemIds: value }))
  const pages: RunePageOption[] = grouped(builds, total, (build) => {
    const ids = build.perks?.IDs ?? []
    return ids.length === 9 && build.perks ? [build.perks.style, build.perks.subStyle, ...ids] : null
  }).map(({ value: [style, subStyle, keystone, perk1, perk2, perk3, sub1, sub2, offense, flex, defense], ...measured }) => ({
    ...measured,
    page: {
      primaryStyleId: style!,
      primaryKeystoneId: keystone!,
      primaryPerk1Id: perk1!,
      primaryPerk2Id: perk2!,
      primaryPerk3Id: perk3!,
      secondaryStyleId: subStyle!,
      secondaryPerk1Id: sub1!,
      secondaryPerk2Id: sub2!,
      statOffense: offense!,
      statFlex: flex!,
      statDefense: defense!,
    },
  }))
  const spells: SpellOption[] = grouped(builds, total, build => (build.spells.length === 2 ? [...build.spells].sort((a, b) => a - b) : null))
    .map(({ value, ...measured }) => ({ ...measured, spellIds: value }))
  const cores = items(grouped(builds, total, build => (completed(stage(build, 'Core')).length ? completed(stage(build, 'Core')) : null)))
  // Mobalytics counts a build's games, not each item's: its builds' later
  // items and situational lists would each carry the whole build's games, so
  // they are left to the sources that count items one by one.
  return {
    patch: champion.stats?.winRateHistory.at(-1)?.x ?? null,
    games: total,
    pages: ranked(pages, 5),
    shares: null,
    spells: ranked(spells, 3),
    starters: ranked(items(grouped(builds, total, build => (stage(build, 'Starter').length ? stage(build, 'Starter') : null))), 3),
    boots: ranked(items(grouped(builds, total, (build) => {
      const boots = bootsOf(build)
      return boots ? [boots] : null
    })), 3),
    cores: ranked(cores, 5),
    followUps: () => [],
    skills: ranked(grouped(builds, total, build => (build.skillOrder.length ? build.skillOrder : null))
      .map(({ value, ...measured }) => skillOption(value, measured)), 3),
  }
}

export async function mobalyticsOptions(championId: number, position: string): Promise<BuildOptions | null> {
  const champion = await readMobalyticsChampion(championId, position)
  return champion ? mobalyticsOptionsOf(champion) : null
}

export async function mobalyticsBuilds(championId: number, position: string): Promise<ChampionBuildResponse> {
  return buildsFromOptions(championId, position, await mobalyticsOptions(championId, position))
}

/**
 * Every opponent on the lane, from the champion's side. Mobalytics counts a
 * matchup from the opponent's (`counterMetrics`: its wins, its gold lead at
 * 15), so the champion's wins are the opponent's losses, and the gold lead
 * changes sign.
 */
export async function mobalyticsMatchups(championId: number, query: Record<string, unknown>): Promise<ChampionMatchups> {
  const position = typeof query.position === 'string' && query.position ? query.position : 'MIDDLE'
  const champion = await readMobalyticsChampion(championId, position, query.eloBracket)
  const role = ROLE[position]
  const opponent = Number(query.opponent) || null
  const rows = (champion?.countersOptions?.options ?? []).filter(row => row.counterMetrics && (!role || row.matchupRole === role))
  const total = rows.reduce((sum, row) => sum + row.counterMetrics!.wins + row.counterMetrics!.looses, 0)
  const matchups = (await Promise.all(rows.map(async (row) => {
    const id = await championIdOf(row.matchupSlug)
    const metrics = row.counterMetrics!
    const games = metrics.wins + metrics.looses
    if (!id || !games || (opponent !== null && id !== opponent)) return []
    return [{
      opponentChampionId: id,
      games,
      wins: metrics.looses,
      winRate: metrics.looses / games,
      playRate: total ? games / total : 0,
      winRateLowerBound: 0,
      winRateUpperBound: 1,
      laneWinRate: null,
      decidedLaneGames: 0,
      averageGoldDiffAt15: metrics.gd15 === null ? null : -metrics.gd15,
      goldDiffLaneGames: metrics.gd15 === null ? 0 : games,
      averageXpDiffAt15: null,
      xpDiffLaneGames: 0,
    }]
  }))).flat()
  return { championId, position, patch: champion?.stats?.winRateHistory.at(-1)?.x ?? null, matchups }
}

/** The lane's figures patch by patch, as Mobalytics keeps them; only the latest patch's games are counted. */
export async function mobalyticsTrend(championId: number, query: Record<string, unknown>): Promise<ChampionTrendResponse> {
  const position = typeof query.position === 'string' && query.position ? query.position : 'MIDDLE'
  const stats = (await readMobalyticsChampion(championId, position, query.eloBracket))?.stats
  if (!stats) return { championId, position, points: [] }
  const at = (history: History[], patch: string) => (history.find(point => point.x === patch)?.value ?? 0) / 100
  const patches = stats.winRateHistory.map(point => point.x)
  return {
    championId,
    position,
    points: patches.map((patch, index) => ({
      patch,
      winRate: at(stats.winRateHistory, patch),
      pickRate: at(stats.pickRateHistory, patch),
      banRate: at(stats.banRateHistory, patch),
      games: index === patches.length - 1 ? stats.totalMatchCount : 0,
    })),
  }
}
