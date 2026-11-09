import type { BlitzBuildDoc } from '~/utils/blitz/builds'
import type { BuildOptions } from '~/utils/sources/model'
import type { DraftSelection, ImportChoice } from '~/composables/useDraftAutoImport'
import type { LaidBuild } from '~/utils/jev-build'
import type { DraftItemBlock, PlaceMeasures } from '~/utils/item-set'
import type { ItemStat } from '~/utils/blitz/item-stats'
import type { RankedSlot } from '~/utils/jev-recommend'
import { itemSetOf } from '~/utils/jev-recommend'
import { INVENTORY, placeGames } from '~/utils/jev-build'
import { readItemStats } from '~/utils/blitz/item-stats'
import { most, readBlitzBuildDoc, readBlitzBuildRows } from '~/utils/blitz/builds'
import { playstyleName, playstyleOptions } from '~/utils/blitz/playstyles'
import { MIN_MATCHUP_GAMES, blitzOptions, blitzOptionsOf } from '~/utils/sources/blitz'
import { combineOptions } from '~/utils/sources/combined'
import { lolalyticsOptions } from '~/utils/sources/lolalytics'

/**
 * The family of builds Jev ranks within — its base. Jev's measured pool is
 * the base's options, and the "most played" it is compared with is that
 * family's most played:
 *
 * - the lane, every game (lolalytics' and Blitz's options pooled), as always;
 * - the lane matchup: Blitz's builds in the games against the lane opponent,
 *   once it measured enough of them to stand on their own;
 * - one of Blitz's playstyles (Bruiser, Lethality…), each its own document;
 * - the one-tricks' games (`is_otp`), their most played playstyle.
 *
 * Only a base whose options came back with a core is offered: a family Blitz
 * did not measure is not a choice. The player's previous build is no base: it
 * is one concrete build, not a family measured over games, so there is
 * nothing in it for Jev to rank — the build list marks how it fits the draft
 * instead (`utils/jev-row-fit`).
 *
 * Changing the base never asks Jev: its calls are paid and wait for the
 * player's click. Its item reads are kept per patch, champion, lane and item,
 * so another base asks only for the items it adds, and the lane's choices.
 */

export type JevBaseKind = 'lane' | 'matchup' | 'playstyle' | 'otp'
export interface JevBase { key: string, kind: JevBaseKind, name: string | null }
export interface LoadedBase { base: JevBase, options: BuildOptions }
export interface BaseCandidate { base: JevBase, read: () => Promise<BuildOptions | null> }

export const LANE_BASE: JevBase = { key: 'lane', kind: 'lane', name: null }

/** The playstyles of a lane, most played first; none when Blitz answers one document (it is the lane itself). */
export function playstyleNames(docs: BlitzBuildDoc[]): string[] {
  if (docs.length < 2) return []
  return [...new Set([...docs].sort((a, b) => b.games - a.games).map(playstyleName).filter((name): name is string => !!name))]
}

/** A base's options worth offering: at least one measured core. */
const usable = (options: BuildOptions | null | undefined): options is BuildOptions => !!options && options.cores.length > 0

/** Every candidate read at once; the ones that answered a core kept, in the candidates' order. */
export async function resolveBases(candidates: BaseCandidate[]): Promise<LoadedBase[]> {
  const read = await Promise.all(candidates.map(candidate => candidate.read().catch(() => null)))
  return candidates.flatMap((candidate, index) => (usable(read[index]) ? [{ base: candidate.base, options: read[index]! }] : []))
}

/** The lane, every game: lolalytics' and Blitz's options pooled, as Jev always read it. */
export async function laneOptions(championId: number, position: string): Promise<BuildOptions | null> {
  const [lolalytics, blitz] = await Promise.all([
    lolalyticsOptions(championId, position).catch(() => null),
    blitzOptions(championId, position).catch(() => null),
  ])
  return combineOptions(lolalytics, blitz)
}

/**
 * What the lane's players buy at each place of the build, and the boots they
 * buy (`PlaceMeasures`): the lane's options (lolalytics' item1 to item5, both
 * sources' boots) and Blitz's item stats at each slot — a measured build's
 * place blocks in the item set (`measuredPlaces`). Null where neither answered.
 */
export async function lanePlaces(championId: number, position: string): Promise<PlaceMeasures | null> {
  const [options, slots] = await Promise.all([
    laneOptions(championId, position).catch(() => null),
    Promise.all(Array.from({ length: INVENTORY }, (_, index) => readItemStats(championId, position, null, { slot: index + 1 }).catch(() => new Map<number, ItemStat>()))),
  ])
  if (!options && slots.every(slot => slot.size === 0)) return null
  const boots = new Map<number, number>()
  for (const pair of options?.boots ?? []) boots.set(pair.itemIds[0]!, (boots.get(pair.itemIds[0]!) ?? 0) + pair.games)
  return { boots, places: slots.map((slot, at) => placeGames(options?.places?.[at], slot)) }
}

/** Blitz's builds against the lane opponent; none below the games that let them stand on their own. */
export async function matchupOptions(championId: number, position: string, opponentId: number): Promise<BuildOptions | null> {
  const doc = await readBlitzBuildDoc(championId, position, opponentId)
  return doc && doc.games >= MIN_MATCHUP_GAMES ? await blitzOptionsOf(doc) : null
}

/** The one-tricks' games: their most played playstyle's document. */
export async function otpOptions(championId: number, position: string): Promise<BuildOptions | null> {
  const doc = most(await readBlitzBuildRows(championId, position, null, true))
  return doc ? await blitzOptionsOf(doc) : null
}

/** The bases a champion's lane can offer, before their options are read. */
export async function baseCandidates(championId: number, position: string, opponentId: number | null): Promise<BaseCandidate[]> {
  const names = playstyleNames(await readBlitzBuildRows(championId, position).catch(() => []))
  return [
    { base: LANE_BASE, read: () => laneOptions(championId, position) },
    ...(opponentId ? [{ base: { key: `matchup:${opponentId}`, kind: 'matchup' as const, name: null }, read: () => matchupOptions(championId, position, opponentId) }] : []),
    ...names.map(name => ({ base: { key: `style:${name}`, kind: 'playstyle' as const, name }, read: () => playstyleOptions(championId, position, name) })),
    { base: { key: 'otp', kind: 'otp' as const, name: null }, read: () => otpOptions(championId, position) },
  ]
}

/** What names a base in short — the playstyle, "Matchup", "OTP" — after "Jev" and in import titles; empty for the lane. */
export function baseTag(base: JevBase | null, words: { matchup: string, otp: string }): string {
  if (!base || base.kind === 'lane') return ''
  if (base.kind === 'playstyle') return base.name ?? ''
  return base.kind === 'matchup' ? words.matchup : words.otp
}

/**
 * The import titles of a Jev answer, after "TrueMain " as the shop shows them:
 * Jev's build `Aatrox vs Akali · Jev Lethality`, the base's most played
 * `Aatrox vs Akali · Lethality`; on the lane, `· Jev` and the plain name.
 */
export function jevImportTitles(importName: string, tag: string): { jev: string, standard: string } {
  return { jev: `${importName} · Jev${tag ? ` ${tag}` : ''}`, standard: tag ? `${importName} · ${tag}` : importName }
}

/** What a Jev answer's imports are named after: the champion against the lane opponent (`Aatrox vs Akali`). */
export const jevImportName = (champion: string, opponent: string | null) => (opponent ? `${champion} vs ${opponent}` : champion)

/** One laid build as an import: its rune page, spells and item set (`itemSetOf`) under its title, with the draft's blocks. */
function importChoice(key: string, title: string, ranked: RankedSlot[], build: LaidBuild, draft: DraftItemBlock[]): ImportChoice {
  const set = itemSetOf(ranked, build)
  const spells = build.summonerSpells
  return {
    key,
    title,
    runePage: build.runePage,
    spells: spells ? [spells.spell1Id, spells.spell2Id] : null,
    starter: set.starter,
    path: set.core,
    boots: set.boots,
    situational: set.situational,
    bootsAt: set.bootsAt,
    draft,
    places: set.places,
  }
}

/**
 * A Jev answer as the draft's automatic import (`useDraftAutoImport`): Jev's
 * build selected, the base's most played offered beside it, both named after
 * the base — so another base asked for is another import — and both with the
 * items that answer the draft's needs (`draft`, `utils/jev-optionals`).
 */
export function jevImportSelection(championId: number, base: JevBase, ranked: RankedSlot[], jev: LaidBuild | null, standard: LaidBuild | null, titles: { jev: string, standard: string }, draft: DraftItemBlock[] = []): DraftSelection | null {
  if (!jev) return null
  return {
    championId,
    selected: importChoice(`jev:${base.key}`, titles.jev, ranked, jev, draft),
    others: standard ? [importChoice(`jev-standard:${base.key}`, titles.standard, ranked, standard, draft)] : [],
  }
}
