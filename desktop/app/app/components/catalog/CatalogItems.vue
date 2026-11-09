<script setup lang="ts">
import { formatCount } from '#shared/utils/counts'
import type { StaticItemData } from '#shared/types/static-data'
import type { CatalogGroup } from '~/utils/item-catalog'
import { CATALOG_GROUPS, buildCatalog, searchCatalog } from '~/utils/item-catalog'

/**
 * Every item, searched by name, grouped as the kit editor's picker groups
 * them, each with its description and recipe on the right. The Rift's shop by
 * default; a switch adds the other modes' items.
 */
const props = defineProps<{
  items: Record<number, StaticItemData>
  loading: boolean
}>()

const { t } = useT()
const query = ref('')
const group = ref<CatalogGroup | 'all'>('all')
const allModes = ref(false)
const selectedId = ref<number | null>(null)

const entries = computed(() => buildCatalog(props.items, allModes.value))
const sections = computed(() => searchCatalog(entries.value, query.value, group.value === 'all' ? null : group.value))
const total = computed(() => sections.value.reduce((sum, section) => sum + section.entries.length, 0))
const selected = computed(() => entries.value.find(entry => entry.item.id === selectedId.value) ?? null)

const tabs = computed(() => [
  { label: t('items.group.all'), value: 'all' },
  ...CATALOG_GROUPS.map(({ group: value, label }) => ({ label: t(label), value })),
])

watch([sections, selectedId], () => {
  if (selected.value) return
  selectedId.value = sections.value[0]?.entries[0]?.item.id ?? null
}, { immediate: true })

/** A recipe icon may name an item the current filter hides: the filter gives way to it. */
function select(itemId: number) {
  if (!entries.value.some(entry => entry.item.id === itemId)) allModes.value = true
  selectedId.value = itemId
}
</script>

<template>
  <div class="surface grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,26rem)] overflow-hidden rounded-xl">
    <div class="flex min-h-0 flex-col border-r border-default">
      <div class="space-y-2 border-b border-default p-3">
        <UInput v-model="query" icon="i-lucide-search" :placeholder="t('items.search')" class="w-full" :aria-label="t('items.search')" />
        <div class="flex flex-wrap items-center gap-3">
          <UTabs
            v-model="group"
            :items="tabs"
            :content="false"
            variant="pill"
            color="neutral"
            size="xs"
            :aria-label="t('items.groups')"
            :ui="{ list: 'ring ring-default', indicator: 'rounded-md bg-accented shadow-none', trigger: 'px-2.5 data-[state=active]:text-highlighted' }"
          />
          <USwitch v-model="allModes" size="sm" :label="t('items.allModes')" class="ml-auto" />
        </div>
      </div>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-3">
        <div v-if="loading && Object.keys(items).length === 0" aria-busy="true" class="space-y-2">
          <USkeleton v-for="row in 10" :key="row" class="h-12 w-full" />
        </div>
        <template v-else>
          <section v-for="section in sections" :key="section.group">
            <h2 class="sticky top-0 z-10 -mx-3 mb-1.5 flex items-center gap-2 bg-muted px-5 py-1.5"><span class="stat-label">{{ section.label }}</span><span class="rounded-full bg-accented px-1.5 text-[10px] text-muted">{{ section.entries.length }}</span></h2>
            <ul class="space-y-1">
              <li v-for="entry in section.entries" :key="entry.item.id">
                <button
                  type="button"
                  class="group flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-left transition hover:border-default hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
                  :class="entry.item.id === selectedId ? '!border-primary/50 bg-elevated' : ''"
                  :aria-current="entry.item.id === selectedId"
                  @click="selectedId = entry.item.id"
                >
                  <SkeletonImage
                    :src="entry.item.iconUrl"
                    :alt="entry.item.name"
                    :width="44"
                    :height="44"
                   
                    class="size-11 shrink-0 rounded-lg ring-1 transition"
                    :class="entry.item.id === selectedId ? 'ring-primary' : 'ring-default group-hover:ring-accented'"
                  />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium text-highlighted">{{ entry.item.name }}</span>
                    <span v-if="entry.item.plaintext" class="block truncate text-xs text-muted">{{ entry.item.plaintext }}</span>
                  </span>
                  <span v-if="entry.item.totalGold > 0" class="flex shrink-0 items-center gap-1 rounded-md bg-default/60 px-2 py-1 text-xs font-semibold text-stat-active">
                    <UIcon name="i-lucide-circle-dollar-sign" class="size-3.5" />{{ formatCount(entry.item.totalGold) }}
                  </span>
                </button>
              </li>
            </ul>
          </section>
          <p v-if="total === 0" class="py-8 text-center text-sm text-muted">
            {{ query ? t('items.noMatch', { query }) : t('items.empty') }}
          </p>
        </template>
      </div>
    </div>

    <aside class="min-h-0 overflow-y-auto bg-muted/50 p-4" :aria-label="t('items.detail')">
      <CatalogItemDetail v-if="selected" :entry="selected" :items="items" @select="select" />
      <p v-else class="py-8 text-center text-sm text-muted">{{ t('items.pick') }}</p>
    </aside>
  </div>
</template>
