<script setup lang="ts">
import type { ClassId, SubclassId } from '~/utils/champion-classes'
import { groupChampions, subclassesOf } from '~/utils/champion-classes'

/**
 * Champions by class and subclass (Riot's scheme: a Mage is a Burst Mage, a
 * Battle Mage or an Artillery Mage), each with a line on what it does in a
 * game. A class is a card, its subclasses panels side by side inside it, so a
 * class reads at a glance instead of as a long column. The tabs and the filter
 * stay pinned while scrolling: a tab narrows to one class, the filter by name.
 * A click opens the champion's page.
 */
const { t } = useT()
const { champions, nameOf } = useChampionStatics()

const query = ref('')
const selected = ref<ClassId | 'all'>('all')

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const words = computed(() => fold(query.value).split(/\s+/).filter(Boolean))

const ids = computed(() => [...champions.value.keys()].filter((id) => {
  const name = fold(nameOf(id))
  return words.value.every(word => name.includes(word))
}))

const tree = computed(() => groupChampions(ids.value, (a, b) => nameOf(a).localeCompare(nameOf(b))))
const visible = computed(() => tree.value.groups
  .filter(group => group.total > 0 && (selected.value === 'all' || group.class.id === selected.value))
  .map(group => ({ ...group, subclasses: group.subclasses.filter(entry => entry.champions.length > 0) })))
const showUnclassified = computed(() => selected.value === 'all' && tree.value.unclassified.length > 0)
const empty = computed(() => visible.value.length === 0 && !showUnclassified.value)

/** The tabs count the whole roster, not the filter: a tab that vanished while typing would move under the cursor. */
const totals = computed(() => groupChampions([...champions.value.keys()], () => 0).groups)
const tabs = computed(() => [
  { value: 'all' as const, label: t('classes.all'), icon: 'i-ph-squares-four-light', count: champions.value.size },
  ...totals.value.map(group => ({ value: group.class.id, label: t(`class.${group.class.id}.name`), icon: group.class.icon, count: group.total })),
])

const count = (n: number) => t(n === 1 ? 'classes.champions.one' : 'classes.champions.other', { count: n })

/** Subclass panels per row: two side by side, three for the classes that have three or more. */
const columns = (n: number) => n === 1 ? '' : n === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-2 xl:grid-cols-3'

/** Other subclasses of a champion, for its tooltip: a diver that is also a skirmisher says so. */
function alsoTitle(id: number, here: SubclassId) {
  const others = subclassesOf(id).filter(sub => sub !== here).map(sub => t(`sub.${sub}.name`))
  return others.length ? `${nameOf(id)} · ${t('classes.alsoIn', { subclasses: others.join(', ') })}` : nameOf(id)
}
</script>

<template>
  <SharedPage :eyebrow="t('classes.eyebrow')" :title="t('classes.page.title')">
    <div class="mx-auto max-w-6xl p-4 md:p-6">
      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <PageHeader :eyebrow="t('classes.eyebrow')" :title="t('classes.page.title')" :description="t('classes.page.description')" />
        <UInput
          v-model="query"
          icon="i-lucide-filter"
          :placeholder="t('classes.search')"
          :aria-label="t('classes.search')"
          class="w-full md:w-64 md:shrink-0"
        >
          <template v-if="query" #trailing>
            <UButton color="neutral" variant="link" size="sm" icon="i-lucide-x" :aria-label="t('classes.clear')" @click="query = ''" />
          </template>
        </UInput>
      </div>

      <!-- Pinned to the top of the scroll area, so changing class never means scrolling back up. -->
      <div class="sticky top-0 z-10 -mx-4 mt-5 border-b border-default bg-muted/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div class="flex flex-wrap gap-1.5" role="group" :aria-label="t('classes.page.title')">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            class="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            :class="selected === tab.value ? 'border-primary/50 bg-primary/10 text-highlighted' : 'border-default text-muted hover:bg-elevated hover:text-default'"
            :aria-pressed="selected === tab.value"
            @click="selected = tab.value"
          >
            <UIcon :name="tab.icon" class="size-4" :class="selected === tab.value ? 'text-primary' : ''" />
            {{ tab.label }}
            <span class="text-[11px] tabular-nums text-dimmed">{{ tab.count }}</span>
          </button>
        </div>
      </div>

      <div class="mt-6 space-y-8">
        <section
          v-for="group in visible"
          :key="group.class.id"
          :aria-labelledby="`class-${group.class.id}`"
          class="surface rounded-2xl p-4 md:p-5"
        >
          <header class="flex items-start gap-4">
            <span class="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
              <UIcon :name="group.class.icon" class="size-6" />
            </span>
            <div class="min-w-0">
              <h2 :id="`class-${group.class.id}`" class="flex items-baseline gap-2.5 text-xl font-semibold tracking-tight text-highlighted">
                {{ t(`class.${group.class.id}.name`) }}
                <span class="text-sm font-normal text-dimmed">{{ count(group.total) }}</span>
              </h2>
              <p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{{ t(`class.${group.class.id}.desc`) }}</p>
              <p v-if="group.class.id === 'marksman'" class="mt-2 flex max-w-3xl items-start gap-1.5 text-xs leading-relaxed text-dimmed">
                <UIcon name="i-lucide-info" class="mt-0.5 size-3.5 shrink-0" />{{ t('classes.community') }}
              </p>
            </div>
          </header>

          <div class="mt-4 grid gap-3" :class="columns(group.class.subclasses.length)">
            <div
              v-for="sub in group.subclasses"
              :key="sub.subclass"
              class="flex flex-col surface rounded-xl p-3.5"
            >
              <div v-if="group.class.subclasses.length > 1" class="mb-3">
                <h3 class="flex items-center gap-2 text-sm font-semibold text-highlighted before:h-4 before:w-0.5 before:rounded-full before:bg-primary/70">
                  {{ t(`sub.${sub.subclass}.name`) }}
                  <span class="rounded-full bg-accented px-1.5 text-[11px] font-normal tabular-nums text-muted">{{ sub.champions.length }}</span>
                </h3>
                <p class="mt-1 text-[13px] leading-snug text-muted">{{ t(`sub.${sub.subclass}.desc`) }}</p>
              </div>
              <ul class="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-1">
                <li v-for="id in sub.champions" :key="id">
                  <ClassesChampionTile :champion-id="id" :title="alsoTitle(id, sub.subclass)" />
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section v-if="showUnclassified" aria-labelledby="class-unclassified" class="surface rounded-2xl p-4 md:p-5">
          <h2 id="class-unclassified" class="flex items-baseline gap-2.5 text-base font-semibold text-highlighted">
            {{ t('classes.unclassified') }}
            <span class="text-sm font-normal text-dimmed">{{ count(tree.unclassified.length) }}</span>
          </h2>
          <p class="mt-1 text-xs text-muted">{{ t('classes.unclassified.hint') }}</p>
          <ul class="mt-3 grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-1">
            <li v-for="id in tree.unclassified" :key="id">
              <ClassesChampionTile :champion-id="id" />
            </li>
          </ul>
        </section>

        <EmptyState v-if="empty" icon="i-lucide-search-x" :title="t('classes.noMatch', { query })" />
      </div>
    </div>
  </SharedPage>
</template>
