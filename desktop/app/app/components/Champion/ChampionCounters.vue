<script setup lang="ts">
import ChampionCounterTable from '~/components/Champion/ChampionCounterTable.vue'
import type { CounterRead } from '~/utils/sources/counters'
import { readCounters } from '~/utils/sources/counters'
import { counterTables } from '~/utils/counters'

/**
 * The champion's counters on its lane, as Blitz lays them out: who it is
 * strong against and who it is weak against, side by side, ranked by the
 * matchup's score (`utils/counters.ts`); "laning only" ranks by the lane
 * instead, where the source measures it. The badge names the source the
 * numbers came from — the picked one, or the one standing in for it
 * (`readCounters`).
 */
const props = defineProps<{ championId: number, position: string }>()
const { t } = useT()
const { nameOf } = useChampionStatics()

const read = ref<CounterRead | null>(null)
const failed = ref(false)
const laning = ref(false)

watch(() => `${props.championId}:${props.position}`, async (key) => {
  read.value = null
  failed.value = false
  try {
    const answer = await readCounters(props.championId, props.position)
    if (key === `${props.championId}:${props.position}`) read.value = answer
  }
  catch {
    failed.value = true
  }
}, { immediate: true })

const hasLane = computed(() => read.value?.rows.some(row => row.laneScore !== null) ?? false)
watch(hasLane, has => (laning.value = laning.value && has))
const tables = computed(() => counterTables(read.value?.rows ?? [], laning.value))
const name = computed(() => nameOf(props.championId))
</script>

<template>
  <div class="flex min-h-0 flex-col gap-3 overflow-y-auto">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p class="min-w-0 flex-1 text-xs leading-snug text-muted">{{ t('counters.description', { champion: name }) }}</p>
      <USwitch v-if="hasLane" v-model="laning" :label="t('counters.laning')" size="sm" :ui="{ label: 'stat-label' }" />
      <span v-if="read?.patch" class="text-xs tabular-nums text-dimmed">{{ t('counters.patch', { patch: read.patch }) }}</span>
      <StatsSourceBadge v-if="read" :source="read.source" />
    </div>

    <div v-if="failed" class="surface rounded-2xl p-6 text-center text-sm text-muted">{{ t('counters.failed') }}</div>
    <div v-else-if="!read" class="grid gap-3 lg:grid-cols-2">
      <USkeleton v-for="table in 2" :key="table" class="h-96 rounded-2xl" />
    </div>
    <div v-else class="grid items-start gap-3 lg:grid-cols-2">
      <ChampionCounterTable :title="t('counters.strong', { champion: name })" :rows="tables.strong" :laning="laning" :position="position" />
      <ChampionCounterTable :title="t('counters.weak', { champion: name })" :rows="tables.weak" :laning="laning" :position="position" weak />
    </div>
  </div>
</template>
