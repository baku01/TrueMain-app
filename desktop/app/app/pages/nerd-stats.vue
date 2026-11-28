<script setup lang="ts">
import type { NerdQueueFilter } from '~/utils/nerd-stats/features'
import { analyse, MIN_GAMES } from '~/utils/nerd-stats/analysis'
import { filterRows, gameRows } from '~/utils/nerd-stats/features'
import { HISTORY_DEEP_CEILING } from '~/composables/usePlayerRecord'

/**
 * Stats for nerds: every figure the app holds about the player's own games,
 * read against winning — for a player, not a statistician. Every block says
 * its takeaway first, in a sentence written from the real figures, with how
 * far it can be trusted in a word (strong, moderate, weak, uncertain) instead
 * of a p-value; the figures behind it — d, r, q, the odds ratios, the AUC —
 * are a "show the maths" away, each symbol explained in a line, and the
 * methods tab writes every formula out. Inside: the headline record, what
 * weighs most on winning (a fitted formula, in the game's own units, and a
 * calculator), what comes with the wins, the win rate by game length, hour,
 * weekday, sitting, champion, lane, rune and item, the streaks, how the
 * metrics move together, and every game in a sortable table.
 *
 * The games are the client's (`usePlayerRecord`) and, past the twenty or so
 * it keeps, the player's games on Blitz and those this machine saved before
 * (`useDeepHistory`), up to `HISTORY_DEEP_CEILING` — recomputing as each
 * step lands. Summoner's Rift is the default sample —
 * ARAM's and Arena's numbers mean other things — and every figure says how
 * many games it rests on.
 */
const { t } = useT()
const { state } = useLcuState()
const route = useRoute()
const router = useRouter()
const own = usePlayerRecord()
// The history read back to its end while the page is open: the client's pages, then Blitz, with what this machine saved.
const deep = useDeepHistory()
const { items } = useStaticData()

onMounted(() => own.refresh())
watch(() => state.value.riotId, () => own.refresh())

const filter = ref<NerdQueueFilter>('rift')
const filters = computed(() => (['rift', 'ranked', 'solo', 'flex', 'normal', 'aram', 'all'] as const).map(value => ({ value, label: t(`nerd.queue.${value}`) })))

const allRows = computed(() => gameRows(deep.games.value, own.rankHistory.value))
const rows = computed(() => filterRows(allRows.value, filter.value))
const report = computed(() => (rows.value.length >= MIN_GAMES ? analyse(rows.value, id => items.value[id]?.totalGold) : null))

type Tab = 'overview' | 'picks' | 'time' | 'metrics' | 'games' | 'methods'
const TABS: { value: Tab, icon: string }[] = [
  { value: 'overview', icon: 'i-tabler-bulb' },
  { value: 'picks', icon: 'i-tabler-swords' },
  { value: 'time', icon: 'i-tabler-clock-hour-4' },
  { value: 'metrics', icon: 'i-tabler-chart-dots-3' },
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

      <div v-else-if="own.status.value === 'pending' && !deep.games.value.length" class="space-y-4" aria-busy="true">
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
          :total="deep.games.value.length"
          :ceiling="HISTORY_DEEP_CEILING"
          :reading="deep.reading.value"
          :paused="deep.paused.value"
          :sources="deep.sources.value"
          :phase="deep.phase.value"
          :queued="deep.queued.value"
          :blitz-missing="deep.blitzMissing.value"
          @toggle-reading="deep.toggle()"
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
              <NerdCoach :report="report" />
              <NerdDrivers :metrics="report.metrics" :games="report.overview.games" :rate="report.overview.rate" />
            </div>
            <div v-else-if="tab === 'picks'" key="picks">
              <NerdGroups :report="report" />
            </div>
            <div v-else-if="tab === 'time'" key="time" class="space-y-5">
              <NerdDuration :duration="report.duration" :overview="report.overview" :rows="rows" />
              <NerdClock :hours="report.hours" :weekdays="report.weekdays" :rate="report.overview.rate" :sessions="report.sequence.sessions" />
              <NerdStreaks :sequence="report.sequence" :rate="report.overview.rate" />
            </div>
            <div v-else-if="tab === 'metrics'" key="metrics" class="space-y-5">
              <NerdFormula :model="report.model" :games="report.overview.games" :minutes="report.overview.duration" :metrics="report.metrics" />
              <NerdDistributions :metrics="report.metrics" :rate="report.overview.rate" />
              <NerdHeatmap :matrix="report.correlation" :games="report.overview.games" />
            </div>
            <div v-else-if="tab === 'games'" key="games">
              <NerdGames :rows="rows" :source-of="deep.sourceOf" />
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
/* A reference line on the page's charts — the player's own average — dashed, beside the solid coin flip. */
.nerd-dash {
  display: block;
  height: 0;
  border-top: 1.5px dashed var(--ui-text-muted);
}

.nerd-dash-v {
  display: block;
  width: 0;
  border-left: 1.5px dashed var(--ui-text-muted);
}

/*
 * The page's two outcome colours and its diverging midpoint. A win is the
 * app's accent, a loss red, as the pro games' rows have them (`pro-win`,
 * `pro-loss`) — one step deeper than the text tones, so the pair passes the
 * colour-vision and contrast checks on both themes' panes. The midpoint is a
 * grey with no hue of its own, so "at par" reads as neither side.
 */
.nerd {
  --nerd-win: var(--color-data-good, var(--color-rosegold-500));
  --nerd-loss: var(--ui-error, #ef4444);
  --nerd-mid: var(--ui-bg-accented, #2c3038);
}

:root:not(.dark) .nerd {
  --nerd-win: var(--color-data-good, var(--color-rosegold-600));
  --nerd-loss: var(--ui-error, #e03131);
  --nerd-mid: var(--ui-bg-accented, #e4e6ea);
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
