<script setup lang="ts">
import type { GuideCategory, GuideFilters, GuideRole, GuideSort } from '~/utils/mobafire'
import { DEFAULT_FILTERS, GUIDE_CATEGORIES, GUIDE_ROLES, GUIDE_SORTS } from '~/utils/mobafire'
import { guidePosition, guideRoleOf } from '~/utils/guide-roles'

/**
 * MOBAFire's build guides, as a table to read down: one bar of filters — a
 * champion to search, the lanes as the app's own picker, a category, the
 * order, ranked authors only —, then the guides by the site's sections, a row
 * each (`GuidesListRow`) under the columns they line up in, the pages, and
 * the trending guides beside them (`useGuideList`). The filters live in the
 * query, so going back from a guide lands on the same list.
 */
const { t } = useT()
const route = useRoute()
const router = useRouter()
const checking = useMobafireCheck()
// The guide index read now, while the list is read: a guide opened from it finds its champion's art and items at once.
useGuideIndex()

const word = (value: unknown) => (typeof value === 'string' && value ? value : null)
const filters = computed<GuideFilters>(() => {
  const role = word(route.query.role)
  const category = word(route.query.category)
  const sort = word(route.query.sort)
  return {
    champion: word(route.query.champion)?.match(/^[a-z0-9-]+$/)?.[0] ?? null,
    role: (GUIDE_ROLES as readonly string[]).includes(role ?? '') ? role as GuideRole : null,
    category: (GUIDE_CATEGORIES as readonly string[]).includes(category ?? '') ? category as GuideCategory : null,
    sort: (GUIDE_SORTS as readonly string[]).includes(sort ?? '') ? sort as GuideSort : DEFAULT_FILTERS.sort,
    ranked: route.query.author === 'ranked',
    page: Math.max(1, Number(route.query.page) || 1),
  }
})

/** A filter changed: back to the first page, unless the page itself is what changed. */
function set(change: Partial<GuideFilters>) {
  const next = { ...filters.value, ...('page' in change ? {} : { page: 1 }), ...change }
  const query: Record<string, string> = {}
  if (next.champion) query.champion = next.champion
  if (next.role) query.role = next.role
  if (next.category) query.category = next.category
  if (next.sort !== DEFAULT_FILTERS.sort) query.sort = next.sort
  if (next.ranked) query.author = 'ranked'
  if (next.page > 1) query.page = String(next.page)
  void router.replace({ query })
}

const { list, status, champions, translating, reload } = useGuideList(filters)

const championItems = computed(() => champions.value.map(champion => ({
  label: champion.name,
  value: champion.slug,
  // Searched too: the site's other names for the champion (`mf`, `TF`, `Nunu`).
  aliases: champion.aliases.join(' '),
  avatar: champion.image ? { src: champion.image, alt: '' } : undefined,
})))
const champion = computed({
  get: () => filters.value.champion ?? undefined,
  set: value => set({ champion: value ?? null }),
})

/** The categories as the select lists them, "all" first. */
const ALL = 'all'
const categoryItems = computed(() => [{ label: t('guides.anyCategory'), value: ALL }, ...GUIDE_CATEGORIES.map(category => ({ label: t(`guides.category.${category}`), value: category }))])
const category = computed({
  get: () => filters.value.category ?? ALL,
  set: (value: string) => set({ category: value === ALL ? null : value as GuideCategory }),
})
const SORT_ICONS: Record<GuideSort, string> = { updated: 'i-lucide-refresh-cw', top: 'i-lucide-star', newest: 'i-lucide-sparkles' }

const empty = computed(() => status.value === 'ready' && !!list.value && list.value.sections.every(section => section.guides.length === 0))
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-6 *:shrink-0">
    <PageHeader :title="t('guides.title')" :description="t('guides.description')">
      <template #actions>
        <UBadge :label="t('guides.source')" color="neutral" variant="subtle" size="sm" />
        <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" size="sm" :loading="status === 'loading'" :aria-label="t('guides.retry')" @click="reload()" />
      </template>
    </PageHeader>

    <p v-if="checking" class="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-default">
      <UIcon name="i-lucide-shield-check" class="size-4 shrink-0 text-primary" />{{ t('guides.check') }}
    </p>

    <!-- The filters, one bar: a champion, a lane, a category; the order and the authors at its end. -->
    <section class="surface flex flex-wrap items-center gap-2 rounded-xl p-3">
      <USelectMenu
        v-model="champion"
        :items="championItems"
        value-key="value"
        :filter-fields="['label', 'aliases']"
        :search-input="{ placeholder: t('guides.searchChampion') }"
        :placeholder="t('guides.anyChampion')"
        icon="i-lucide-search"
        class="w-52"
        :aria-label="t('guides.champion')"
      />
      <UButton v-if="filters.champion" icon="i-lucide-x" color="neutral" variant="ghost" size="sm" :aria-label="t('guides.anyChampion')" @click="set({ champion: null })" />
      <RolePicker :position="guidePosition(filters.role)" @update:position="value => set({ role: guideRoleOf(value) })" />
      <USelect v-model="category" :items="categoryItems" icon="i-lucide-layers" class="w-56" :aria-label="t('guides.category')" />

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <UFieldGroup class="rounded-md bg-default ring ring-inset ring-accented" :aria-label="t('guides.sort')">
          <UButton
            v-for="sort in GUIDE_SORTS"
            :key="sort"
            :label="t(`guides.sort.${sort}`)"
            :icon="SORT_ICONS[sort]"
            color="neutral"
            :variant="filters.sort === sort ? 'soft' : 'ghost'"
            :aria-pressed="filters.sort === sort"
            @click="set({ sort })"
          />
        </UFieldGroup>
        <UButton
          :label="t('guides.authorRanked')"
          :icon="filters.ranked ? 'i-lucide-badge-check' : 'i-lucide-badge'"
          :color="filters.ranked ? 'primary' : 'neutral'"
          :variant="filters.ranked ? 'soft' : 'outline'"
          :aria-pressed="filters.ranked"
          @click="set({ ranked: !filters.ranked })"
        />
      </div>
    </section>

    <div class="grid min-h-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <main class="@container flex min-w-0 flex-col gap-4">
        <div v-if="status === 'error'" class="surface rounded-xl p-8 text-center">
          <p class="text-sm text-muted">{{ t('guides.error') }}</p>
          <UButton class="mt-3" :label="t('guides.retry')" icon="i-lucide-refresh-cw" size="sm" @click="reload()" />
        </div>
        <div v-else-if="!list" aria-busy="true" class="surface flex flex-col gap-px overflow-hidden rounded-xl">
          <USkeleton v-for="row in 9" :key="row" class="h-20 w-full rounded-none" />
        </div>
        <p v-else-if="empty" class="surface rounded-xl p-8 text-center text-sm text-muted">{{ t('guides.empty') }}</p>
        <template v-else>
          <!-- A section of the site's, a table: its divider the first column's head, the rows lined up under it. -->
          <section
            v-for="(section, index) in list.sections.filter(entry => entry.guides.length)"
            :key="`${section.label}-${index}`"
            class="surface relative overflow-hidden rounded-xl transition-opacity"
            :class="status === 'loading' && 'opacity-60'"
          >
            <header class="guide-head relative grid items-center gap-x-4 border-b border-default/70 py-2 pr-4">
              <h2 class="stat-label col-span-2 truncate pl-4">{{ section.label ?? t('guides.title') }}</h2>
              <span class="guide-head-rank stat-label">{{ t('guides.authorRank') }}</span>
              <span class="stat-label">{{ t('guides.rating') }}</span>
              <GuidesGlint v-if="translating" />
            </header>
            <div class="divide-y divide-default/50">
              <GuidesListRow v-for="guide in section.guides" :key="guide.slug" :guide="guide" />
            </div>
          </section>
          <nav v-if="list.pages > 1" class="flex items-center justify-center gap-3 py-1">
            <UButton icon="i-lucide-chevron-left" :label="t('guides.previous')" color="neutral" variant="soft" size="sm" :disabled="filters.page <= 1" @click="set({ page: filters.page - 1 })" />
            <span class="text-sm tabular-nums text-muted">{{ t('guides.page', { page: filters.page, pages: list.pages }) }}</span>
            <UButton trailing-icon="i-lucide-chevron-right" :label="t('guides.next')" color="neutral" variant="soft" size="sm" :disabled="filters.page >= list.pages" @click="set({ page: filters.page + 1 })" />
          </nav>
        </template>
      </main>

      <!-- The trending guides, as the site's sidebar lists them. -->
      <aside v-if="list?.trending.length" class="surface flex flex-col gap-0.5 rounded-xl p-2 xl:sticky xl:top-0">
        <h2 class="stat-label flex items-center gap-1.5 px-2 pb-1.5 pt-1"><UIcon name="i-lucide-flame" class="size-3.5 text-primary" />{{ t('guides.trending') }}</h2>
        <NuxtLink
          v-for="(guide, rank) in list.trending"
          :key="guide.slug"
          :to="`/guides/${guide.slug}`"
          class="group flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-accented/40"
        >
          <span class="w-4 shrink-0 text-right text-xs font-bold tabular-nums text-dimmed">{{ rank + 1 }}</span>
          <GuidesSkinTile :picture="guide.image" class="size-10 shrink-0 rounded-md object-cover ring-1 ring-white/10" loading="lazy" />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="line-clamp-2 text-xs font-semibold leading-snug text-highlighted group-hover:text-primary">{{ guide.title }}</span>
            <span class="truncate text-[11px] text-muted">{{ t('guides.trendingBy', { author: guide.author, views: guide.views }) }}</span>
          </span>
          <span class="flex shrink-0 items-center gap-1 text-xs font-bold tabular-nums text-data-good"><UIcon name="i-lucide-thumbs-up" class="size-3" />{{ guide.votes }}</span>
        </NuxtLink>
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* The head of a section's table, on the rows' columns (`GuidesListRow`). */
.guide-head {
  grid-template-columns: 4.5rem minmax(0, 1fr) 8.5rem 8.5rem;
}

@container (width < 44rem) {
  .guide-head { grid-template-columns: 4.5rem minmax(0, 1fr) 8.5rem; }
  .guide-head-rank { display: none; }
}
</style>
