import { ddragonLocale, getActiveLocale } from '#common/utils/i18n'
import type {
  ChampionStaticData,
  RuneTreeResponse,
  StaticItemData,
  StaticSummonerSpellData,
} from '#shared/types/static-data'
import type { ChampionDetailResponse, ItemListResponse, SummonerListResponse } from '~/utils/static-data'
import { DDRAGON, fetchRuneTree, toChampionStatic, toItemsMap, toSummonersMap } from '~/utils/static-data'

/**
 * Items, summoner spells, the rune tree and champion spells, in the shapes the
 * site's static endpoints return — what the twinned tooltip and core-view
 * components take as props. Fetched once per patch and held for the session;
 * a champion's spells the first time it is asked for.
 *
 * `pending` flags mirror the site's: while a map is in flight its icons show a
 * loading box, and once it settles a still-missing icon is final.
 */
export function useStaticData() {
  const { patch, aliasOf, nameOf } = useChampionStatics()

  const items = useState<Record<number, StaticItemData>>('static-items', () => ({}))
  const summoners = useState<Record<number, StaticSummonerSpellData>>('static-summoners', () => ({}))
  const runeTree = useState<RuneTreeResponse | null>('static-rune-tree', () => null)
  const champions = useState<Record<number, ChampionStaticData>>('static-champions', () => ({}))
  const loadedFor = useState<string>('static-patch', () => '')
  const pending = useState<boolean>('static-pending', () => true)

  async function load(version: string) {
    if (!version || loadedFor.value === version) return
    loadedFor.value = version
    pending.value = true
    const [itemData, summonerData, tree] = await Promise.allSettled([
      $fetch<ItemListResponse>(`${DDRAGON}/${version}/data/${ddragonLocale(getActiveLocale())}/item.json`),
      $fetch<SummonerListResponse>(`${DDRAGON}/${version}/data/${ddragonLocale(getActiveLocale())}/summoner.json`),
      fetchRuneTree(version),
    ])
    // Held raw: read-only maps of hundreds of entries, replaced whole on a new
    // patch — a deep proxy over each would only cost memory.
    if (itemData.status === 'fulfilled') items.value = markRaw(toItemsMap(itemData.value, version))
    if (summonerData.status === 'fulfilled') summoners.value = markRaw(toSummonersMap(summonerData.value, version))
    if (tree.status === 'fulfilled') runeTree.value = markRaw(tree.value)
    // Offline: let the next patch read try again rather than keep empty maps.
    if ([itemData, summonerData, tree].some(result => result.status === 'rejected')) loadedFor.value = ''
    pending.value = false
  }

  watch(patch, load, { immediate: true })

  /** One champion's Q/W/E/R, fetched the first time it is asked for. */
  async function loadChampion(championId: number) {
    const version = patch.value
    const alias = aliasOf(championId)
    if (!version || !alias || champions.value[championId]) return
    try {
      const detail = await $fetch<ChampionDetailResponse>(`${DDRAGON}/${version}/data/${ddragonLocale(getActiveLocale())}/champion/${alias}.json`)
      champions.value = { ...champions.value, [championId]: markRaw(toChampionStatic(detail, alias, nameOf(championId), version)) }
    }
    catch {
      // The skill order falls back to its Q/W/E labels.
    }
  }

  const championStatic = (championId: number): ChampionStaticData | null => champions.value[championId] ?? null

  return { items, summoners, runeTree, pending, loadChampion, championStatic }
}
