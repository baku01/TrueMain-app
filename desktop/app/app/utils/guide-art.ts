import { nameKey } from '~/utils/guide-entities'
import { DDRAGON } from '~/utils/static-data'

/**
 * The game's own art for what a MOBAFire guide pictures. The site files a
 * champion's skin under one word — its banner `/images/champion/skins/banner/
 * briar-street-demons.jpg`, an author's or a listing's picture `/images/
 * avatars/briar-street-demons.png` — drawn small and squeezed hard; Data
 * Dragon has the same skin's splash, loading art and tile at full size, filed
 * by the champion's alias and the skin's number (`Briar_1`). The word is
 * matched against the skin names of the champion's `en_US` file (`Street
 * Demons Briar`), the language MOBAFire writes in.
 */

/** What the guides read of a champion's `en_US` file: its skins, and the names of its abilities. */
export interface EnglishChampion {
  name: string
  skins: { num: number, name: string }[]
  passive: { name: string } | null
  /** Q, W, E and R, in that order. */
  spells: { name: string }[]
}

interface ChampionDetailFile {
  data: Record<string, { name: string, skins?: { num: number, name: string }[], passive?: { name: string }, spells?: { name: string }[] }>
}

const details = new Map<string, Promise<EnglishChampion>>()

/** A champion's `en_US` file of the patch, read once; a failed read is not kept. */
export function englishChampion(patch: string, alias: string): Promise<EnglishChampion> {
  const key = `${patch}:${alias}`
  let read = details.get(key)
  if (!read) {
    read = $fetch<ChampionDetailFile>(`${DDRAGON}/${patch}/data/en_US/champion/${alias}.json`).then((file) => {
      const entry = file.data[alias] ?? Object.values(file.data)[0]
      return {
        name: entry?.name ?? alias,
        skins: entry?.skins?.map(skin => ({ num: skin.num, name: skin.name })) ?? [],
        passive: entry?.passive ? { name: entry.passive.name } : null,
        spells: entry?.spells?.map(spell => ({ name: spell.name })) ?? [],
      }
    })
    details.set(key, read)
    read.catch(() => details.delete(key))
  }
  return read
}

/** The skin's word of a MOBAFire picture (`briar-street-demons`); null for a picture that is no champion's skin. */
export function skinWord(src: string | null | undefined): string | null {
  return src?.match(/\/images\/(?:champion\/skins\/[a-z-]+|avatars)\/([a-z0-9-]+)\.(?:jpe?g|png|webp)(?:$|\?)/i)?.[1]?.toLowerCase() ?? null
}

/** A word as its letters, MOBAFire's `&` (`nunu-amp-willump`) read as the space it stands for. */
const wordKey = (word: string) => nameKey(word.replace(/(^|-)amp(?=-|$)/g, '$1'))

/**
 * The champion a skin's word starts with, among the index's (`nameKey` →
 * id): the longest name that fits, so `nunu-amp-willump-…` is Nunu & Willump
 * and never a shorter name that happens to start it.
 */
export function championOfWord(word: string, champions: Map<string, number>): number | null {
  const key = wordKey(word)
  let found: { id: number, length: number } | null = null
  for (const [name, id] of champions) {
    if (name && key.startsWith(name) && (!found || name.length > found.length)) found = { id, length: name.length }
  }
  return found?.id ?? null
}

/**
 * The number of the skin a MOBAFire word names, among the champion's skins as
 * Data Dragon names them: `briar-street-demons` is `Street Demons Briar`, 1;
 * the champion's word alone is the base skin, 0. Matched whole, letters only,
 * the champion's name taken out of both — so a chroma (`Street Demons Briar
 * (Ruby)`), which has no art of its own, is never taken for its skin. Null for
 * a word of another champion's or of a skin the file does not list yet.
 */
export function skinNumOf(word: string, champion: string, skins: { num: number, name: string }[]): number | null {
  const championKey = nameKey(champion)
  const key = wordKey(word)
  if (!championKey || !key.startsWith(championKey)) return null
  const rest = key.slice(championKey.length)
  if (rest === '' || rest === 'default' || rest === 'classic' || rest === 'base') return 0
  for (const skin of skins) {
    if (skin.num === 0) continue
    const whole = nameKey(skin.name)
    if (rest === whole || rest === whole.replace(championKey, '')) return skin.num
  }
  return null
}

/** One skin's tile (380 × 380): the square of its splash, for a picture the size of an avatar. */
export const tileOfSkin = (alias: string, skin: number) => `${DDRAGON}/img/champion/tiles/${alias}_${skin}.jpg`
