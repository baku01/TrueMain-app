<script setup lang="ts">
import type { EnemyReading } from '~/composables/useJevEnemies'
import type { EnemyCounter } from '~/utils/draft-counters'
import { formatCount } from '#shared/utils/counts'
import { formatPercentage, getPositionIconUrl } from '#shared/utils/ddragon'
import { positionLabel } from '#common/utils/positions'

/**
 * The suggestions' side lists, as Blitz keeps them beside its suggestion
 * grid: folding groups of compact rows — who beats our lane opponent, the
 * lane's tier list, and, once Jev has read them, the enemies' kits. A row's
 * click opens that champion's build; its control hovers (or bans) it in the
 * client. Each group scrolls on its own rather than stretch the screen.
 */
const props = defineProps<{
  position: string
  opponentId: number | null
  /** Who beats our lane opponent on our lane, best first. */
  opponentCounters: EnemyCounter[]
  /** The enemies as Jev read them; null until Jev is asked. */
  jevReadings: EnemyReading[] | null
  /** Which groups this column shows. */
  groups: ('counters' | 'tiers' | 'jev')[]
}>()
const emit = defineEmits<{ preview: [championId: number] }>()
const { t } = useT()
const { nameOf } = useChampionStatics()
const { laneEntries } = useTierList()

const tierList = computed(() => laneEntries(props.position))

const FACTS = ['cc', 'heal', 'burst', 'autos', 'tank'] as const
const standout = (reading: EnemyReading) => FACTS.filter(fact => reading.read[fact] >= 0.34).sort((a, b) => reading.read[b] - reading.read[a])
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto">
    <!-- Who beats our lane opponent. -->
    <details v-if="groups.includes('counters') && opponentId !== null && opponentCounters.length" open class="rounded-lg bg-accented/20">
      <summary class="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm font-semibold text-data-good">
        <ChampionPortrait :champion-id="opponentId" size="sm" class="size-6! rounded-md!" />
        {{ t('draft.side.counters', { name: nameOf(opponentId) }) }}
        <span class="ml-auto text-xs font-normal text-dimmed">{{ opponentCounters.length }}</span>
      </summary>
      <ul class="flex flex-col px-1.5 pb-1.5">
        <li v-for="counter in opponentCounters" :key="counter.championId" class="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accented/40">
          <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left" @click="emit('preview', counter.championId)">
            <ChampionPortrait :champion-id="counter.championId" size="sm" class="size-8! rounded-md!" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-semibold text-highlighted">{{ nameOf(counter.championId) }}</span>
              <span class="text-[10px] text-dimmed">{{ t('draft.side.games', { games: formatCount(counter.games) }) }}</span>
            </span>
            <span class="w-11 text-right text-xs font-semibold tabular-nums text-data-good">{{ formatPercentage(counter.winRate) }}</span>
          </button>
          <DraftChampionAction :champion-id="counter.championId" compact class="opacity-0 transition-opacity group-hover:opacity-100" />
        </li>
      </ul>
    </details>

    <!-- The lane's tier list. -->
    <details v-if="groups.includes('tiers') && tierList.length" open class="rounded-lg bg-accented/20">
      <summary class="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm font-semibold text-highlighted">
        <img :src="getPositionIconUrl(position)" alt="" class="size-5">
        {{ t('draft.side.tierList', { lane: positionLabel(position, { short: true }) ?? '' }) }}
      </summary>
      <ul class="flex flex-col px-1.5 pb-1.5">
        <li v-for="entry in tierList" :key="entry.championId" class="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accented/40">
          <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left" @click="emit('preview', entry.championId)">
            <ChampionPortrait :champion-id="entry.championId" size="sm" class="size-8! rounded-md!" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-semibold text-highlighted">{{ nameOf(entry.championId) }}</span>
              <span class="flex items-center gap-1 text-[10px] text-dimmed"><TierBadge :caption="false" :size="14" :tier="entry.tier" />{{ formatPercentage(entry.pickRate) }}</span>
            </span>
            <span class="w-11 text-right text-xs font-semibold tabular-nums text-highlighted">{{ formatPercentage(entry.winRate) }}</span>
          </button>
          <DraftChampionAction :champion-id="entry.championId" compact class="opacity-0 transition-opacity group-hover:opacity-100" />
        </li>
      </ul>
    </details>

    <!-- The enemies as Jev read their kits. -->
    <details v-if="groups.includes('jev') && jevReadings?.length" open class="rounded-lg bg-accented/20">
      <summary class="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm font-semibold text-data-bad">
        <UIcon name="i-tabler-chess-knight" class="size-5 text-primary" />
        {{ t('draft.side.jevEnemies') }}
      </summary>
      <ul class="flex flex-col gap-0.5 px-2 pb-2">
        <li v-for="reading in jevReadings" :key="reading.id" class="flex items-center gap-2 py-0.5">
          <ChampionPortrait :champion-id="reading.id" size="sm" class="size-8! rounded-lg! ring-2" :class="reading.opponent ? 'ring-enemy/70' : 'ring-transparent'" />
          <span class="w-16 truncate text-xs font-semibold text-highlighted">{{ reading.name }}</span>
          <span class="flex min-w-0 flex-1 flex-wrap gap-1">
            <span v-for="fact in standout(reading)" :key="fact" class="rounded px-1 py-px text-[10px] font-semibold" :class="reading.read[fact] >= 0.67 ? 'bg-primary/15 text-primary' : 'bg-accented/60 text-default'" :title="t(`jev.fact.${fact}.hint`)">{{ t(`jev.fact.${fact}`) }}</span>
          </span>
        </li>
      </ul>
    </details>

    <p v-if="groups.includes('tiers') && !tierList.length" class="text-xs text-dimmed">{{ t('draft.sugg.tierListLoading') }}</p>
  </div>
</template>
