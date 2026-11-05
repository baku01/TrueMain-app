import type { ChampionText } from '~/utils/jev-read'
import { plainAbility } from '~/utils/jev-build'

/**
 * A champion as Jev reads it (`utils/jev-read`): its English name, Riot's
 * classes, its passive and abilities in English (`useJevTexts`), each cut to
 * `chars`. The kits must be loaded first (`loadAll`), or a kit is empty.
 */
export function useChampionTexts() {
  const { champions } = useChampionStatics()
  const english = useJevTexts()

  function textOf(id: number, chars = 420): ChampionText | null {
    const champion = champions.value.get(id)
    if (!champion) return null
    const kit = english.champion(id)
    const abilities = Object.values(kit?.championSpells ?? {}).map(spell => ({ key: spell.key, name: spell.name, description: plainAbility(spell.description, chars) }))
    return { id, name: kit?.championName ?? champion.name, classes: champion.tags ?? [], kit: abilities }
  }

  /** Every champion's English kit loaded, so it reads whole; one that fails reads by its classes alone. */
  const loadAll = (ids: number[]) => english.loadChampions(ids)

  return { textOf, loadAll }
}
