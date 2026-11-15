<script setup lang="ts">
import type { GuideCategory, GuideFilters, GuideRole, GuideSort } from '~/utils/mobafire'
import { DEFAULT_FILTERS, GUIDE_CATEGORIES, GUIDE_ROLES, GUIDE_SORTS } from '~/utils/mobafire'
import { guideRoleIcon } from '~/utils/guide-roles'

/**
 * MOBAFire's build guides, laid out as its browse page: a champion, a lane and
 * a category to filter by, the order and the authors, the guides by section
 * under the site's dividers, its pages, and the trending guides beside them
 * (`useGuideList`). The filters live in the query, so going back from a
 * guide lands on the same list.
 */
const { t } = useT()
const route = useRoute()
const router = useRouter()
const checking = useMobafireCheck()

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

const { list, status, champions, reload } = useGuideList(filters)

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

const empty = computed(() => status.value === 'ready' && !!list.value && list.value.sections.every(section => section.guides.length === 0))
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-6 *:shrink-0">
    <PageHeader class="shrink-0" :title="t('guides.title')" :description="t('guides.description')">
      <template #actions>
        <UBadge :label="t('guides.source')" color="neutral" variant="subtle" size="sm" />
        <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" size="sm" :loading="status === 'loading'" :aria-label="t('guides.retry')" @click="reload()" />
      </template>
    </PageHeader>

    <p v-if="checking" class="flex shrink-0 items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-default">
      <UIcon name="i-lucide-shield-check" class="size-4 shrink-0 text-primary" />{{ t('guides.check') }}
    </p>

    <div class="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <main class="flex min-w-0 flex-col gap-4">
        <!-- The filters: a champion, a lane, a category. -->
        <section class="surface flex flex-col gap-3 rounded-xl p-4">
          <div class="flex flex-wrap items-center gap-3">
            <span class="stat-label w-24">{{ t('guides.champion') }}</span>
            <USelectMenu
              v-model="champion"
              :items="championItems"
              value-key="value"
              :filter-fields="['label', 'aliases']"
              :search-input="{ placeholder: t('guides.searchChampion') }"
              :placeholder="t('guides.anyChampion')"
              class="w-64"
              :aria-label="t('guides.champion')"
            />
            <UButton v-if="filters.champion" icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="t('guides.anyChampion')" @click="set({ champion: null })" />
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <span class="stat-label w-24">{{ t('guides.role') }}</span>
            <div class="flex flex-wrap gap-1">
              <UButton :label="t('guides.allRoles')" size="sm" :color="filters.role ? 'neutral' : 'primary'" :variant="filters.role ? 'ghost' : 'soft'" @click="set({ role: null })" />
              <UButton
                v-for="role in GUIDE_ROLES"
                :key="role"
                :label="t(`guides.role.${role}`)"
                size="sm"
                :color="filters.role === role ? 'primary' : 'neutral'"
                :variant="filters.role === role ? 'soft' : 'ghost'"
                @click="set({ role })"
              >
                <template #leading><img :src="guideRoleIcon(role)" alt="" class="size-4"></template>
              </UButton>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <span class="stat-label w-24">{{ t('guides.category') }}</span>
            <div class="flex flex-wrap gap-1">
              <UButton :label="t('guides.allCategories')" size="sm" :color="filters.category ? 'neutral' : 'primary'" :variant="filters.category ? 'ghost' : 'soft'" @click="set({ category: null })" />
              <UButton
                v-for="category in GUIDE_CATEGORIES"
                :key="category"
                :label="t(`guides.category.${category}`)"
                size="sm"
                :color="filters.category === category ? 'primary' : 'neutral'"
                :variant="filters.category === category ? 'soft' : 'ghost'"
                @click="set({ category })"
              />
            </div>
          </div>
        </section>

        <!-- The order and the authors. -->
        <section class="surface flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl px-4 py-2.5">
          <div class="flex items-center gap-2">
            <span class="stat-label">{{ t('guides.sort') }}</span>
            <UButton
              v-for="sort in GUIDE_SORTS"
              :key="sort"
              :label="t(`guides.sort.${sort}`)"
              size="sm"
              :color="filters.sort === sort ? 'primary' : 'neutral'"
              :variant="filters.sort === sort ? 'soft' : 'ghost'"
              @click="set({ sort })"
            />
          </div>
          <div class="ml-auto flex items-center gap-2">
            <span class="stat-label">{{ t('guides.author') }}</span>
            <UButton :label="t('guides.authorAll')" size="sm" :color="filters.ranked ? 'neutral' : 'primary'" :variant="filters.ranked ? 'ghost' : 'soft'" @click="set({ ranked: false })" />
            <UButton :label="t('guides.authorRanked')" size="sm" :color="filters.ranked ? 'primary' : 'neutral'" :variant="filters.ranked ? 'soft' : 'ghost'" @click="set({ ranked: true })" />
          </div>
        </section>

        <div v-if="status === 'error'" class="surface rounded-xl p-8 text-center">
          <p class="text-sm text-muted">{{ t('guides.error') }}</p>
          <UButton class="mt-3" :label="t('guides.retry')" icon="i-lucide-refresh-cw" size="sm" @click="reload()" />
        </div>
        <div v-else-if="!list" aria-busy="true" class="flex flex-col gap-2">
          <USkeleton v-for="row in 8" :key="row" class="h-22 w-full rounded-xl" />
        </div>
        <p v-else-if="empty" class="surface rounded-xl p-8 text-center text-sm text-muted">{{ t('guides.empty') }}</p>
        <template v-else>
          <section v-for="(section, index) in list.sections" :key="`${section.label}-${index}`" class="flex flex-col gap-2" :class="status === 'loading' && 'opacity-60'">
            <h2 v-if="section.label" class="stat-label px-1">{{ section.label }}</h2>
            <GuidesListRow v-for="guide in section.guides" :key="guide.slug" :guide="guide" />
          </section>
          <nav v-if="list.pages > 1" class="flex items-center justify-center gap-3 py-2">
            <UButton icon="i-lucide-chevron-left" :label="t('guides.previous')" color="neutral" variant="soft" size="sm" :disabled="filters.page <= 1" @click="set({ page: filters.page - 1 })" />
            <span class="text-sm tabular-nums text-muted">{{ t('guides.page', { page: filters.page, pages: list.pages }) }}</span>
            <UButton trailing-icon="i-lucide-chevron-right" :label="t('guides.next')" color="neutral" variant="soft" size="sm" :disabled="filters.page >= list.pages" @click="set({ page: filters.page + 1 })" />
          </nav>
        </template>
      </main>

      <!-- The trending guides, as the site's sidebar lists them. -->
      <aside v-if="list?.trending.length" class="flex flex-col gap-2">
        <section class="surface flex flex-col gap-1 rounded-xl p-3">
          <h2 class="stat-label px-1 pb-1">{{ t('guides.trending') }}</h2>
          <NuxtLink
            v-for="guide in list.trending"
            :key="guide.slug"
            :to="`/guides/${guide.slug}`"
            class="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-accented/50"
          >
            <img v-if="guide.image" :src="guide.image" alt="" class="img-skeleton size-11 shrink-0 rounded-md" loading="lazy">
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-xs font-semibold text-highlighted">{{ guide.title }}</span>
              <span class="truncate text-[11px] text-muted">{{ t('guides.trendingBy', { author: guide.author, views: guide.views }) }}</span>
            </span>
            <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ring-1 ring-data-good/50 text-data-good">{{ guide.votes }}</span>
          </NuxtLink>
        </section>
      </aside>
    </div>
  </div>
</template>
