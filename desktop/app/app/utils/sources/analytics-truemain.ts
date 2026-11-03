import type { ChampionMatchups, ChampionTrendResponse } from '#shared/types/champions'
import type { ChampionBuildResponse } from '~/types/build'
import type { ChampionAnalytics } from '~/utils/sources/analytics'
import type { BuildOptions, ItemOption, RunePageOption, SkillOption, SpellOption } from '~/utils/sources/model'
import { apiGet } from '~/composables/useApi'
import { readChampionBuild } from '~/utils/champion-build-read'
import { emptyAnalytics, summaryFromOptions } from '~/utils/sources/analytics'
import { isBoots } from '~/utils/blitz/builds'

/**
 * TrueMain's own analytics: the lane builds (`GET /champions/{id}`) as the
 * build panel's options, the lane's matchups and its trend by patch. TrueMain
 * measures its builds one per first item, so the options are those builds'.
 */
const keyOf = (ids: number[]) => ids.join(',')

function optionsFromBuilds(answer: ChampionBuildResponse): BuildOptions | null {
  if (!answer.builds.length) return null
  const pages = new Map<string, RunePageOption>()
  const spells = new Map<string, SpellOption>()
  const starters = new Map<string, ItemOption>()
  const skills = new Map<string, SkillOption>()
  const boots = new Map<string, ItemOption>()
  for (const { core } of answer.builds) {
    const page = core.runePage
    if (page) pages.set(`${page.primaryKeystoneId}-${page.secondaryStyleId}`, { games: page.games, pickRate: page.pickRate, winRate: page.winRate, page })
    if (core.summonerSpells) spells.set(`${core.summonerSpells.spell1Id}-${core.summonerSpells.spell2Id}`, { ...core.summonerSpells, spellIds: [core.summonerSpells.spell1Id, core.summonerSpells.spell2Id] })
    if (core.starterItems) starters.set(keyOf(core.starterItems.itemIds), core.starterItems)
    if (core.boots) boots.set(keyOf(core.boots.itemIds), core.boots)
    if (core.skillOrder) skills.set(core.skillOrder.sequence.join(''), { ...core.skillOrder, points: [], order: core.skillOrder.sequence, opening: [] })
  }
  return {
    patch: answer.patch,
    games: answer.totalGames,
    pages: [...pages.values()],
    shares: null,
    spells: [...spells.values()],
    starters: [...starters.values()],
    boots: [...boots.values()],
    cores: answer.builds.map(build => ({ games: build.games, pickRate: build.pickRate, winRate: build.winRate, itemIds: (build.core.itemPath?.itemIds ?? [build.firstItemId]).filter(id => !isBoots(id)) })),
    followUps: () => [],
    skills: [...skills.values()],
  }
}

export async function truemainAnalytics(championId: number, position: string, eloBracket: unknown): Promise<ChampionAnalytics> {
  const query = { position, ...(typeof eloBracket === 'string' && eloBracket ? { eloBracket } : {}) }
  const [builds, matchups, trend] = await Promise.all([
    readChampionBuild(championId, position).catch(() => null),
    apiGet<ChampionMatchups>(`/champions/${championId}/matchups`, query).catch(() => null),
    apiGet<ChampionTrendResponse>(`/champions/${championId}/trend`, { position }).catch(() => null),
  ])
  const analytics = emptyAnalytics()
  const last = trend?.points.at(-1)
  const before = trend?.points.at(-2)
  analytics.patch = builds?.patch ?? last?.patch ?? null
  if (last) {
    analytics.header = {
      games: last.games,
      winRate: last.winRate,
      pickRate: last.pickRate,
      banRate: last.banRate,
      tier: null,
      rank: null,
      rankTotal: null,
      averageWinRate: null,
      previous: before ? { patch: before.patch, winRate: before.winRate, pickRate: before.pickRate, banRate: before.banRate, games: before.games } : null,
    }
  }
  analytics.options = builds ? optionsFromBuilds(builds) : null
  if (analytics.options) {
    analytics.summary = { common: summaryFromOptions(analytics.options, false), winning: summaryFromOptions(analytics.options, true) }
    analytics.skillPaths.priority = analytics.options.skills.map(skill => ({ ...skill }))
  }
  if (matchups) {
    analytics.matchups = [{ position, rows: matchups.matchups.map(entry => ({ championId: entry.opponentChampionId, winRate: entry.winRate, pickRate: entry.playRate, games: entry.games })) }]
  }
  if (trend?.points.length) {
    const series = (pick: (point: ChampionTrendResponse['points'][number]) => number) => [{ label: 'all', points: trend.points.map(point => ({ label: point.patch, value: pick(point) })) }]
    analytics.trend = { winRate: series(point => point.winRate), pickRate: series(point => point.pickRate), banRate: series(point => point.banRate ?? 0), games: series(point => point.games) }
  }
  return analytics
}
