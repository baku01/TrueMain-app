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
  <div class="flex h-full min-h-0 flex-col gap-4 p-5">
    <div class="flex shrink-0 items-center gap-3">
      <UIcon name="i-ph-tree-structure-light" class="size-6 text-primary" />
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ t('classes.page.title') }}</h1>
    </div>

    <div class="surface grid min-h-0 flex-1 grid-cols-[15rem_minmax(0,1fr)] overflow-hidden rounded-xl">
      <aside class="flex min-h-0 flex-col border-r border-default bg-muted/50" :aria-label="t('classes.page.title')">
        <div class="p-2.5">
          <UInput v-model="query" icon="i-lucide-search" size="sm" :placeholder="t('classes.search')" class="w-full" :aria-label="t('classes.search')" />
        </div>
        <ul class="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          <li v-for="tab in tabs" :key="tab.value">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
              :class="selected === tab.value ? '!border-primary/50 bg-elevated' : ''"
              :aria-current="selected === tab.value"
              @click="selected = tab.value"
            >
              <UIcon :name="tab.icon" class="size-5 shrink-0" :class="selected === tab.value ? 'text-primary' : 'text-muted'" />
              <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ tab.label }}</span>
              <span class="rounded-full bg-accented px-1.5 text-[11px] text-muted">{{ tab.count }}</span>
            </button>
          </li>
        </ul>
      </aside>

      <div class="min-h-0 space-y-6 overflow-y-auto p-5">
        <section v-for="group in visible" :key="group.class.id" class="space-y-4">
          <header class="flex items-start gap-4 rounded-xl border border-default bg-gradient-to-br from-primary/10 via-elevated to-elevated p-4">
            <span class="grid size-12 shrink-0 place-items-center rounded-xl border border-default bg-muted text-primary">
              <UIcon :name="group.class.icon" class="size-6" />
            </span>
            <div class="min-w-0">
              <h2 class="flex items-baseline gap-2 text-lg font-semibold tracking-tight text-highlighted">
                {{ t(`class.${group.class.id}.name`) }}
                <span class="text-xs font-normal text-muted">{{ count(group.total) }}</span>
              </h2>
              <p class="mt-1 max-w-3xl text-sm text-muted">{{ t(`class.${group.class.id}.desc`) }}</p>
            </div>
          </header>

          <div v-for="sub in group.subclasses.filter(entry => entry.champions.length > 0)" :key="sub.subclass" class="rounded-xl border border-default bg-default/40 p-4">
            <div class="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h3 class="text-sm font-semibold text-highlighted">{{ t(`sub.${sub.subclass}.name`) }}</h3>
              <span class="rounded-full bg-accented px-1.5 text-[11px] text-muted">{{ sub.champions.length }}</span>
              <p v-if="group.class.subclasses.length > 1" class="basis-full text-xs text-muted">{{ t(`sub.${sub.subclass}.desc`) }}</p>
            </div>
            <ul class="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-2">
              <li v-for="id in sub.champions" :key="id">
                <NuxtLink
                  :to="`/champions/${id}`"
                  :title="alsoTitle(id, sub.subclass)"
                  class="group flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <img
                    v-if="portraitOf(id)"
                    :src="portraitOf(id)!"
                    alt=""
                    width="56"
                    height="56"
                    loading="lazy"
                    class="img-skeleton size-14 rounded-xl ring-1 ring-default transition group-hover:ring-primary"
                  >
                  <span v-else class="img-skeleton size-14 rounded-xl" />
                  <span class="w-full truncate text-center text-[11px] leading-tight text-default">{{ nameOf(id) }}</span>
                </NuxtLink>
              </li>
            </ul>
          </div>
        </section>

        <section v-if="showUnclassified" class="rounded-xl border border-default bg-default/40 p-4">
          <div class="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h3 class="text-sm font-semibold text-highlighted">{{ t('classes.unclassified') }}</h3>
            <span class="rounded-full bg-accented px-1.5 text-[11px] text-muted">{{ tree.unclassified.length }}</span>
            <p class="basis-full text-xs text-muted">{{ t('classes.unclassified.hint') }}</p>
          </div>
          <ul class="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-2">
            <li v-for="id in tree.unclassified" :key="id">
              <NuxtLink :to="`/champions/${id}`" class="flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition hover:bg-elevated">
                <img v-if="portraitOf(id)" :src="portraitOf(id)!" alt="" width="56" height="56" loading="lazy" class="img-skeleton size-14 rounded-xl ring-1 ring-default">
                <span class="w-full truncate text-center text-[11px] leading-tight text-default">{{ nameOf(id) }}</span>
              </NuxtLink>
            </li>
          </ul>
        </section>

        <p v-if="empty" class="py-10 text-center text-sm text-muted">{{ t('classes.noMatch', { query }) }}</p>
      </div>
    </div>
  </div>
</template>
