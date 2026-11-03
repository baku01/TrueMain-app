import type { BuildOption, BuildTreeNode } from '~/types/build'
import { isBoots, maxOrder } from '~/utils/blitz/builds'
import { blitzGet } from '~/utils/blitz/client'

/**
 * Professional players' recent solo-queue games on a champion, as Blitz
 * records them (`lol/pro_match_ids`): who played, for which team, against
 * whom, and the build they finished with. Only Blitz has these; TrueMain
 * measures every player alike.
 */
export interface ProMatch {
  matchId: string
  player: { id: number, name: string, portraitUrl: string | null, riotId: string | null }
  team: { name: string, tag: string } | null
  region: string
  patch: string
  /** Game start, epoch milliseconds. */
  playedAt: number
  durationSeconds: number
  championId: number
  opponentChampionId: number | null
  position: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  /** The six slots at the end, the trinket last, as the scoreboard shows them. */
  items: number[]
  keystoneId: number | null
  runes: number[]
  primaryTreeId: number
  secondaryTreeId: number
  shards: number[]
  spells: number[]
  /** Item completions in buy order, seconds into the game. */
  buildPath: { itemId: number, at: number }[]
  /** Ability slot (1 Q … 4 R) per level. */
  skillOrder: number[]
}

interface BlitzProMatch {
  player: { id: number, name: string, profile_image_url?: string | null }
  player_game_name?: string | null
  player_tag_line?: string | null
  team?: { name: string, tag: string } | null
  region: string
  riotMatchId: number
  patch: string
  gameDuration: number
  opponentChampion?: number | null
  timestamp: number
  kills: number
  deaths: number
  assists: number
  win: boolean
  championId: number
  lane: string
  items: number[]
  runes: number[]
  runePrimaryTree: number
  runeSecondaryTree: number
  runeShards: number[]
  spells: number[]
  buildPaths?: { itemId: number, timestamp: number }[]
  skillOrder?: { skillSlot: number }[]
}

/** Remakes and early surrenders say nothing about a build: Blitz's own page drops games of twenty minutes or less. */
const MIN_DURATION_SECONDS = 1200

export async function readProMatches(championId: number, position: string | null): Promise<ProMatch[]> {
  const rows = await blitzGet<BlitzProMatch[]>('lol', 'lol/pro_match_ids', { champion_id: championId, role: position })
  return (rows ?? [])
    .filter(row => row.gameDuration > MIN_DURATION_SECONDS && (position === null || row.lane === position))
    .map(row => ({
      matchId: `${row.region}_${row.riotMatchId}`,
      player: {
        id: row.player.id,
        name: row.player.name,
        portraitUrl: row.player.profile_image_url ?? null,
        riotId: row.player_game_name ? `${row.player_game_name}#${row.player_tag_line ?? ''}` : null,
      },
      team: row.team ? { name: row.team.name, tag: row.team.tag } : null,
      region: row.region,
      patch: row.patch.split('.').slice(0, 2).join('.'),
      playedAt: row.timestamp,
      durationSeconds: row.gameDuration,
      championId: row.championId,
      opponentChampionId: row.opponentChampion ?? null,
      position: row.lane,
      win: row.win,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      items: row.items,
      keystoneId: row.runes[0] ?? null,
      runes: row.runes,
      primaryTreeId: row.runePrimaryTree,
      secondaryTreeId: row.runeSecondaryTree,
      shards: row.runeShards,
      spells: row.spells,
      buildPath: (row.buildPaths ?? []).map(step => ({ itemId: step.itemId, at: Math.round(step.timestamp / 1000) })),
      skillOrder: (row.skillOrder ?? []).map(step => step.skillSlot),
    }))
    .sort((a, b) => b.playedAt - a.playedAt)
}

/** Trinkets and the support quest items: in every final inventory, never part of a build path. */
const NOT_BUILD = new Set([2052, 3330, 3340, 3348, 3363, 3364, 3865, 3866, 3867, 3869, 3870, 3871, 3876, 3877])
/** What the game opens on is bought within its first minute. */
const STARTER_WINDOW_SECONDS = 60

/**
 * One pro game as a build the build view draws (`BuildOption`): the finished
 * items in the order they were bought, the boots apart, the first minute's
 * purchases as the starter, the six runes and shards, the spells and the max
 * order. One game, so every figure is that game's: one game, won or lost.
 */
export function proBuildOption(match: ProMatch): BuildOption {
  const one = { games: 1, pickRate: 1, winRate: match.win ? 1 : 0 }
  const boughtAt = new Map<number, number>()
  for (const step of match.buildPath) if (!boughtAt.has(step.itemId)) boughtAt.set(step.itemId, step.at)
  const finished = match.items.filter(id => id > 0 && !NOT_BUILD.has(id))
  const path = finished.filter(id => !isBoots(id)).sort((a, b) => (boughtAt.get(a) ?? Infinity) - (boughtAt.get(b) ?? Infinity))
  const boots = finished.find(isBoots)
  const starter = match.buildPath.filter(step => step.at <= STARTER_WINDOW_SECONDS).map(step => step.itemId)
  const [keystone, perk1, perk2, perk3, secondary1, secondary2] = match.runes
  // Blitz lists the shards defense, flex, offense.
  const [defense, flex, offense] = match.shards
  // The view draws the first item as the tree's root: the tree is what follows it.
  const tree = path.slice(1).reduceRight<BuildTreeNode[]>((children, itemId) => [{ itemId, games: 1, wins: match.win ? 1 : 0, pickRate: 1, children }], [])
  return {
    key: `pro-${match.matchId}`,
    firstItemId: path[0] ?? 0,
    keystoneId: keystone ?? null,
    buildTree: tree,
    games: 1,
    winRate: one.winRate,
    core: {
      itemPath: path.length ? { itemIds: path, ...one } : null,
      boots: boots ? { itemIds: [boots], ...one } : null,
      starterItems: starter.length ? { itemIds: starter, ...one } : null,
      summonerSpells: match.spells.length >= 2 ? { spell1Id: match.spells[0]!, spell2Id: match.spells[1]!, ...one } : null,
      skillOrder: match.skillOrder.length ? { sequence: maxOrder(match.skillOrder), ...one } : null,
      runePage: keystone
        ? {
            ...one,
            primaryStyleId: match.primaryTreeId,
            primaryKeystoneId: keystone,
            primaryPerk1Id: perk1 ?? 0,
            primaryPerk2Id: perk2 ?? 0,
            primaryPerk3Id: perk3 ?? 0,
            secondaryStyleId: match.secondaryTreeId,
            secondaryPerk1Id: secondary1 ?? 0,
            secondaryPerk2Id: secondary2 ?? 0,
            statOffense: offense ?? 0,
            statFlex: flex ?? 0,
            statDefense: defense ?? 0,
          }
        : null,
    },
  }
}
