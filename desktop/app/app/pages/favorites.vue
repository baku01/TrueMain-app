<script setup lang="ts">
/**
 * The starred champions (#2080), kept on this device. The site's page also
 * lists followed truemains; the app does not follow players, so only the
 * champions are here.
 */
const { t } = useT()
const { champions: favorites, championsHydrated, clearChampions } = useFavoriteChampions()
const { data: championsData } = useChampionStaticList()
const championsById = useChampionsById(computed(() => championsData.value ?? []))
</script>

<template>
  <SharedPage :eyebrow="t('nav.favorites')" :title="t('app.page.favorites')">
    <div class="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader :eyebrow="t('nav.favorites')" :title="t('pages.favorites.title')">
        <UButton
          v-if="championsHydrated && favorites.length"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-trash-2"
          :label="t('pages.favorites.clearAll')"
          @click="clearChampions"
        />
      </PageHeader>

      <div v-if="!championsHydrated" class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <USkeleton v-for="i in 3" :key="i" class="h-14 w-full" />
      </div>
      <UEmpty
        v-else-if="!favorites.length"
        icon="i-lucide-star"
        :title="t('pages.favorites.emptyTitle')"
        :actions="[{ to: '/champions', color: 'primary', variant: 'soft', icon: 'i-lucide-swords', label: t('pages.favorites.browseChampions') }]"
      />
      <div v-else class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <FavoritesChampionRow
          v-for="favorite in favorites"
          :key="`${favorite.championId}:${favorite.position}`"
          :favorite="favorite"
          :champions-by-id="championsById"
        />
      </div>
    </div>
  </SharedPage>
</template>
