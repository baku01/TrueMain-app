import type { MaybeRefOrGetter } from 'vue'
import { championOfWord, englishChampion, skinNumOf, skinWord, tileOfSkin } from '~/utils/guide-art'
import { nameKey } from '~/utils/guide-entities'
import { splashOfSkin } from '~/composables/useChampionStatics'

/** A skin as Data Dragon files it: the champion, its alias, and the skin's number (0, the base art, when the word names no skin the file lists). */
export interface GuideSkin {
  championId: number
  alias: string
  num: number
}

/**
 * The skin a MOBAFire picture names (`utils/guide-art`) — a guide's banner,
 * an author's or a listing's avatar — and the game's art of it at full size:
 * its splash for a band, its tile for a square, its loading art for a card.
 * The champion is the picture's own, or `champion`'s (the guide's, by its
 * English name) where the picture names none; until the champion's file is
 * read, and for a skin it does not list yet, the champion's base art. Null for
 * a picture of no champion the app knows.
 */
export function useGuideSkin(picture: MaybeRefOrGetter<string | null | undefined>, champion?: MaybeRefOrGetter<string | null | undefined>) {
  const index = useGuideIndex()
  const { patch, aliasOf } = useChampionStatics()
  const skin = shallowRef<GuideSkin | null>(null)

  watch([() => toValue(picture), () => toValue(champion), index, patch], async ([src, name, known, version]) => {
    if (!known) {
      skin.value = null
      return
    }
    const word = skinWord(src)
    const championId = (word ? championOfWord(word, known.champions) : null) ?? (name ? known.champions.get(nameKey(name)) ?? null : null)
    const alias = championId ? aliasOf(championId) : null
    if (!championId || !alias) {
      skin.value = null
      return
    }
    // The base art at once; the skin's once the champion's file says which it is.
    if (skin.value?.championId !== championId) skin.value = { championId, alias, num: 0 }
    if (!word || !version) return
    const english = await englishChampion(version, alias).catch(() => null)
    if (!english || toValue(picture) !== src) return
    skin.value = { championId, alias, num: skinNumOf(word, english.name, english.skins) ?? 0 }
  }, { immediate: true })

  const splash = computed(() => (skin.value ? splashOfSkin(skin.value.alias, skin.value.num) : null))
  const tile = computed(() => (skin.value ? tileOfSkin(skin.value.alias, skin.value.num) : null))
  /** The base art of the skin's champion, where the skin's own fails to load. */
  const baseSplash = computed(() => (skin.value ? splashOfSkin(skin.value.alias, 0) : null))
  const baseTile = computed(() => (skin.value ? tileOfSkin(skin.value.alias, 0) : null))
  return { skin, splash, tile, baseSplash, baseTile }
}
