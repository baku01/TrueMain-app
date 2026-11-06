<script setup lang="ts">
/**
 * Champion statistics across every champion, as Blitz's stats pages: the
 * best duos of two lanes, and win rate by mastery — which champions repay
 * the games put in. One tab each, underlined as the app's other pages lay
 * theirs; the tab is kept in the URL. A champion's own counters and
 * synergies are on its page.
 */
const { t } = useT()
const route = useRoute()
const router = useRouter()

type Tab = 'duos' | 'mastery'
const tab = computed<Tab>({
  get: () => (route.query.tab === 'mastery' ? 'mastery' : 'duos'),
  set: value => void router.replace({ query: { ...route.query, tab: value === 'duos' ? undefined : value } }),
})
const tabs = computed(() => [
  { value: 'duos' as const, label: t('stats.tab.duos'), icon: 'i-tabler-users' },
  { value: 'mastery' as const, label: t('stats.tab.mastery'), icon: 'i-tabler-medal' },
])
</script>

<template>
  <SharedPage :eyebrow="t('nav.group.champions')" :title="t('stats.title')">
    <div class="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <PageHeader :title="t('stats.title')" :description="tab === 'duos' ? t('stats.duos.description') : t('stats.mastery.description')">
        <template #tabs>
          <button
            v-for="entry in tabs"
            :key="entry.value"
            type="button"
            class="tm-tab flex items-center gap-1.5"
            :data-active="tab === entry.value || undefined"
            :aria-pressed="tab === entry.value"
            @click="tab = entry.value"
          >
            <UIcon :name="entry.icon" class="size-4" :class="tab === entry.value ? 'text-primary' : ''" />
            {{ entry.label }}
          </button>
        </template>
      </PageHeader>
      <StatsDuos v-if="tab === 'duos'" />
      <StatsMastery v-else />
    </div>
  </SharedPage>
</template>
