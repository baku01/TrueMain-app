<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { LibraryFilters, LibraryGrouping, LibraryItem, LibraryKind, LibraryResult } from '~/utils/recording-library'
import { getQueueLabel } from '#common/utils/queues'

const { t } = useT()

/**
 * The Recordings page's toolbar, the reference's: a search over titles and
 * champions, All / Clips / Full games, a champion, favourites only, and a
 * "More" menu for queue and result; on the right what is shown and how it is
 * grouped. Options list only what the library holds.
 */
const props = defineProps<{
  items: LibraryItem[]
  shown: string
}>()
const filters = defineModel<LibraryFilters>('filters', { required: true })
const grouping = defineModel<LibraryGrouping>('grouping', { required: true })

const { nameOf, portraitOf } = useChampionStatics()

const KINDS: { value: LibraryKind, label: string }[] = [
  { value: 'all', label: t('rec.toolbar.all') },
  { value: 'clips', label: t('rec.toolbar.clips') },
  { value: 'games', label: t('rec.toolbar.games') },
]
const GROUPINGS: { value: LibraryGrouping, label: string }[] = [
  { value: 'day', label: t('rec.toolbar.day') },
  { value: 'game', label: t('rec.toolbar.game') },
  { value: 'champion', label: t('rec.toolbar.champion') },
  { value: 'none', label: t('rec.toolbar.none') },
]
const RESULTS: { value: LibraryResult, label: string }[] = [
  { value: 'all', label: t('rec.toolbar.anyResult') },
  { value: 'win', label: t('rec.toolbar.victories') },
  { value: 'loss', label: t('rec.toolbar.defeats') },
]

const set = <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) =>
  (filters.value = { ...filters.value, [key]: value })

const champions = computed(() => {
  const ids = [...new Set(props.items.map(item => item.championId).filter((id): id is number => id !== null))]
  return ids
    .map(id => ({ label: nameOf(id), value: id, avatar: { src: portraitOf(id) ?? undefined, alt: nameOf(id) } }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

const champion = computed({
  get: () => filters.value.championId ?? undefined,
  set: (id: number | undefined | null) => set('championId', id ?? null),
})

const queues = computed(() => {
  const labels = new Map<string, number[]>()
  for (const id of new Set(props.items.map(item => item.queueId))) {
    const label = getQueueLabel(id)
    labels.set(label, [...(labels.get(label) ?? []), id])
  }
  return [...labels.entries()].map(([label, ids]) => ({ label, ids }))
})

function toggleQueue(ids: number[], on: boolean) {
  const rest = filters.value.queues.filter(id => !ids.includes(id))
  set('queues', on ? [...rest, ...ids] : rest)
}

const more = computed<DropdownMenuItem[][]>(() => [
  [
    { label: t('rec.toolbar.queue'), type: 'label' },
    ...queues.value.map(queue => ({
      label: queue.label,
      type: 'checkbox' as const,
      checked: queue.ids.every(id => filters.value.queues.includes(id)),
      onUpdateChecked: (on: boolean) => toggleQueue(queue.ids, on),
      onSelect: (event: Event) => event.preventDefault(),
    })),
  ],
  [
    { label: t('rec.toolbar.result'), type: 'label' },
    ...RESULTS.map(result => ({
      label: result.label,
      type: 'checkbox' as const,
      checked: filters.value.result === result.value,
      onUpdateChecked: () => set('result', result.value),
      onSelect: (event: Event) => event.preventDefault(),
    })),
  ],
])

const moreActive = computed(() => filters.value.queues.length + (filters.value.result === 'all' ? 0 : 1))
</script>

<template>
  <div class="flex items-center gap-2">
    <UInput
      :model-value="filters.search"
      icon="i-lucide-search"
      :placeholder="t('rec.toolbar.search')"
      size="sm"
      class="w-44"
      @update:model-value="set('search', String($event))"
    />

    <RecordingsSegmented :model-value="filters.kind" :items="KINDS" @update:model-value="set('kind', $event)" />

    <USelectMenu
      v-model="champion"
      :items="champions"
      value-key="value"
      :placeholder="t('rec.toolbar.champion')"
      :clear="champion !== undefined"
      size="sm"
      class="w-36"
      :search-input="{ placeholder: t('rec.toolbar.championSearch') }"
    />

    <UButton
      icon="i-lucide-star"
      size="sm"
      :color="filters.pinnedOnly ? 'primary' : 'neutral'"
      :variant="filters.pinnedOnly ? 'soft' : 'outline'"
      :aria-pressed="filters.pinnedOnly"
      :aria-label="t('rec.toolbar.pinned')"
      :title="t('rec.toolbar.pinned')"
      @click="set('pinnedOnly', !filters.pinnedOnly)"
    />

    <UDropdownMenu :items="more" :content="{ align: 'start' }">
      <UButton
        icon="i-lucide-list-filter"
        :label="moreActive ? t('rec.toolbar.moreCount', { count: moreActive }) : t('rec.toolbar.more')"
        size="sm"
        :color="moreActive ? 'primary' : 'neutral'"
        :variant="moreActive ? 'soft' : 'outline'"
      />
    </UDropdownMenu>

    <span class="ml-auto shrink-0 text-xs text-muted tabular-nums">{{ shown }}</span>
    <USelect v-model="grouping" :items="GROUPINGS" value-key="value" size="sm" class="w-28" :aria-label="t('rec.toolbar.groupBy')" />
  </div>
</template>
