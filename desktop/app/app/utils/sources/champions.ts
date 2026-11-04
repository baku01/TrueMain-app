import type { StaticItemData } from '#shared/types/static-data'
import type { Champion } from '~/composables/useChampionStatics'
import type { ItemListResponse } from '~/utils/static-data'
import { DDRAGON, toItemsMap } from '~/utils/static-data'

/**
 * Champions by id and by name, for the sources that name a champion rather
 * than number it: lolalytics' `c=leesin`, op.gg's `LEESIN`, and op.gg's tier
 * lists, which give names back. Read from Data Dragon once per session —
 * `useChampionStatics` keeps the same list, but in component state the
 * sources cannot reach.
 */
interface Roster {
  /** Riot's classes, ratings and attack range per champion: what the draft reads an enemy team by (`utils/draft-build.ts`). */
  traits: Map<number, Champion>
  byId: Map<number, string>
  bySlug: Map<string, number>
  /** The live patch, `16.21` — Data Dragon's latest version without its build number. */
  patch: string
  /** Data Dragon's full version, `16.21.1`. */
  version: string
}

let roster: Promise<Roster> | null = null

/** A name as the sources spell it: letters and digits, lower case — `Kai'Sa` is `kaisa`, `Dr. Mundo` is `drmundo`. */
export const slugOf = (name: string) => name.normalize('NFD').replace(/[^a-z0-9]/gi, '').toLowerCase()

/** The champions whose display name is not the one the sources use. */
const SLUG_OVERRIDES: Record<string, string> = { nunuwillump: 'nunu', renataglasc: 'renata' }

async function load(): Promise<Roster> {
  const versions = await $fetch<string[]>('https://ddragon.leagueoflegends.com/api/versions.json')
  const payload = await $fetch<{ data: Record<string, { key: string, id: string, name: string, tags?: string[], info?: { attack: number, defense: number, magic: number }, stats?: { attackrange?: number } }> }>(
    `https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/en_US/champion.json`,
  )
  const byId = new Map<number, string>()
  const bySlug = new Map<string, number>()
  const traits = new Map<number, Champion>()
  for (const champion of Object.values(payload.data)) {
    const id = Number(champion.key)
    traits.set(id, { id, alias: champion.id, name: champion.name, tags: champion.tags, info: champion.info, attackRange: champion.stats?.attackrange })
    const slug = SLUG_OVERRIDES[slugOf(champion.name)] ?? slugOf(champion.name)
    byId.set(id, slug)
    bySlug.set(slug, id)
    // Riot's alias too (`MonkeyKing`), and the full name, so either spelling finds the champion.
    bySlug.set(slugOf(champion.id), id)
    bySlug.set(slugOf(champion.name), id)
  }
  return { traits, byId, bySlug, patch: versions[0]!.split('.').slice(0, 2).join('.'), version: versions[0]! }
}

function rosterOnce(): Promise<Roster> {
  roster ??= load().catch((error) => {
    roster = null
    throw error
  })
  return roster
}

/** The champion as the sources name it (`leesin`); null for an id Data Dragon does not know. */
export async function championSlug(championId: number): Promise<string | null> {
  return (await rosterOnce()).byId.get(championId) ?? null
}

/** The champion a source named, however it spelled it (`Lee Sin`, `LEE_SIN`, `leesin`). */
export async function championIdOf(name: string): Promise<number | null> {
  return (await rosterOnce()).bySlug.get(slugOf(name)) ?? null
}

/**
 * The live patch, for the answers whose source does not say: a list without
 * one leaves the champions page waiting on item icons it never asks for.
 */
export async function currentPatch(): Promise<string> {
  return (await rosterOnce()).patch
}

/** Data Dragon's whole live version (`16.22.1`): its image paths take nothing shorter. */
export async function liveVersion(): Promise<string> {
  return (await rosterOnce()).version
}

/** Every champion's classes, ratings and attack range, by id. */
export async function championTraits(): Promise<Map<number, Champion>> {
  return (await rosterOnce()).traits
}

let liveItemMap: Promise<Record<number, StaticItemData>> | null = null

/** The live patch's items (Data Dragon), for the reads made outside a page: their tags, recipes and prices. */
export function liveItems(): Promise<Record<number, StaticItemData>> {
  if (!liveItemMap) {
    liveItemMap = rosterOnce().then(async ({ version }) => toItemsMap(await $fetch<ItemListResponse>(`${DDRAGON}/${version}/data/en_US/item.json`), version))
    liveItemMap.catch(() => (liveItemMap = null))
  }
  return liveItemMap
}
