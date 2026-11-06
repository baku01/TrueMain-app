<script setup lang="ts">
import type { Teammate } from '~/utils/played-with'
import type { PlayedWith } from '~/utils/sources/played-with'
import { formatPercentage } from '#shared/utils/ddragon'
import { winRateTone } from '#common/utils/rate-tone'

/**
 * Blitz's "Recently played with", on the profile's column: the players met on
 * the player's own side at least twice in the games read, the most met first —
 * games together, record and win rate — each opening their own profile here.
 * Four show; the rest open on demand. Nothing renders without one.
 */
const props = defineProps<{
  playedWith: PlayedWith | null
  /** The profiled player's region: their teammates play on it too. */
  region: string | null
}>()
const { t } = useT()
const { profileIconOf } = useChampionStatics()
const SHOWN = 4

const open = ref(false)
const teammates = computed(() => props.playedWith?.teammates ?? [])
const shown = computed(() => (open.value ? teammates.value : teammates.value.slice(0, SHOWN)))
const riotId = (mate: Teammate) => `${mate.gameName}#${mate.tagLine}`
const linkOf = (mate: Teammate) => ({ path: '/', query: { riotId: riotId(mate), ...(props.region ? { region: props.region } : {}) } })
const gamesLabel = (count: number) => t(count === 1 ? 'dash.games.one' : 'dash.games.other', { count })
</script>

<template>
  <section v-if="playedWith && teammates.length" class="flex flex-col gap-2" data-testid="played-with">
    <header class="flex items-center gap-2">
      <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t('dash.playedWith.title') }}</h2>
      <DashboardSourceBadge :source="playedWith.source" class="ml-auto" />
    </header>
    <ul class="surface flex flex-col divide-y divide-default/40 rounded-lg">
      <li v-for="mate in shown" :key="riotId(mate)">
        <NuxtLink
          :to="linkOf(mate)"
          :aria-label="t('dash.playedWith.open', { name: riotId(mate) })"
          class="surface-hover flex items-center gap-3 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <PlayerAvatar
            :src="mate.profileIconId !== null ? profileIconOf(mate.profileIconId) : null"
            :name="riotId(mate)"
            :size="32"
            :region="region"
            class="rounded-full"
          />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-medium text-default">{{ mate.gameName }}<span class="font-normal text-dimmed">#{{ mate.tagLine }}</span></span>
            <span class="text-[11px] tabular-nums text-muted">
              {{ gamesLabel(mate.games) }} · {{ t('dash.record', { wins: mate.wins, losses: mate.games - mate.wins }) }}
            </span>
          </span>
          <span class="shrink-0 text-sm font-semibold tabular-nums" :class="winRateTone(mate.wins / mate.games)">
            {{ formatPercentage(mate.wins / mate.games, 0) }}
          </span>
        </NuxtLink>
      </li>
    </ul>
    <UButton
      v-if="teammates.length > SHOWN"
      :label="open ? t('dash.list.less') : t('dash.list.more', { count: teammates.length })"
      :trailing-icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
      color="neutral"
      variant="ghost"
      size="xs"
      class="justify-center"
      @click="open = !open"
    />
  </section>
</template>
