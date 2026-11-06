<script setup lang="ts">
import type { ApexCutoff } from '#shared/types/apex-cutoffs'
import type { RankedQueue } from '~/types/record'
import type { RankedQueueType } from '~/utils/league-history'
import type { LpMove } from '~/utils/lp-history'
import type { LeagueHistory } from '~/utils/sources/rank-history'
import { toProfileRanked } from '~/utils/match-summary'
import { dailyStandings } from '~/utils/lp-history'
import { sinceDays } from '~/utils/league-history'

/**
 * The profile's ranked card (`ProfileRankedCard`) on the queue picked in its
 * corner, Solo/Duo or Flex: that queue's rank and its LP curve over the last
 * ninety days, from whichever source carries it (`useLeagueHistory`), named
 * under the curve. Solo/Duo adds the Flex standing and the latest games' LP,
 * which only it measures; "View full history" opens the LP history tab.
 */
const props = defineProps<{
  solo: RankedQueue | null
  flex: RankedQueue | null
  history: LeagueHistory | null
  loading: boolean
  cutoffs: readonly ApexCutoff[]
  moves: readonly LpMove[]
}>()
const queue = defineModel<RankedQueueType>('queue', { required: true })
const emit = defineEmits<{ full: [] }>()
const { t } = useT()

const isSolo = computed(() => queue.value === 'RANKED_SOLO_5x5')
const ranked = computed(() => toProfileRanked(isSolo.value ? props.solo : props.flex))
const curve = computed(() => dailyStandings(sinceDays(props.history?.entries ?? [], 90)))
const queues = computed(() => [
  { value: 'RANKED_SOLO_5x5' as const, label: t('dash.ranked.solo') },
  { value: 'RANKED_FLEX_SR' as const, label: t('dash.ranked.flex') },
])
</script>

<template>
  <ProfileRankedCard :ranked="ranked" :history="curve" :history-loading="loading" :cutoffs="isSolo ? cutoffs : []">
    <template #title>
      <div class="flex items-center gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t('dash.ranked.title') }}</h2>
        <AppSegmented v-model="queue" :items="queues" class="ml-auto" />
      </div>
    </template>
    <template #standing>
      <DashboardFlexStanding v-if="isSolo" :queue="flex" />
    </template>
    <template #moves>
      <DashboardLpMoves v-if="isSolo" :moves="moves" />
      <div v-if="history?.entries.length" class="flex items-center gap-2">
        <UButton
          :label="t('dash.lpHistory.viewFull')"
          trailing-icon="i-lucide-chevron-right"
          color="neutral"
          variant="link"
          size="xs"
          class="-ml-2 px-2"
          @click="emit('full')"
        />
        <DashboardSourceBadge :source="history.source" class="ml-auto" />
      </div>
    </template>
  </ProfileRankedCard>
</template>
