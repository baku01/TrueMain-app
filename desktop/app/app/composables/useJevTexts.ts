import type { ChampionStaticData, RuneTreeResponse, StaticItemData, StaticSummonerSpellData } from '#shared/types/static-data'
import type { ChampionDetailResponse, ItemListResponse, SummonerListResponse } from '~/utils/static-data'
import { ddragonLocale } from '#common/utils/i18n'
import { DDRAGON, fetchRuneTree, toChampionStatic, toItemsMap, toSummonersMap } from '~/utils/static-data'

/**
 * The game's texts in English, for Jev alone: items, summoner spells, runes
 * and champion kits as Data Dragon words them in `en_US`, whatever language
 * the app speaks. Jev's questions and criteria are English — "Grievous
 * Wounds", "Tenacity" — and a kit or an item read in Portuguese has to be
 * matched to them through a translation it makes on its own, where it errs.
 * Fetched once per patch, a champion the first time it is read, held for the
 * session; the app's own maps (`useStaticData`) stay in the player's language.
 */
export function useJevTexts() {
  const { patch, aliasOf } = useChampionStatics()
  const items = useState<Record<number, StaticItemData>>('jev-en-items', () => ({}))
  const summoners = useState<Record<number, StaticSummonerSpellData>>('jev-en-summoners', () => ({}))
  const runeTree = useState<RuneTreeResponse | null>('jev-en-runes', () => null)
  const champions = useState<Record<number, ChampionStaticData>>('jev-en-champions', () => ({}))
  const loadedFor = useState<string>('jev-en-patch', () => '')
  const english = ddragonLocale('en')

  /** The patch's items, spells and runes in English; a failed read is tried again on the next ask. */
  async function load() {
    const version = patch.value
    if (!version || loadedFor.value === version) return
    const [itemData, summonerData, tree] = await Promise.allSettled([
      $fetch<ItemListResponse>(`${DDRAGON}/${version}/data/${english}/item.json`),
      $fetch<SummonerListResponse>(`${DDRAGON}/${version}/data/${english}/summoner.json`),
      fetchRuneTree(version, 'en'),
    ])
    if (itemData.status === 'fulfilled') items.value = markRaw(toItemsMap(itemData.value, version))
    if (summonerData.status === 'fulfilled') summoners.value = markRaw(toSummonersMap(summonerData.value, version))
    if (tree.status === 'fulfilled') runeTree.value = markRaw(tree.value)
    if ([itemData, summonerData, tree].every(result => result.status === 'fulfilled')) loadedFor.value = version
  }

  /** Each champion's kit in English, its English name with it. */
  async function loadChampions(ids: number[]) {
    const version = patch.value
    if (!version) return
    await Promise.all(ids.map(async (id) => {
      const alias = aliasOf(id)
      if (!alias || champions.value[id]) return
      try {
        const detail = await $fetch<ChampionDetailResponse>(`${DDRAGON}/${version}/data/${english}/champion/${alias}.json`)
        champions.value = { ...champions.value, [id]: markRaw(toChampionStatic(detail, alias, detail.data[alias]?.name ?? alias, version)) }
      }
      catch {
        // A kit that could not be read is asked by the champion's classes alone.
      }
    }))
  }

  const champion = (id: number): ChampionStaticData | null => champions.value[id] ?? null

  return { items, summoners, runeTree, champion, load, loadChampions }
}
