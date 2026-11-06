<script setup lang="ts">
import type { ChampionStaticListItem } from '#shared/types/static-data'
import type { DataSource } from '~/utils/data-source'
import type { PoolRole } from '~/utils/champion-pool'
import type { QueueFilter } from '~/utils/player-form'

/**
 * The profile's Champion pool tab, Blitz's: the player's season in the queue
 * picked, a card per lane (`DashboardPoolRole`), the lane most played first,
 * with the source the season was read from beside the title. The recent
 * games' champions and roles stay on the overview; this is the whole season.
 */
const props = defineProps<{
  pool: { source: DataSource, roles: PoolRole[] } | null
  loading: boolean
  champions: ChampionStaticListItem[]
  queues: { value: QueueFilter, label: string }[]
}>()
const queue = defineModel<QueueFilter>('queue', { required: true })
const { t } = useT()

const championsById = computed(() => new Map(props.champions.map(champion => [champion.championId, champion])))
const withLp = computed(() => props.pool?.roles.some(role => role.lp !== null) ?? false)
</script>

<template>
  <section class="flex flex-col gap-4" data-testid="champion-pool">
    <header class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h2 class="text-base font-semibold text-highlighted">{{ t('dash.pool.title') }}</h2>
          <DashboardSourceBadge v-if="pool && !loading" :source="pool.source" />
        </div>
        <p class="text-xs text-muted">{{ t('dash.pool.subtitle') }}</p>
      </div>
      <AppSegmented v-model="queue" :items="queues" class="ml-auto" />
    </header>

    <div v-if="loading" class="grid items-start gap-3 xl:grid-cols-2">
      <USkeleton v-for="index in 4" :key="index" class="h-72 rounded-lg" />
    </div>

    <template v-else-if="pool?.roles.length">
      <p v-if="pool.source === 'opgg'" class="text-xs text-dimmed">{{ t('dash.pool.lanes') }}</p>
      <div class="grid items-start gap-3 xl:grid-cols-2">
        <DashboardPoolRole v-for="line in pool.roles" :key="line.role" :line="line" :champions="championsById" :with-lp="withLp" :blank-label="pool.source === 'opgg' ? t('dash.pool.allLanes') : t('dash.pool.noLane')" />
      </div>
    </template>

    <EmptyState v-else icon="i-lucide-swords" :title="t('dash.pool.empty')" :description="t('dash.pool.emptyHint')" class="surface rounded-lg py-12" />
  </section>
</template>
