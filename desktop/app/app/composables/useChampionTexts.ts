import type { ChampionText } from '~/utils/jev-read'
import { plainAbility } from '~/utils/jev-build'

/**
 * A champion as Jev reads it (`utils/jev-read`): its name, Riot's classes, its
 * passive and abilities in words, each cut to `chars`. The champion's own
 * data must be loaded first (`loadChampion`), or its kit is empty.
 */
export function useChampionTexts() {
  const { champions } = useChampionStatics()
  const { championStatic, loadChampion } = useStaticData()

  function textOf(id: number, chars = 360): ChampionText | null {
    const champion = champions.value.get(id)
    if (!champion) return null
    const kit = Object.values(championStatic(id)?.championSpells ?? {}).map(spell => ({ key: spell.key, name: spell.name, description: plainAbility(spell.description, chars) }))
    return { id, name: champion.name, classes: champion.tags ?? [], kit }
  }

  /** Every champion's own data loaded, so its kit reads whole; one that fails reads by its classes alone. */
  const loadAll = (ids: number[]) => Promise.all(ids.map(id => loadChampion(id).catch(() => {})))

  return { textOf, loadAll }
}
