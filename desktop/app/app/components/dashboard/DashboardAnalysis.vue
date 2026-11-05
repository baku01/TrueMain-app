<script setup lang="ts">
import type { ChampionStaticListItem } from '#shared/types/static-data'
import type { DetailedStats, StatLine } from '~/utils/player-stats'
import type { PlayerGame } from '~/types/record'
import type { ChampionPick, PlaystyleKey } from '~/utils/player-insights'
import { bestAllies, bestChampions, improvementsOf, playstyleOf, strengthsOf } from '~/utils/player-insights'
import { championDisplayName } from '#shared/utils/champion-name'

/**
 * The player read out of their games (`utils/player-insights`): the playstyle
 * their play leans to, what they beat their lane opponents on and what they
 * lose them on — each with what to work on — then the champions they win most
 * on and the allies they win most beside. The verdicts need the detailed
 * stats (`useProfileInsights`); the champions only the games on screen. It
 * opens the detailed stats panel, and folds on its own header.
 */
const props = defineProps<{
  stats: DetailedStats | null
  loading: boolean
  games: PlayerGame[]
  champions: ChampionStaticListItem[]
}>()

const { t } = useT()
const open = ref(true)
const championById = computed(() => new Map(props.champions.map(c => [c.championId, c])))
const canonicalIcon = useCanonicalIcon()

const PLAYSTYLE_ICON: Record<PlaystyleKey, string> = {
  carry: 'i-tabler-sword',
  farmer: 'i-tabler-coins',
  teamfighter: 'i-tabler-users-group',
  visionary: 'i-tabler-eye',
  objectives: 'i-tabler-dragon',
  frontline: 'i-tabler-shield',
  survivor: 'i-tabler-heart',
  balanced: 'i-tabler-scale',
}

const playstyle = computed(() => (props.stats ? playstyleOf(props.stats) : null))
const strengths = computed(() => (props.stats ? strengthsOf(props.stats) : []))
const improvements = computed(() => (props.stats ? improvementsOf(props.stats) : []))
const mains = computed(() => bestChampions(props.games))
const allies = computed(() => bestAllies(props.games))

const gap = (line: StatLine) => `${line.edge! > 0 ? '+' : ''}${Math.round(line.edge! * 100)}%`
const pick = (entry: ChampionPick) => ({
  ...entry,
  name: championDisplayName(entry.championId, championById.value.get(entry.championId)),
  icon: canonicalIcon(championById.value.get(entry.championId)?.iconUrl),
  rate: `${Math.round(entry.winRate * 100)}%`,
})
</script>

<template>
  <section class="flex flex-col gap-4 rounded-xl bg-elevated/30 p-3 ring-1 ring-default">
    <button type="button" class="flex w-full items-center gap-2 text-left" :aria-expanded="open" @click="open = !open">
      <UIcon name="i-tabler-bulb" class="size-5 text-primary" />
      <h3 class="text-sm font-semibold text-highlighted">{{ t('dash.analysis.title') }}</h3>
      <span v-if="stats" class="text-xs text-muted">{{ t('dash.analysis.sample', { games: stats.games }) }}</span>
      <UIcon name="i-lucide-chevron-down" class="ml-auto size-4 text-dimmed transition-transform" :class="open && 'rotate-180'" />
    </button>

    <template v-if="open">
    <div v-if="loading && !stats" class="grid gap-3 sm:grid-cols-2">
      <USkeleton class="h-24 rounded-lg sm:col-span-2" />
      <USkeleton class="h-32 rounded-lg" />
      <USkeleton class="h-32 rounded-lg" />
    </div>

    <template v-else>
      <!-- The playstyle: what the play leans to, against the same opponents. -->
      <div v-if="playstyle" class="flex items-start gap-4 rounded-lg bg-elevated/50 p-4 ring-1 ring-default">
        <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
          <UIcon :name="PLAYSTYLE_ICON[playstyle.key]" class="size-6" />
        </span>
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-muted">{{ t('dash.analysis.playstyle') }}</p>
          <p class="text-lg font-semibold text-highlighted">
            {{ t(`dash.playstyle.${playstyle.key}`) }}
            <span v-if="playstyle.second" class="text-sm font-normal text-muted">{{ t('dash.analysis.withTraits', { style: t(`dash.playstyle.${playstyle.second}`) }) }}</span>
          </p>
          <p class="mt-0.5 text-sm text-muted">{{ t(`dash.playstyle.${playstyle.key}.desc`) }}</p>
        </div>
      </div>

      <div v-if="stats" class="grid gap-3 md:grid-cols-2">
        <div class="rounded-lg bg-elevated/30 p-3 ring-1 ring-default">
          <p class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-highlighted">
            <UIcon name="i-tabler-trending-up" class="size-4 text-primary" />
            {{ t('dash.analysis.strengths') }}
          </p>
          <ul v-if="strengths.length" class="flex flex-col gap-2">
            <li v-for="line in strengths" :key="line.key" class="flex items-center justify-between gap-3 text-sm">
              <span class="text-default">{{ t(`dash.stats.line.${line.key}`) }}</span>
              <span class="shrink-0 font-semibold tabular-nums text-primary">{{ gap(line) }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">{{ t('dash.analysis.noStrengths') }}</p>
        </div>

        <div class="rounded-lg bg-elevated/30 p-3 ring-1 ring-default">
          <p class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-highlighted">
            <UIcon name="i-tabler-target-arrow" class="size-4 text-error" />
            {{ t('dash.analysis.improvements') }}
          </p>
          <ul v-if="improvements.length" class="flex flex-col gap-2.5">
            <li v-for="line in improvements" :key="line.key" class="text-sm">
              <p class="flex items-center justify-between gap-3">
                <span class="text-default">{{ t(`dash.stats.line.${line.key}`) }}</span>
                <span class="shrink-0 font-semibold tabular-nums text-error">{{ gap(line) }}</span>
              </p>
              <p class="text-xs leading-snug text-muted">{{ t(`dash.tip.${line.key}`) }}</p>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">{{ t('dash.analysis.noImprovements') }}</p>
        </div>
      </div>
      <p class="-mt-1 text-[11px] text-dimmed">{{ t('dash.analysis.versus') }}</p>

      <div class="grid gap-3 md:grid-cols-2">
        <div v-for="block in [{ key: 'mains', title: t('dash.analysis.mains'), hint: t('dash.analysis.mainsHint'), list: mains.map(pick) }, { key: 'allies', title: t('dash.analysis.allies'), hint: t('dash.analysis.alliesHint'), list: allies.map(pick) }]" :key="block.key" class="rounded-lg bg-elevated/30 p-3 ring-1 ring-default">
          <p class="text-sm font-semibold text-highlighted">{{ block.title }}</p>
          <p class="mb-2 text-xs text-muted">{{ block.hint }}</p>
          <ul v-if="block.list.length" class="flex flex-col gap-2">
            <li v-for="entry in block.list" :key="entry.championId" class="flex items-center gap-2.5">
              <img v-if="entry.icon" :src="entry.icon" :alt="entry.name" width="32" height="32" class="img-skeleton size-8 rounded-md">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-highlighted">{{ entry.name }}</p>
                <p class="text-[11px] text-muted">
                  {{ t('dash.analysis.record', { wins: entry.wins, losses: entry.games - entry.wins }) }}<template v-if="entry.kda !== null"> · {{ entry.kda.toFixed(2) }} KDA</template>
                </p>
              </div>
              <span class="text-sm font-semibold tabular-nums text-primary">{{ entry.rate }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">{{ t('dash.analysis.fewGames') }}</p>
        </div>
      </div>
    </template>
    </template>
  </section>
</template>
