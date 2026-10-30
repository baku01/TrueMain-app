<script setup lang="ts">
/**
 * Items and runes: the whole of the patch's static data, read in the player's
 * language (`useStaticData`) — every item with its description and recipe,
 * every rune with its full text. The tab lives in the query so a link can
 * land on the runes.
 */
const { t } = useT()
const { items, runeTree, pending } = useStaticData()
const route = useRoute()
const router = useRouter()

const tab = computed({
  get: () => (route.query.tab === 'runes' ? 'runes' : 'items'),
  set: value => router.replace({ query: value === 'runes' ? { tab: 'runes' } : {} }),
})
const tabs = computed(() => [
  { label: t('items.tab.items'), value: 'items', icon: 'i-game-icons-spell-book' },
  { label: t('items.tab.runes'), value: 'runes', icon: 'i-lucide-sparkles' },
])
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4 p-5">
    <div class="flex flex-wrap items-center gap-3">
      <UIcon name="i-game-icons-spell-book" class="size-6 text-primary" />
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ t('items.page.title') }}</h1>
      <UTabs
        v-model="tab"
        :items="tabs"
        :content="false"
        variant="pill"
        color="neutral"
        size="sm"
        class="ml-auto"
        :aria-label="t('items.page.title')"
        :ui="{ list: 'ring ring-default', indicator: 'rounded-md bg-accented shadow-none', trigger: 'px-3 data-[state=active]:text-highlighted' }"
      />
    </div>

    <CatalogItems v-if="tab === 'items'" :items="items" :loading="pending" />
    <CatalogRunes v-else :rune-tree="runeTree" :loading="pending" />
  </div>
</template>
