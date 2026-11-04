<script setup lang="ts">
// The desktop app's filter bar: the shared one's controls (`web/layers/common`), in one row from the left, as Blitz lays its own.
// The filter row of the champion lists — the /champions directory and the tier
// list (#2032): lane, champion search, rank, population and patch, all read
// from and written to the URL through `useChampionFilters`, so moving between
// the two pages keeps every control in place.
import type { ChampionStaticListItem } from '#shared/types/static-data'
import { isChampionPosition, type ChampionPosition } from '#common/utils/positions'
import { normalizeEloBracket } from '#common/utils/elo-brackets'

const props = defineProps<{
  champions: ChampionStaticListItem[]
  /** The patch the list's data came back for — shown when `?patch=` is absent. */
  apiPatch: string
  /** A paginated list: every filter change anchors back on page 1. */
  paginated?: boolean
}>()

const { t } = useT()
const { filters, setFilter } = useChampionFilters()
const filterChampionId = useRouteQueryChampionId()
const { data: versions } = useDDragonVersions()

// null = "All positions" — the RolePicker contract.
const selectedPosition = computed<ChampionPosition | null>(() => {
  const value = filters.value.position ?? ''
  return isChampionPosition(value) ? value : null
})

// The composable always resolves a concrete bracket (Master+ by default), so
// the picker always reflects the threshold actually being fetched.
const selectedEloBracket = computed<string>(() => normalizeEloBracket(filters.value.eloBracket))

const selectedPatch = computed(() => filters.value.patch || props.apiPatch || '')
const patchOptions = usePatchOptions(versions, () => props.apiPatch, () => filters.value.patch)

// `resetPage` drops `?page=` in the same router.replace on a paginated list.
function update(updates: Parameters<typeof setFilter>[0]) {
  void setFilter(updates, { resetPage: props.paginated })
}

function onPatchChange(value: unknown) {
  if (typeof value !== 'string' || !value) return
  update({ patch: value })
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <ChampionPicker
      :champions="champions"
      :champion-id="filterChampionId"
      :placeholder="t('champion.searchForChampion')"
      trigger-class="w-56"
      @update:champion-id="value => update({ championId: value })"
    />
    <RolePicker
      :position="selectedPosition"
      @update:position="value => update({ position: value })"
    />
    <ChampionEloFilter
      size="sm"
      :model-value="selectedEloBracket"
      @update:model-value="value => update({ eloBracket: value })"
    />
    <ChampionTruemainToggle
      :model-value="filters.truemainsOnly"
      @update:model-value="value => update({ truemainsOnly: value })"
    />
    <USelect
      :model-value="selectedPatch || undefined"
      :items="patchOptions"
      :placeholder="t('champion.patch')"
      size="sm"
      class="w-24"
      @update:model-value="onPatchChange"
    />
  </div>
</template>
