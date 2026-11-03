<script setup lang="ts">
import type { CompositionLane } from '#shared/types/composition'
import type { ChampionStaticListItem } from '#shared/types/static-data'
import { formatPercentage } from '#shared/utils/ddragon'
import type { ChampionPosition } from '#common/utils/positions'
import { winRateTone } from '#common/utils/rate-tone'

const { t } = useT()

/**
 * Between the two teams, as the desktop app's champion select draws it
 * (`DraftLaneDuel`): the role, the player's champion against the role
 * opponent, and how that lane goes — over the same games the build below is
 * computed from (#1117), so it never describes another sample.
 *
 * The role strip sits on top: it gates every fetch on the page, and the lane it
 * names is the one the duel is about. The two portraits are the matchup's
 * primary controls, the same slots as the two ringed cards on the board.
 */
const props = defineProps<{
  position: ChampionPosition | null
  champion: ChampionStaticListItem | null
  opponent: ChampionStaticListItem | null
  /** The lane read over the recommendation's sample; null until it resolves. */
  lane: CompositionLane | null
  loading: boolean
}>()

defineEmits<{
  'update:position': [value: ChampionPosition | null]
  'pick-champion': []
  'pick-opponent': []
}>()

// The jungle has no lane (#939): the same figures are read as a matchup tempo.
const laneNoun = computed<'lane' | 'matchup'>(() => (props.position === 'JUNGLE' ? 'matchup' : 'lane'))

/** The figures are read once all three picks are in; before that the duel says what is missing. */
const missing = computed(() => {
  if (!props.position) return t('builder.duel.pickRole')
  if (!props.champion) return t('builder.duel.pickChampion')
  if (!props.opponent) return t('builder.duel.pickOpponent')
  return null
})
</script>

<template>
  <div class="flex flex-col items-center gap-4 text-center">
    <RolePicker
      :position="position"
      hide-all
      @update:position="$emit('update:position', $event)"
    />

    <div class="flex items-center gap-3">
      <button
        type="button"
        class="flex size-16 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-elevated ring-2 ring-primary outline-none transition-all duration-200 hover:scale-105 hover:brightness-110 active:scale-95 focus-visible:ring-offset-2 focus-visible:ring-offset-default"
        :aria-label="champion ? t('builder.duel.yourChampion', { name: champion.name }) : t('builder.draft.chooseYours')"
        :title="champion?.name"
        @click="$emit('pick-champion')"
      >
        <SkeletonImage
          v-if="champion"
          :src="champion.iconUrl"
          alt=""
          class="size-full"
        />
        <span
          v-else
          class="text-2xl font-semibold text-dimmed"
        >?</span>
      </button>
      <span class="stat-label">{{ t('builder.duel.vs') }}</span>
      <button
        type="button"
        class="flex size-16 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-elevated ring-2 outline-none transition-all duration-200 hover:scale-105 hover:brightness-110 hover:ring-primary active:scale-95 focus-visible:ring-primary"
        :class="opponent ? 'ring-primary/35' : 'ring-accented'"
        :aria-label="opponent ? t('builder.duel.roleOpponent', { name: opponent.name }) : t('builder.draft.chooseOpponent')"
        :title="opponent?.name"
        @click="$emit('pick-opponent')"
      >
        <SkeletonImage
          v-if="opponent"
          :src="opponent.iconUrl"
          alt=""
          class="size-full"
        />
        <span
          v-else
          class="text-2xl font-semibold text-dimmed"
        >?</span>
      </button>
    </div>

    <div class="flex min-h-24 flex-col items-center gap-1.5">
      <p
        v-if="missing"
        class="text-sm text-muted"
      >
        {{ missing }}
      </p>
      <template v-else-if="loading">
        <USkeleton class="h-7 w-16" />
        <USkeleton class="h-2.5 w-20" />
      </template>
      <template v-else-if="lane?.winRate != null">
        <span
          class="text-3xl font-semibold leading-none tabular-nums"
          :class="winRateTone(lane.winRate)"
        >{{ formatPercentage(lane.winRate, 0) }}</span>
        <span class="stat-label">{{ laneNoun === 'matchup' ? t('builder.duel.ahead') : t('builder.duel.laneWinRate') }}</span>
        <BuilderMatchupLaneGaps
          :lane="lane"
          :lane-noun="laneNoun"
        />
      </template>
      <template v-else>
        <span class="text-3xl font-semibold leading-none text-dimmed">—</span>
        <span class="stat-label">{{ laneNoun === 'matchup' ? t('builder.duel.ahead') : t('builder.duel.laneWinRate') }}</span>
        <span class="text-xs text-muted">{{ t('builder.duel.undecided') }}</span>
      </template>
    </div>
  </div>
</template>
