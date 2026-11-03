<script setup lang="ts">
import { formatPercentage, getPositionIconUrl } from '#shared/utils/ddragon'
import { formatKdaRatio } from '#shared/utils/kda'
import { isChampionPosition, positionLabel } from '#common/utils/positions'
import type { LoadingPlayer } from '~/types/loading'
import { formatLeaguePoints, formatRank, tierColor } from '#common/utils/tiers'
import {
  GOOD_KDA,
  championRecord,
  isRanked,
  recentWinRate,
  roleFit,
  seasonWinRate,
  streakOf,
} from '~/utils/player-intel'

/**
 * What the Game page says about one player (#1828), in place of the items and
 * K/D/A the game already shows: their standing, whether they are on their
 * role or autofilled, how they do on the champion they are on, their streak
 * and their latest games — all read through the player's own client by the
 * loading screen (`useLoadingPlayers`). Drawn mirrored for the right-hand
 * team, so each lane reads as a face-off.
 */
const props = withDefaults(defineProps<{
  riotId: string
  /** The role played in this game, as the game names it. */
  position: string
  championId: number | null
  /** The loading screen's line for this player; null when it has none. */
  line: LoadingPlayer | null
  /** The loading screen is reading the game: a line still missing is coming. */
  reading: boolean
  mirrored?: boolean
}>(), { mirrored: false })

const { t } = useT()
const { nameOf } = useChampionStatics()

const name = computed(() => props.riotId.split('#')[0] ?? '')
const tag = computed(() => props.riotId.split('#')[1] ?? '')

const form = computed(() => props.line?.form ?? null)
/** Something about this player is still to come: the line itself, their history or their standing. */
const expected = computed(() => (props.reading || Boolean(props.line)) && !props.line?.anonymous)
const settled = computed(() => Boolean(props.line && (props.line.form || props.line.failed)))
const pending = computed(() => !settled.value && expected.value)
const rankPending = computed(() => !props.line?.rankRead && !props.line?.rankFailed && expected.value)

// ─── Rank ───────────────────────────────────────────────────────────────────

const rank = computed(() => props.line?.rank ?? null)
const ranked = computed(() => (rank.value && isRanked(rank.value) ? rank.value : null))
const rankTitle = computed(() => {
  const queue = rank.value
  if (!queue) return t('game.intel.unrankedSeason')
  const record = seasonWinRate(queue)
  const which = queue.queueType === 'RANKED_FLEX_SR' ? t('game.intel.flex') : t('game.intel.solo')
  return record === null ? which : t('game.intel.rankRecord', { queue: which, wins: queue.wins, losses: queue.losses, rate: formatPercentage(record, 0) })
})

// ─── Role, champion, streak ─────────────────────────────────────────────────

const lane = (position: string | null) => (position && isChampionPosition(position) ? position : null)
const fit = computed(() => {
  const position = props.position || props.line?.position || ''
  return form.value ? roleFit(position, form.value.positions) : null
})
const fitTitle = computed(() => {
  const value = fit.value
  if (!value) return ''
  const here = positionLabel(value.position, { short: true }) ?? value.position
  const games = t('game.intel.roleGames', { games: value.games, roleGames: value.roleGames, here })
  if (value.kind === 'main') return t('game.intel.playsMost', { here, games })
  const usual = lane(value.usual)
  return usual ? t('game.intel.usually', { usual: positionLabel(usual, { short: true }) ?? '', games }) : games
})

const champion = computed(() => (form.value ? championRecord(form.value) : null))
const championName = computed(() => (props.championId === null ? t('game.intel.thisChampion') : nameOf(props.championId)))
const championTitle = computed(() => {
  const record = champion.value
  if (!form.value) return ''
  if (!record) return t('game.intel.noGameOn', { champion: championName.value, games: form.value.games })
  const line = t('game.intel.average', { kills: record.kills.toFixed(1), deaths: record.deaths.toFixed(1), assists: record.assists.toFixed(1) })
  return t('game.intel.championGames', { games: record.games, total: form.value.games, champion: championName.value, line })
})

const streak = computed(() => (form.value ? streakOf(form.value) : null))
const recentRate = computed(() => (form.value ? recentWinRate(form.value) : null))
</script>

<template>
  <div class="flex min-w-0 flex-1 items-center gap-3" :class="mirrored && 'flex-row-reverse'">
    <!-- Who: name, standing, role and streak. -->
    <div class="flex min-w-0 flex-1 flex-col gap-1 leading-tight" :class="mirrored && 'items-end text-right'">
      <p class="flex max-w-full items-baseline gap-1.5 truncate text-[13px]" :class="mirrored && 'flex-row-reverse'" :title="riotId">
        <template v-if="line?.anonymous">
          <UIcon name="i-lucide-eye-off" class="size-3 shrink-0 self-center text-dimmed" />
          <span class="text-muted">{{ t('game.intel.anonymous') }}</span>
        </template>
        <template v-else>
          <span class="truncate font-medium text-highlighted">{{ name }}<span v-if="tag" class="font-normal text-dimmed">#{{ tag }}</span></span>
        </template>
      </p>

      <div class="flex h-5 items-center gap-1.5" :class="mirrored && 'flex-row-reverse'">
        <template v-if="ranked">
          <RankIcon :tier="ranked.tier" :size="18" />
          <span class="text-xs font-semibold" :class="tierColor(ranked.tier)" :title="rankTitle">
            {{ formatRank(ranked.tier, ranked.division) }}
          </span>
          <span class="text-[11px] tabular-nums text-dimmed">{{ formatLeaguePoints(ranked.leaguePoints) }}</span>
          <span v-if="ranked.queueType === 'RANKED_FLEX_SR'" class="rounded-sm px-1 text-[9px] font-semibold uppercase tracking-wide text-dimmed ring-1 ring-default" :title="t('game.intel.flexTitle')">{{ t('game.intel.flexBadge') }}</span>
        </template>
        <span v-else-if="rank" class="text-[11px] text-muted" :title="rankTitle">{{ t('game.intel.placements', { played: rank.wins + rank.losses }) }}</span>
        <USkeleton v-else-if="rankPending" class="h-3 w-20" />
        <span v-else-if="line?.rankRead" class="text-[11px] text-dimmed">{{ t('game.intel.unranked') }}</span>
      </div>

      <div v-if="fit || streak" class="flex flex-wrap items-center gap-1" :class="mirrored && 'flex-row-reverse'">
        <span
          v-if="fit"
          class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1"
          :class="fit.kind === 'autofill' ? 'bg-primary/10 text-primary ring-primary/30' : 'bg-elevated/60 text-muted ring-default'"
          :title="fitTitle"
        >
          <UIcon v-if="fit.kind === 'autofill'" name="i-lucide-shuffle" class="size-3" />
          <img v-else-if="lane(fit.position)" :src="getPositionIconUrl(fit.position)" alt="" class="size-3 opacity-80">
          {{ fit.kind === 'main' ? t('game.intel.mainRole') : fit.kind === 'secondary' ? t('game.intel.secondaryRole') : t('game.intel.autofill') }}
          <template v-if="fit.kind === 'autofill' && lane(fit.usual)">
            <span class="font-normal opacity-70">{{ t('game.intel.usualMain', { role: positionLabel(lane(fit.usual)!, { short: true }) ?? '' }) }}</span>
          </template>
        </span>
        <span
          v-if="streak"
          class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ring-1"
          :class="streak.wins ? 'bg-data-good/10 text-data-good ring-data-good/30' : 'bg-elevated/60 text-muted ring-default'"
          :title="t(streak.wins ? 'game.intel.wonTitle' : 'game.intel.lostTitle', { games: streak.games })"
        >
          <UIcon :name="streak.wins ? 'i-lucide-flame' : 'i-lucide-trending-down'" class="size-3" />
          {{ t(streak.wins ? 'game.intel.wonRow' : 'game.intel.lostRow', { games: streak.games }) }}
        </span>
      </div>
    </div>

    <!-- How they do: on this champion, then their latest games. -->
    <div class="flex w-32 shrink-0 flex-col gap-1.5" :class="mirrored ? 'items-start' : 'items-end'">
      <template v-if="form">
        <div v-if="champion" class="flex items-baseline gap-1.5 tabular-nums" :class="mirrored && 'flex-row-reverse'" :title="championTitle">
          <span class="text-[13px] font-semibold" :class="champion.winRate >= 0.5 ? 'text-data-good' : 'text-data-bad'">{{ formatPercentage(champion.winRate, 0) }}</span>
          <span class="text-[11px] text-muted">{{ champion.games === 1 ? t('game.intel.games.one', { count: champion.games }) : t('game.intel.games.other', { count: champion.games }) }}</span>
        </div>
        <span
          v-else
          class="inline-flex items-center gap-1 rounded-md bg-elevated/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted ring-1 ring-default"
          :title="championTitle"
        >
          <UIcon name="i-lucide-sparkles" class="size-3" />{{ t('game.intel.firstTime') }}
        </span>
        <p v-if="champion" class="text-[11px] tabular-nums text-dimmed" :title="championTitle">
          <span :class="champion.kda >= GOOD_KDA ? 'text-data-good' : 'text-muted'">{{ formatKdaRatio(champion.kda) }}</span> {{ t('game.intel.kda') }}
        </p>
        <div v-if="form.recent.length" class="flex items-center gap-1.5" :class="mirrored && 'flex-row-reverse'">
          <LoadingRecent :games="form.recent" />
          <span v-if="recentRate !== null" class="text-[10px] tabular-nums text-dimmed" :title="t('game.intel.recentWon', { rate: formatPercentage(recentRate, 0), games: form.recent.length })">{{ formatPercentage(recentRate, 0) }}</span>
        </div>
      </template>
      <template v-else-if="pending">
        <USkeleton class="h-3 w-16" />
        <USkeleton class="h-2.5 w-10" />
        <USkeleton class="h-4 w-20" />
      </template>
      <span v-else-if="line?.failed" class="text-[11px] text-dimmed">{{ t('game.intel.historyUnavailable') }}</span>
    </div>
  </div>
</template>
