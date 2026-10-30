<!--
  The dashboard's champions: the site's main champions (`ProfileMainChampions`)
  over the client's latest games, reading performance rather than play rate —
  each champion's games and KDA, and its win rate on the data axis. A row opens
  the champion's builds on the lane the player plays it.
-->
<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { ProfileMainChampion } from '#shared/types/profile'
import type { ChampionStaticListItem } from '#shared/types/static-data'
import type { ChampionLine } from '~/utils/player-form'
import { formatPercentage } from '#shared/utils/ddragon'
import { formatKdaRatio, kdaRatio } from '#shared/utils/kda'
import { winRateTone } from '#common/utils/rate-tone'

const props = defineProps<{
  lines: ChampionLine[]
  champions: ChampionStaticListItem[]
}>()

const SHOWN = 5
const { t } = useT()
const gamesLabel = (count: number) => t(count === 1 ? 'dash.games.one' : 'dash.games.other', { count })

const linesById = computed(() => new Map(props.lines.map(line => [line.championId, line])))

/** The lines as the site's mains: games out of the sample, nothing retired or measured elsewhere. */
const mains = computed<ProfileMainChampion[]>(() => {
  const total = props.lines.reduce((sum, line) => sum + line.games, 0)
  return props.lines.slice(0, SHOWN).map(line => ({
    championId: line.championId,
    games: line.games,
    sampleMatches: total,
    playRate: total ? line.games / total : 0,
    primaryPosition: line.position ?? '',
    isOtp: false,
    isSampleRetired: false,
    measuredAtUtc: '',
  }))
})

const { pathFor } = useChampionSlugs()
const linkTo = (main: ProfileMainChampion): RouteLocationRaw => ({
  path: pathFor(main.championId),
  query: main.primaryPosition ? { position: main.primaryPosition } : {},
})

const lineOf = (main: ProfileMainChampion) => linesById.value.get(main.championId)!
const winRate = (line: ChampionLine) => line.wins / line.games
</script>

<template>
  <ProfileMainChampions :mains="mains" :champions="champions" :link-to="linkTo" :title="t('dash.champions.title')">
    <template #meta="{ main }">
      {{ t('dash.champions.meta', { games: gamesLabel(main.games), kda: formatKdaRatio(kdaRatio(lineOf(main))) }) }}
    </template>
    <template #value="{ main }">
      <p class="text-right leading-tight" :class="winRateTone(winRate(lineOf(main)))">
        {{ formatPercentage(winRate(lineOf(main)), 0) }}
      </p>
      <p class="text-right text-[10px] font-normal leading-tight text-dimmed">
        {{ t('dash.record', { wins: lineOf(main).wins, losses: main.games - lineOf(main).wins }) }}
      </p>
    </template>
  </ProfileMainChampions>
</template>
