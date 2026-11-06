<script setup lang="ts">
import type { ChampionStaticListItem } from '#shared/types/static-data'
import type { PoolRole } from '~/utils/champion-pool'
import { formatPercentage, getPositionIconUrl } from '#shared/utils/ddragon'
import { formatKdaRatio, kdaRatio } from '#shared/utils/kda'
import { formatSigned } from '#shared/utils/deltas'
import { positionLabel } from '#common/utils/positions'
import { winRateTone } from '#common/utils/rate-tone'

/**
 * One lane of the season champion pool, Blitz's role card: the lane's games,
 * record and LP in its head, then its champions, most played first — each
 * one's win rate, record, KDA and, where measured, LP. The first few show; the
 * rest open on demand. A champion opens its builds on this lane.
 */
const props = defineProps<{
  line: PoolRole
  champions: ReadonlyMap<number, ChampionStaticListItem>
  /** Whether the pool measured any LP: without, the column says nothing and is left out. */
  withLp: boolean
  /** What the lane-less card is called: a mode without lanes on Blitz, every lane at once on op.gg. */
  blankLabel: string
}>()
const { t } = useT()
const SHOWN = 6

const open = ref(false)
const shown = computed(() => (open.value ? props.line.champions : props.line.champions.slice(0, SHOWN)))
const label = computed(() => positionLabel(props.line.role) ?? props.blankLabel)
const gamesLabel = (count: number) => t(count === 1 ? 'dash.games.one' : 'dash.games.other', { count })
const rate = (wins: number, games: number) => (games ? wins / games : 0)
const lpTone = (lp: number) => (lp >= 0 ? 'text-data-good' : 'text-data-bad')
const linkOf = (championId: number) => ({ path: `/champions/${championId}`, query: props.line.role ? { position: props.line.role } : {} })
</script>

<template>
  <section class="surface flex flex-col rounded-lg" data-testid="pool-role">
    <header class="flex items-center gap-3 border-b border-default px-4 py-3">
      <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-elevated ring-1 ring-default">
        <SkeletonImage v-if="line.role" :src="getPositionIconUrl(line.role)" :alt="label" class="size-5" transparent />
        <UIcon v-else name="i-lucide-layers" class="size-5 text-muted" />
      </span>
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-sm font-semibold text-highlighted">{{ label }}</h3>
        <p class="text-xs tabular-nums text-muted">
          {{ gamesLabel(line.games) }} · {{ t('dash.record', { wins: line.wins, losses: line.games - line.wins }) }}
          · <span class="font-semibold" :class="winRateTone(rate(line.wins, line.games))">{{ formatPercentage(rate(line.wins, line.games), 0) }}</span>
        </p>
      </div>
      <span v-if="line.lp" class="shrink-0 text-base font-semibold tabular-nums" :class="lpTone(line.lp)">{{ t('dash.pool.lp', { lp: formatSigned(line.lp) }) }}</span>
    </header>

    <ol class="flex flex-col py-1">
      <li v-for="champion in shown" :key="champion.championId">
        <NuxtLink
          :to="linkOf(champion.championId)"
          class="surface-hover grid items-center gap-2 px-4 py-1.5 text-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          :class="withLp ? 'grid-cols-[minmax(0,1fr)_3rem_4.5rem_4.5rem_3.5rem]' : 'grid-cols-[minmax(0,1fr)_3rem_4.5rem_4.5rem]'"
        >
          <span class="flex min-w-0 items-center gap-2.5">
            <SkeletonImage :src="champions.get(champion.championId)?.iconUrl ?? null" :alt="champions.get(champion.championId)?.name ?? ''" class="size-8 shrink-0 rounded" />
            <span class="min-w-0">
              <span class="block truncate text-sm font-medium text-default">{{ champions.get(champion.championId)?.name ?? `#${champion.championId}` }}</span>
              <span class="block text-[11px] text-dimmed">{{ gamesLabel(champion.games) }}</span>
            </span>
          </span>
          <span class="text-right font-semibold" :class="winRateTone(rate(champion.wins, champion.games))">{{ formatPercentage(rate(champion.wins, champion.games), 0) }}</span>
          <span class="text-right text-muted">{{ t('dash.record', { wins: champion.wins, losses: champion.games - champion.wins }) }}</span>
          <span class="text-right text-default">{{ t('dash.pool.kda', { kda: formatKdaRatio(kdaRatio(champion)) }) }}</span>
          <span v-if="withLp" class="text-right font-semibold" :class="champion.lp ? lpTone(champion.lp) : 'text-dimmed'">{{ champion.lp ? formatSigned(champion.lp) : '–' }}</span>
        </NuxtLink>
      </li>
    </ol>

    <UButton
      v-if="line.champions.length > SHOWN"
      :label="open ? t('dash.list.less') : t('dash.list.more', { count: line.champions.length })"
      :trailing-icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
      color="neutral"
      variant="ghost"
      size="xs"
      class="mx-2 mb-2 justify-center"
      @click="open = !open"
    />
  </section>
</template>
