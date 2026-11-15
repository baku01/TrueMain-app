import type { BuildRunePage } from '~/types/build'
import type { GuideRunePage } from '~/utils/mobafire'
import { DDRAGON } from '~/utils/static-data'

/**
 * The game's own ids for what a MOBAFire guide names in English — its items,
 * runes, rune trees, stat shards, summoner spells and champions — read from
 * Data Dragon's `en_US` files of the patch. With an id, the guide is drawn
 * with the app's own icons, names in the player's language and tooltips,
 * like every build in the app, rather than the site's pictures and words.
 */
export interface GuideIndex {
  items: Map<string, number>
  spells: Map<string, number>
  runes: Map<string, number>
  styles: Map<string, number>
  champions: Map<string, number>
}

/** A name as the index keys it: lowercase letters and digits only (`Kha'Zix` → `khazix`, `Legend: Haste` → `legendhaste`). */
export const nameKey = (name: string) => name.normalize('NFD').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * The stat shards, by the word of MOBAFire's picture (`/images/shards/adaptive-force.png`):
 * Data Dragon's rune file has no shard, and their ids are fixed.
 */
const SHARDS: Record<string, number> = {
  adaptiveforce: 5008,
  attackspeed: 5005,
  abilityhaste: 5007,
  cooldownreduction: 5007,
  movementspeed: 5010,
  movespeed: 5010,
  healthscaling: 5001,
  scalinghealth: 5001,
  health: 5011,
  tenacityandslowresist: 5013,
  tenacity: 5013,
}

interface ItemFile { data: Record<string, { name: string, maps?: Record<string, boolean>, gold?: { purchasable?: boolean } }> }
interface SummonerFile { data: Record<string, { key: string, name: string }> }
interface ChampionFile { data: Record<string, { key: string, name: string }> }
type RuneFile = { id: number, name: string, slots: { runes: { id: number, name: string }[] }[] }[]

const indexes = new Map<string, Promise<GuideIndex>>()

/** The patch's index, read once per patch; a failed read is not kept. */
export function guideIndex(patch: string): Promise<GuideIndex> {
  let read = indexes.get(patch)
  if (!read) {
    read = (async () => {
      const base = `${DDRAGON}/${patch}/data/en_US`
      const [items, summoners, runes, champions] = await Promise.all([
        $fetch<ItemFile>(`${base}/item.json`),
        $fetch<SummonerFile>(`${base}/summoner.json`),
        $fetch<RuneFile>(`${base}/runesReforged.json`),
        $fetch<ChampionFile>(`${base}/champion.json`),
      ])
      const index: GuideIndex = { items: new Map(), spells: new Map(), runes: new Map(), styles: new Map(), champions: new Map() }
      // Summoner's Rift's purchasable item first: a name can be another map's or mode's item too.
      const itemRows = Object.entries(items.data)
        .map(([id, item]) => ({ id: Number(id), name: item.name, rift: !!item.maps?.['11'] && item.gold?.purchasable !== false }))
        .sort((a, b) => Number(b.rift) - Number(a.rift) || a.id - b.id)
      for (const item of itemRows) {
        if (!index.items.has(nameKey(item.name))) index.items.set(nameKey(item.name), item.id)
      }
      for (const spell of Object.values(summoners.data)) index.spells.set(nameKey(spell.name), Number(spell.key))
      for (const style of runes) {
        index.styles.set(nameKey(style.name), style.id)
        for (const slot of style.slots) {
          for (const rune of slot.runes) index.runes.set(nameKey(rune.name), rune.id)
        }
      }
      for (const [word, id] of Object.entries(SHARDS)) index.runes.set(word, id)
      for (const champion of Object.values(champions.data)) index.champions.set(nameKey(champion.name), Number(champion.key))
      return index
    })()
    indexes.set(patch, read)
    read.catch(() => indexes.delete(patch))
  }
  return read
}

/** An id by name, or by the word of the site's picture of it (`plated-steelcaps-46x.png`) when the names differ. */
export function idOf(map: Map<string, number>, name: string, image?: string | null): number | null {
  const byName = map.get(nameKey(name))
  if (byName !== undefined) return byName
  const word = image?.match(/\/([a-z0-9-]+?)(?:-\d+x)?\.(?:png|jpg|jpeg|webp)$/)?.[1]
  return word ? map.get(nameKey(word)) ?? null : null
}

/** The app's own rune page of a guide's, when every rune of it is known; null otherwise, and the site's is drawn. */
export function runePageOf(page: GuideRunePage, index: GuideIndex): BuildRunePage | null {
  const ids = (runes: GuideRunePage['primary']['runes']) => runes.map(rune => idOf(index.runes, rune.name, rune.image))
  const primary = ids(page.primary.runes)
  const secondary = ids(page.secondary.runes)
  const shards = page.shards.map(shard => idOf(index.runes, shard.name, shard.image))
  const primaryStyle = index.styles.get(nameKey(page.primary.tree))
  const secondaryStyle = index.styles.get(nameKey(page.secondary.tree))
  const all = [...primary, ...secondary, ...shards]
  if (primary.length !== 4 || secondary.length !== 2 || shards.length !== 3 || !primaryStyle || !secondaryStyle || all.some(id => id === null)) return null
  const [keystone, perk1, perk2, perk3] = primary as number[]
  const [sub1, sub2] = secondary as number[]
  const [offense, flex, defense] = shards as number[]
  return {
    primaryStyleId: primaryStyle,
    primaryKeystoneId: keystone!,
    primaryPerk1Id: perk1!,
    primaryPerk2Id: perk2!,
    primaryPerk3Id: perk3!,
    secondaryStyleId: secondaryStyle,
    secondaryPerk1Id: sub1!,
    secondaryPerk2Id: sub2!,
    statOffense: offense!,
    statFlex: flex!,
    statDefense: defense!,
    games: 0,
    pickRate: 0,
    winRate: 0,
  }
}
