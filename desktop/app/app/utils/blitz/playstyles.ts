import type { ChampionBuild, ChampionBuildResponse } from '~/types/build'
import type { BuildOptions } from '~/utils/sources/model'
import type { BlitzBuildDoc } from '~/utils/blitz/builds'
import { buildsFromBlitz, most, readBlitzBuildRows } from '~/utils/blitz/builds'
import { blitzOptionsOf } from '~/utils/sources/blitz'

/**
 * Blitz's builds named as Blitz names them. Its lane answer
 * (`champion_builds_tags`) is one document per playstyle — the tags its
 * builds' items carry: Aatrox's top lane on 16.22 is Bruiser (17,031 games),
 * Lethality (3,257), Bruiser and Lethality (1,430), AD (969) — and Blitz lists
 * one build per playstyle under its name, rather than the core paths of one
 * document anonymous. Only Blitz's own builds are named so: no other source
 * tags its builds, and none is mixed in for a name (`readBlitzBuild` is the
 * builds read when Settings picked Blitz).
 */

/** A document's playstyle as Blitz writes it: its tags, else the build's own label; null for a document tagged with nothing. */
export function playstyleName(doc: BlitzBuildDoc): string | null {
  const tags = (doc.name_tags ?? []).map(tag => tag.trim()).filter(Boolean)
  if (tags.length) return tags.join(' · ')
  const label = doc.build_id?.primary_tags_f3pie?.split(',').map(tag => tag.trim()).filter(Boolean) ?? []
  return label.length ? label.join(' · ') : null
}

/** One playstyle's build: its document's most played core path, with its own runes, spells, starter and skills, under its name. */
function playstyleBuild(championId: number, position: string, doc: BlitzBuildDoc): ChampionBuild | null {
  const build = buildsFromBlitz(championId, position, doc).builds[0]
  return build ? { ...build, name: playstyleName(doc) } : null
}

/**
 * The lane's builds from every playstyle document: one build per playstyle,
 * most played first, each named. A lane Blitz answers with one document keeps
 * that document's most played core paths (`buildsFromBlitz`), unnamed — or
 * named, with `named`, as the one-tricks' group is.
 */
export function buildsFromPlaystyles(championId: number, position: string, docs: BlitzBuildDoc[], named = false): ChampionBuildResponse {
  const sorted = [...docs].sort((a, b) => b.games - a.games)
  if (sorted.length < 2) {
    const answer = buildsFromBlitz(championId, position, sorted[0])
    const name = named && sorted[0] ? playstyleName(sorted[0]) : null
    // One playstyle's paths share its name: the most played carries it, the others stay unnamed rather than read alike.
    return name ? { ...answer, builds: answer.builds.map((build, index) => (index === 0 ? { ...build, name } : build)) } : answer
  }
  const builds = sorted.flatMap(doc => playstyleBuild(championId, position, doc) ?? [])
  return { championId, patch: sorted[0]!.patch ?? null, position, totalGames: sorted.reduce((sum, doc) => sum + doc.games, 0), builds }
}

/** The lane's builds as Blitz lists them, by playstyle (`buildsFromPlaystyles`); against the lane opponent when one is given. */
export async function readBlitzBuild(championId: number, position: string, opponentChampionId: number | null = null): Promise<ChampionBuildResponse> {
  return buildsFromPlaystyles(championId, position, await readBlitzBuildRows(championId, position, opponentChampionId))
}

/**
 * The one-tricks' builds on the lane (`is_otp=true`): the games of the players
 * Blitz counts as one-tricks of the champion, by playstyle, each named. Read
 * from Blitz whatever source Settings picked — no other source measures
 * them: op.gg, lolalytics and Tencent split no build by who plays it, and
 * TrueMain's builds are every main's, not the one-tricks' alone.
 */
export async function readBlitzOtpBuilds(championId: number, position: string): Promise<ChampionBuildResponse> {
  return buildsFromPlaystyles(championId, position, await readBlitzBuildRows(championId, position, null, true), true)
}

/**
 * Every option one playstyle measured, for the build panel of the row named
 * after it — the lane's biggest document would show another playstyle's
 * options under its name. Null when the lane has no document of that name.
 */
export async function playstyleOptions(championId: number, position: string, name: string, otp = false): Promise<BuildOptions | null> {
  const docs = await readBlitzBuildRows(championId, position, null, otp)
  const doc = docs.length > 1 || otp ? docs.find(entry => playstyleName(entry) === name) : most(docs)
  return doc ? await blitzOptionsOf(doc) : null
}
