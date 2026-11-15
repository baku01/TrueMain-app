<script setup lang="ts">
import type { NerdQueueFilter } from '~/utils/nerd-stats/features'
import { analyse, MIN_GAMES } from '~/utils/nerd-stats/analysis'
import { filterRows, gameRows } from '~/utils/nerd-stats/features'
import { HISTORY_DEEP_CEILING } from '~/composables/usePlayerRecord'

/**
 * Stats for nerds: every figure the app holds about the player's own games,
 * read against winning. The headline record with its interval, a fitted
 * formula of victory and how well it predicts games it never saw, which
 * metrics come with winning and by how much, the win rate by game length,
 * hour, weekday, sitting, champion, lane, rune and item, the streaks, how the
 * metrics move together, and every game in a sortable table — each method
 * named and explained in a tab of its own.
 *
 * The games are the client's (`usePlayerRecord`): the page reads the history
 * back page by page as far as the client keeps it (`HISTORY_DEEP_CEILING`),
 * recomputing as each page lands. Summoner's Rift is the default sample —
 * ARAM's and Arena's numbers mean other things — and every figure says how
 * many games it rests on.
 */
const { t } = useT()
const { state } = useLcuState()
const route = useRoute()
const router = useRouter()
const own = usePlayerRecord()
const { items } = useStaticData()

onMounted(() => own.refresh())
watch(() => state.value.riotId, () => own.refresh())

// The history read back to its end, a page at a time, while the page is open.
const paused = ref(false)
watch([() => own.status.value, () => own.games.value.length, () => own.loadingOlder.value, paused], () => {
  if (own.status.value === 'ready' && !own.loadingOlder.value && !paused.value && own.canReadOlder(HISTORY_DEEP_CEILING))
    void own.loadOlder(HISTORY_DEEP_CEILING)
}, { immediate: true })
const reading = computed(() => own.loadingOlder.value || (!paused.value && own.status.value === 'ready' && own.canReadOlder(HISTORY_DEEP_CEILING)))

const filter = ref<NerdQueueFilter>('rift')
const filters = computed(() => (['rift', 'ranked', 'solo', 'flex', 'normal', 'aram', 'all'] as const).map(value => ({ value, label: t(`nerd.queue.${value}`) })))

const allRows = computed(() => gameRows(own.games.value, own.rankHistory.value))
const rows = computed(() => filterRows(allRows.value, filter.value))
const report = computed(() => (rows.value.length >= MIN_GAMES ? analyse(rows.value, id => items.value[id]?.totalGold) : null))

type Tab = 'overview' | 'metrics' | 'time' | 'picks' | 'games' | 'methods'
const TABS: { value: Tab, icon: string }[] = [
  { value: 'overview', icon: 'i-tabler-math-function' },
  { value: 'metrics', icon: 'i-tabler-chart-dots-3' },
  { value: 'time', icon: 'i-tabler-clock-hour-4' },
  { value: 'picks', icon: 'i-tabler-swords' },
  { value: 'games', icon: 'i-tabler-table' },
  { value: 'methods', icon: 'i-tabler-book-2' },
]
const tab = computed<Tab>({
  get: () => TABS.find(entry => entry.value === route.query.tab)?.value ?? 'overview',
  set: value => void router.replace({ query: { ...route.query, tab: value === 'overview' ? undefined : value } }),
})
</script>

<template>
  <SharedPage :eyebrow="t('nav.nerdStats')" :title="t('nerd.title')">
    <div class="nerd mx-auto max-w-[1600px] space-y-5 p-4 md:p-6">
      <PageHeader :title="t('nerd.title')" :description="t('nerd.description')">
        <template #actions>
          <AppSegmented v-model="filter" :items="filters" />
        </template>
      </PageHeader>

      <EmptyState
        v-if="!state.connected || !state.riotId"
        icon="i-tabler-math-function"
        :title="t('nerd.empty.noClient')"
        :description="t('nerd.empty.noClientHint')"
        class="py-20"
      />

      <div v-else-if="own.status.value === 'pending' && !own.games.value.length" class="space-y-4" aria-busy="true">
        <USkeleton class="h-56 w-full rounded-lg" />
        <div class="grid grid-cols-3 gap-4">
          <USkeleton v-for="index in 3" :key="index" class="h-64 rounded-lg" />
        </div>
      </div>

      <EmptyState
        v-else-if="own.status.value === 'error'"
        icon="i-lucide-cloud-off"
        :title="t('nerd.empty.error')"
        class="py-20"
      >
        <UButton :label="t('nerd.empty.retry')" color="neutral" variant="outline" @click="own.refresh(true)" />
      </EmptyState>

      <template v-else>
        <NerdHero
          :report="report"
          :rows="rows"
          :total="own.games.value.length"
          :ceiling="HISTORY_DEEP_CEILING"
          :reading="reading"
          :paused="paused"
          @toggle-reading="paused = !paused"
        />

        <EmptyState
          v-if="!report"
          icon="i-tabler-chart-dots-3"
          :title="t('nerd.empty.few', { count: rows.length, min: MIN_GAMES })"
          :description="t('nerd.empty.fewHint')"
          class="py-14"
        />

        <template v-else>
          <nav class="flex flex-wrap gap-x-6 border-b border-default" :aria-label="t('nerd.tabs')">
            <button
              v-for="entry in TABS"
              :key="entry.value"
              type="button"
              class="tm-tab flex shrink-0 items-center gap-1.5"
              :data-active="tab === entry.value || undefined"
              :aria-pressed="tab === entry.value"
              @click="tab = entry.value"
            >
              <UIcon :name="entry.icon" class="size-4" :class="tab === entry.value ? 'text-primary' : ''" />
              {{ t(`nerd.tab.${entry.value}`) }}
            </button>
          </nav>

          <Transition mode="out-in" enter-active-class="nerd-tab-enter" leave-active-class="nerd-tab-leave">
            <div v-if="tab === 'overview'" key="overview" class="space-y-5">
              <NerdFormula :model="report.model" :games="report.overview.games" />
              <NerdDrivers :metrics="report.metrics" :games="report.overview.games" />
            </div>
            <div v-else-if="tab === 'metrics'" key="metrics" class="space-y-5">
              <NerdDistributions :metrics="report.metrics" />
              <NerdHeatmap :matrix="report.correlation" :games="report.overview.games" />
            </div>
            <div v-else-if="tab === 'time'" key="time" class="space-y-5">
              <NerdDuration :duration="report.duration" :overview="report.overview" :rows="rows" />
              <NerdClock :hours="report.hours" :weekdays="report.weekdays" :rate="report.overview.rate" :sessions="report.sequence.sessions" />
              <NerdStreaks :sequence="report.sequence" :rate="report.overview.rate" />
            </div>
            <div v-else-if="tab === 'picks'" key="picks">
              <NerdGroups :report="report" />
            </div>
            <div v-else-if="tab === 'games'" key="games">
              <NerdGames :rows="rows" />
            </div>
            <div v-else key="methods">
              <NerdMethods :report="report" />
            </div>
          </Transition>
        </template>
      </template>
    </div>
  </SharedPage>
</template>

<style>
/*
 * The page's two outcome colours and its diverging midpoint. A win is the
 * app's accent, a loss red, as the pro games' rows have them (`pro-win`,
 * `pro-loss`) — one step deeper than the text tones, so the pair passes the
 * colour-vision and contrast checks on both themes' panes. The midpoint is a
 * grey with no hue of its own, so "at par" reads as neither side.
 */
.nerd {
  --nerd-win: var(--color-rosegold-500);
  --nerd-loss: #ef4444;
  --nerd-mid: #2c3038;
}

:root:not(.dark) .nerd {
  --nerd-win: var(--color-rosegold-600);
  --nerd-loss: #e03131;
  --nerd-mid: #e4e6ea;
}

.nerd-tab-enter {
  animation: tm-rise 300ms var(--tm-ease) backwards;
}

.nerd-tab-leave {
  transition: opacity 90ms ease-in;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .nerd-tab-enter {
    animation: none;
  }
}
</style>
