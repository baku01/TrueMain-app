<script setup lang="ts">
import type { ClassId, SubclassId } from '~/utils/champion-classes'
import { CLASSES, groupChampions, subclassesOf } from '~/utils/champion-classes'

/**
 * Champions by class and subclass (Riot's scheme: a Mage is a Burst Mage, a
 * Battle Mage or an Artillery Mage), each with a line on what it does in a
 * game. A tab narrows to one class; the search narrows by name. A click opens
 * the champion's page.
 */
const { t } = useT()
const { champions, nameOf, portraitOf } = useChampionStatics()

const query = ref('')
const selected = ref<ClassId | 'all'>('all')

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const words = computed(() => fold(query.value).split(/\s+/).filter(Boolean))

const ids = computed(() => [...champions.value.keys()].filter((id) => {
  const name = fold(nameOf(id))
  return words.value.every(word => name.includes(word))
}))

const tree = computed(() => groupChampions(ids.value, (a, b) => nameOf(a).localeCompare(nameOf(b))))
const visible = computed(() => tree.value.groups.filter(group => group.total > 0 && (selected.value === 'all' || group.class.id === selected.value)))
const showUnclassified = computed(() => selected.value === 'all' && tree.value.unclassified.length > 0)
const empty = computed(() => visible.value.length === 0 && !showUnclassified.value)

/** The tabs count the whole roster, not the search: a tab that vanished while typing would move under the cursor. */
const totals = computed(() => groupChampions([...champions.value.keys()], () => 0).groups)
const tabs = computed(() => [
  { value: 'all' as const, label: t('classes.all'), icon: 'i-ph-squares-four-light', count: champions.value.size },
  ...totals.value.map(group => ({ value: group.class.id, label: t(`class.${group.class.id}.name`), icon: group.class.icon, count: group.total })),
])

const count = (n: number) => t(n === 1 ? 'classes.champions.one' : 'classes.champions.other', { count: n })

/** Other subclasses of a champion, for its tooltip: a diver that is also a skirmisher says so. */
function alsoTitle(id: number, here: SubclassId) {
  const others = subclassesOf(id).filter(sub => sub !== here).map(sub => t(`sub.${sub}.name`))
  return others.length ? `${nameOf(id)} · ${t('classes.alsoIn', { subclasses: others.join(', ') })}` : nameOf(id)
}
</script>

<template>
  <SharedPage :eyebrow="t('classes.eyebrow')" :title="t('classes.page.title')">
    <div class="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader :eyebrow="t('classes.eyebrow')" :title="t('classes.page.title')" :description="t('classes.page.description')">
        <div class="flex flex-wrap items-center gap-3">
          <div class="inline-flex flex-wrap overflow-hidden rounded-lg border border-default" role="group" :aria-label="t('classes.page.title')">
            <button
              v-for="tab in tabs"
              :key="tab.value"
              type="button"
              class="flex items-center gap-1.5 border-r border-default px-3 py-1.5 text-sm transition-colors last:border-r-0 hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
              :class="selected === tab.value ? 'bg-elevated text-highlighted' : 'text-muted'"
              :aria-pressed="selected === tab.value"
              @click="selected = tab.value"
            >
              <UIcon :name="tab.icon" class="size-4" :class="selected === tab.value ? 'text-primary' : ''" />
              {{ tab.label }}
              <span class="text-[11px] text-dimmed">{{ tab.count }}</span>
            </button>
          </div>
          <UInput v-model="query" icon="i-lucide-search" :placeholder="t('classes.search')" class="ml-auto w-64" :aria-label="t('classes.search')" />
        </div>
      </PageHeader>

      <section v-for="group in visible" :key="group.class.id" class="space-y-6">
        <header class="flex items-start gap-4 border-b border-default pb-5">
          <span class="grid size-11 shrink-0 place-items-center rounded-xl border border-default bg-elevated text-primary">
            <UIcon :name="group.class.icon" class="size-6" />
          </span>
          <div class="min-w-0">
            <h2 class="flex items-baseline gap-2.5 text-xl font-semibold tracking-tight text-highlighted">
              {{ t(`class.${group.class.id}.name`) }}
              <span class="text-sm font-normal text-dimmed">{{ count(group.total) }}</span>
            </h2>
            <p class="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-muted">{{ t(`class.${group.class.id}.desc`) }}</p>
            <p v-if="group.class.id === 'marksman'" class="mt-2 flex max-w-2xl items-start gap-1.5 text-xs leading-relaxed text-dimmed">
              <UIcon name="i-lucide-info" class="mt-0.5 size-3.5 shrink-0" />{{ t('classes.community') }}
            </p>
          </div>
        </header>

        <div class="divide-y divide-default/70">
        <div
          v-for="sub in group.subclasses.filter(entry => entry.champions.length > 0)"
          :key="sub.subclass"
          class="grid gap-x-10 gap-y-3 py-5 first:pt-0 last:pb-0"
          :class="group.class.subclasses.length > 1 ? 'md:grid-cols-[15rem_minmax(0,1fr)]' : ''"
        >
          <div v-if="group.class.subclasses.length > 1" class="md:pt-1">
            <h3 class="flex items-center gap-2 text-sm font-semibold text-highlighted before:h-4 before:w-0.5 before:rounded-full before:bg-primary/70">
              {{ t(`sub.${sub.subclass}.name`) }}
              <span class="rounded-full bg-accented px-1.5 text-[11px] font-normal text-muted">{{ sub.champions.length }}</span>
            </h3>
            <p class="mt-1.5 text-[13px] leading-relaxed text-muted">{{ t(`sub.${sub.subclass}.desc`) }}</p>
          </div>
          <ul class="flex flex-wrap content-start gap-3">
            <li v-for="id in sub.champions" :key="id">
              <NuxtLink
                :to="`/champions/${id}`"
                :title="alsoTitle(id, sub.subclass)"
                class="group flex w-[4.5rem] flex-col items-center gap-1.5 rounded-lg p-1 transition hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
              >
                <img
                  v-if="portraitOf(id)"
                  :src="portraitOf(id)!"
                  alt=""
                  width="56"
                  height="56"
                  loading="lazy"
                  class="img-skeleton size-14 rounded-lg ring-1 ring-default transition group-hover:ring-primary"
                >
                <span v-else class="img-skeleton size-14 rounded-lg" />
                <span class="w-full truncate text-center text-[11px] leading-tight text-default">{{ nameOf(id) }}</span>
              </NuxtLink>
            </li>
          </ul>
        </div>
        </div>
      </section>

      <section v-if="showUnclassified" class="space-y-3">
        <header class="flex items-center gap-3 border-b border-default pb-2">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-highlighted">{{ t('classes.unclassified') }}</h2>
          <span class="rounded-full bg-accented px-2 text-[11px] text-muted">{{ tree.unclassified.length }}</span>
        </header>
        <p class="text-xs text-muted">{{ t('classes.unclassified.hint') }}</p>
        <ul class="flex flex-wrap gap-3">
          <li v-for="id in tree.unclassified" :key="id">
            <NuxtLink :to="`/champions/${id}`" class="flex w-[4.5rem] flex-col items-center gap-1.5 rounded-lg p-1 transition hover:bg-elevated">
              <img v-if="portraitOf(id)" :src="portraitOf(id)!" alt="" width="56" height="56" loading="lazy" class="img-skeleton size-14 rounded-lg ring-1 ring-default">
              <span class="w-full truncate text-center text-[11px] leading-tight text-default">{{ nameOf(id) }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <p v-if="empty" class="py-10 text-center text-sm text-muted">{{ t('classes.noMatch', { query }) }}</p>
    </div>
  </SharedPage>
</template>
