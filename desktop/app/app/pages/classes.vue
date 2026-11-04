<script setup lang="ts">
import type { ClassId, SubclassId } from '~/utils/champion-classes'
import { groupChampions, subclassesOf } from '~/utils/champion-classes'

/**
 * Champions by class and subclass (Riot's scheme: a Mage is a Burst Mage, a
 * Battle Mage or an Artillery Mage), each with a line on what it does in a
 * game. Laid out like the tier list: a row per class, its emblem and count in
 * a column on the left, its subclasses side by side on the right, each with
 * its line and its champions. The page header carries the filter by name and,
 * under it, the classes as tabs. A click opens the champion's page.
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

/** Subclasses per row: two side by side, three for the classes that have three or more. */
const columns = (n: number) => n === 1 ? '' : n === 2 ? '@3xl:grid-cols-2' : '@3xl:grid-cols-2 @6xl:grid-cols-3'

/** Other subclasses of a champion, for its tooltip: a diver that is also a skirmisher says so. */
function alsoTitle(id: number, here: SubclassId) {
  const others = subclassesOf(id).filter(sub => sub !== here).map(sub => t(`sub.${sub}.name`))
  return others.length ? `${nameOf(id)} · ${t('classes.alsoIn', { subclasses: others.join(', ') })}` : nameOf(id)
}
</script>

<template>
  <SharedPage :eyebrow="t('classes.eyebrow')" :title="t('classes.page.title')">
    <div class="@container mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <PageHeader :title="t('classes.page.title')" :description="t('classes.page.description')">
        <template #actions>
          <UInput v-model="query" icon="i-lucide-search" size="sm" :placeholder="t('classes.search')" :aria-label="t('classes.search')" class="w-60">
            <template v-if="query" #trailing>
              <UButton color="neutral" variant="link" size="sm" icon="i-lucide-x" :aria-label="t('classes.clear')" @click="query = ''" />
            </template>
          </UInput>
        </template>
        <template #tabs>
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            class="tm-tab flex items-center gap-1.5"
            :data-active="selected === tab.value || undefined"
            :aria-pressed="selected === tab.value"
            @click="selected = tab.value"
          >
            <UIcon :name="tab.icon" class="size-4" :class="selected === tab.value ? 'text-primary' : ''" />
            {{ tab.label }}
            <span class="text-[11px] tabular-nums text-dimmed">{{ tab.count }}</span>
          </button>
        </template>
      </PageHeader>

      <div class="space-y-3">
        <section
          v-for="group in visible"
          :key="group.class.id"
          :aria-labelledby="`class-${group.class.id}`"
          class="grid grid-cols-1 gap-2 @3xl:grid-cols-[11rem_minmax(0,1fr)]"
        >
          <!-- The class: its emblem, name and count, and what it does. -->
          <header class="surface flex flex-col gap-2 rounded-xl p-4">
            <span class="tm-emblem grid size-11 place-items-center rounded-xl text-primary">
              <UIcon :name="group.class.icon" class="size-6" />
            </span>
            <h2 :id="`class-${group.class.id}`" class="text-lg font-semibold leading-tight text-highlighted">{{ t(`class.${group.class.id}.name`) }}</h2>
            <span class="text-xs tabular-nums text-dimmed">{{ count(group.total) }}</span>
            <p class="text-xs leading-relaxed text-muted">{{ t(`class.${group.class.id}.desc`) }}</p>
            <p v-if="group.class.id === 'marksman'" class="flex items-start gap-1.5 text-[11px] leading-relaxed text-dimmed">
              <UIcon name="i-lucide-info" class="mt-0.5 size-3.5 shrink-0" />{{ t('classes.community') }}
            </p>
          </header>

          <!-- Its subclasses, side by side. -->
          <div class="surface grid content-start gap-x-6 gap-y-5 rounded-xl p-4" :class="columns(group.class.subclasses.length)">
            <div v-for="sub in group.subclasses" :key="sub.subclass" class="min-w-0">
              <div v-if="group.class.subclasses.length > 1" class="mb-2.5">
                <h3 class="flex items-center gap-2 text-sm font-semibold text-highlighted">
                  {{ t(`sub.${sub.subclass}.name`) }}
                  <span class="text-[11px] font-normal tabular-nums text-dimmed">{{ sub.champions.length }}</span>
                </h3>
                <p class="mt-0.5 text-xs leading-snug text-muted">{{ t(`sub.${sub.subclass}.desc`) }}</p>
              </div>
              <ul class="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-1">
                <li v-for="id in sub.champions" :key="id">
                  <ClassesChampionTile :champion-id="id" :title="alsoTitle(id, sub.subclass)" />
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section v-if="showUnclassified" aria-labelledby="class-unclassified" class="surface rounded-xl p-4">
          <h2 id="class-unclassified" class="flex items-baseline gap-2.5 text-base font-semibold text-highlighted">
            {{ t('classes.unclassified') }}
            <span class="text-xs font-normal text-dimmed">{{ count(tree.unclassified.length) }}</span>
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
