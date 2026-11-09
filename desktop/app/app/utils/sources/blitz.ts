import type { BlitzBuildDoc } from '~/utils/blitz/builds'
import type { BuildOptions, RuneShares } from '~/utils/sources/model'
import { readBlitzBuildDoc } from '~/utils/blitz/builds'
import { bootsOptions, coreOptions, followUpOptions, keystoneOptions, runeShares, situationalOptions, skillOptions, spellOptions, starterOptions } from '~/utils/blitz/options'
import { assemblePage, liveRuneTree } from '~/utils/sources/model'

/**
 * Blitz's lane document (`champion_builds_tags`, `utils/blitz`) as the panel's
 * options. Blitz counts runes one by one per tree, and the items after a core
 * per core, so both stay functions of what is picked.
 */
export async function blitzOptionsOf(doc: BlitzBuildDoc): Promise<BuildOptions> {
  const tree = await liveRuneTree()
  const shares = (primaryStyleId: number): RuneShares => {
    const measured = runeShares(doc, primaryStyleId)
    return { primary: measured.primary, secondary: measured.secondary, shards: [measured.shards[0]!, measured.shards[1]!, measured.shards[2]!] }
  }
  const pages = keystoneOptions(doc).flatMap((keystone) => {
    const page = assemblePage(keystone.keystoneId, shares, tree)
    return page ? [{ games: keystone.games, pickRate: keystone.pickRate, winRate: keystone.winRate, page }] : []
  })
  return {
    patch: doc.patch ?? null,
    games: doc.games,
    pages,
    shares,
    spells: spellOptions(doc),
    starters: starterOptions(doc),
    boots: bootsOptions(doc),
    cores: coreOptions(doc),
    followUps: core => (core ? followUpOptions(doc, core) : []),
    skills: skillOptions(doc),
    situational: situationalOptions(doc),
  }
}

/** Below this many games against the opponent, its builds are too thin: the lane's stand in. */
export const MIN_MATCHUP_GAMES = 150

export async function blitzOptions(championId: number, position: string, opponentChampionId: number | null = null): Promise<BuildOptions | null> {
  if (opponentChampionId) {
    const versus = await readBlitzBuildDoc(championId, position, opponentChampionId).catch(() => undefined)
    const options = versus ? await blitzOptionsOf(versus) : null
    if (options && options.games >= MIN_MATCHUP_GAMES) return options
  }
  const doc = await readBlitzBuildDoc(championId, position)
  return doc ? await blitzOptionsOf(doc) : null
}
