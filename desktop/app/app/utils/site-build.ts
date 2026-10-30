import type { BuildRunePage, ChampionBuildResponse } from '~/types/build'
import type { ChampionStats, RunePage, SpellPair, Tally } from '~/utils/high-elo'

/** The lanes' codes in `ChampionStats.positions`, from `POSITION_BY_CODE`'s other side. */
export const CODE_BY_POSITION: Record<string, number> = { TOP: 1, JUNGLE: 2, MIDDLE: 3, BOTTOM: 4, UTILITY: 5 }

/** The lanes a champion is read on, in the order the page lists them. */
export const LANES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const

/** Adds `games` games, `winRate` of them won, to the tally of `key`. */
function add<K>(map: Map<K, { games: number, wins: number }>, key: K, games: number, winRate: number) {
  const known = map.get(key) ?? { games: 0, wins: 0 }
  map.set(key, { games: known.games + games, wins: known.wins + games * winRate })
}

const tallies = (map: Map<number, { games: number, wins: number }>): Tally[] =>
  [...map].map(([id, { games, wins }]) => ({ id, games, wins: Math.round(wins) })).sort((a, b) => b.games - a.games)

function runesOf(page: BuildRunePage): number[] {
  return [page.primaryKeystoneId, page.primaryPerk1Id, page.primaryPerk2Id, page.primaryPerk3Id, page.secondaryPerk1Id, page.secondaryPerk2Id]
}

/**
 * What the site measured for one champion, one lane per read (`GET /champions/{id}`,
 * the champion page's endpoint), laid out as the ProBuild page counts it:
 * keystones, rune pages, items and spell pairs, each with its games and wins.
 * Every build of the answer — one per first completed item — adds its own share.
 */
export function statsFromSite(championId: number, lanes: Record<string, ChampionBuildResponse>, lane: string): ChampionStats {
  const answer = lanes[lane]
  const keystones = new Map<number, { games: number, wins: number }>()
  const items = new Map<number, { games: number, wins: number }>()
  const shards = new Map<number, { games: number, wins: number }>()
  const pages = new Map<string, RunePage>()
  const spells = new Map<string, { spells: [number, number], games: number, wins: number }>()
  let wins = 0

  for (const build of answer?.builds ?? []) {
    wins += build.games * build.winRate
    add(keystones, build.primaryKeystoneId, build.games, build.winRate)
    const { itemPath, boots, runePage, summonerSpells } = build.core
    for (const set of [itemPath, boots]) {
      for (const id of set?.itemIds ?? []) add(items, id, set!.games, set!.winRate)
    }
    if (runePage) {
      for (const id of [runePage.statOffense, runePage.statFlex, runePage.statDefense]) add(shards, id, runePage.games, runePage.winRate)
      const runes = runesOf(runePage)
      const key = runes.join('-')
      const known = pages.get(key)
      pages.set(key, {
        keystone: runePage.primaryKeystoneId,
        primary: runePage.primaryStyleId,
        secondary: runePage.secondaryStyleId,
        runes,
        games: (known?.games ?? 0) + runePage.games,
        wins: (known?.wins ?? 0) + runePage.games * runePage.winRate,
      })
    }
    if (summonerSpells) {
      const pair = [summonerSpells.spell1Id, summonerSpells.spell2Id].sort((a, b) => a - b) as [number, number]
      const key = pair.join('-')
      const known = spells.get(key)
      spells.set(key, { spells: pair, games: (known?.games ?? 0) + summonerSpells.games, wins: (known?.wins ?? 0) + summonerSpells.games * summonerSpells.winRate })
    }
  }

  const positions: Tally[] = LANES
    .map(code => ({ id: CODE_BY_POSITION[code]!, games: lanes[code]?.totalGames ?? 0, wins: 0 }))
    .filter(tally => tally.games > 0)

  return {
    championId,
    patch: answer?.patch ?? '',
    patches: answer?.patch ? [answer.patch] : [],
    games: answer?.totalGames ?? 0,
    wins: Math.round(wins),
    positions,
    keystones: tallies(keystones),
    runes: [],
    shards: tallies(shards),
    pages: [...pages.values()].map(page => ({ ...page, wins: Math.round(page.wins) })).sort((a, b) => b.games - a.games),
    items: tallies(items),
    spells: [...spells.values()].map(pair => ({ ...pair, wins: Math.round(pair.wins) }) satisfies SpellPair).sort((a, b) => b.games - a.games),
  }
}

/** The lane with the most games: where a champion is opened. */
export function mostPlayedLane(lanes: Record<string, ChampionBuildResponse>): string | null {
  const ranked = LANES.filter(lane => (lanes[lane]?.totalGames ?? 0) > 0).sort((a, b) => lanes[b]!.totalGames - lanes[a]!.totalGames)
  return ranked[0] ?? null
}
