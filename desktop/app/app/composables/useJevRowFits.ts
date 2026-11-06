import type { BuildOption } from '~/types/build'
import type { Needs } from '~/utils/jev-recommend'
import { itemReadKey, knownItemRead } from '~/utils/jev-read'
import type { RowFit } from '~/utils/jev-row-fit'
import { rowFits } from '~/utils/jev-row-fit'

/**
 * The build list's rows as Jev reads them against the draft (`utils/jev-row-fit`):
 * none until Jev has answered (`needs`, the team's needs of that answer), then
 * from the item reads it kept — the same patch key as `useJevBuild`'s.
 */
export function useJevRowFits(options: Ref<BuildOption[]>, championId: Ref<number>, position: Ref<string>, needs: Ref<Needs | null | undefined>) {
  const { patch } = useChampionStatics()
  const { items } = useStaticData()
  return computed<{ fits: Map<string, RowFit>, best: string | null }>(() => {
    const team = needs.value
    if (!team || !position.value) return { fits: new Map(), best: null }
    const version = patch.value || 'live'
    return rowFits(options.value, team, id => knownItemRead(itemReadKey(version, championId.value, position.value, id)), id => items.value[id]?.tags ?? [])
  })
}
