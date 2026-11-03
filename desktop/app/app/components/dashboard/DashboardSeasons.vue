<script setup lang="ts">
import type { OpggProfile, SeasonTier } from '~/utils/sources/opgg-profile'
import { formatTierName } from '#common/utils/tiers'

/**
 * What op.gg knows of the player beyond this season's rank: their place on the
 * region's ladder, the highest they reached this season, and the tier they
 * ended each past season on, newest first.
 */
const props = defineProps<{ profile: OpggProfile | null }>()
const { t } = useT()

const tierLabel = (season: SeasonTier) => {
  const name = formatTierName(season.tier)
  return ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(season.tier) ? `${name} · ${season.leaguePoints} LP` : `${name} ${season.division}`
}
const TIER_COLOR: Record<string, string> = {
  IRON: '#8a7f7a', BRONZE: '#a8693f', SILVER: '#9fb0bd', GOLD: '#d6ad4f', PLATINUM: '#4fb0a5', EMERALD: '#3cb878',
  DIAMOND: '#6f8cf0', MASTER: '#b45fd1', GRANDMASTER: '#d6534f', CHALLENGER: '#f0c75a',
}
const top = computed(() => {
  const ladder = props.profile?.ladder
  return ladder && ladder.total > 0 ? Math.max(0.01, Math.round((ladder.rank / ladder.total) * 10000) / 100) : null
})
</script>

<template>
  <section v-if="profile && (profile.ladder || profile.peak || profile.previousSeasons.length)" class="surface space-y-3 rounded-2xl p-4">
    <header class="flex items-center gap-2">
      <h2 class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">{{ t('dash.seasons.title') }}</h2>
      <span class="ml-auto text-[10px] text-dimmed">op.gg</span>
    </header>
    <div class="grid grid-cols-2 gap-2">
      <div v-if="profile.ladder" class="rounded-lg bg-elevated/50 px-3 py-2 ring-1 ring-default">
        <p class="text-[10px] uppercase tracking-wider text-dimmed">{{ t('dash.seasons.ladder') }}</p>
        <p class="text-sm font-semibold tabular-nums text-highlighted">#{{ profile.ladder.rank.toLocaleString() }}</p>
        <p v-if="top !== null" class="text-[10px] tabular-nums text-muted">{{ t('dash.seasons.top', { share: top }) }}</p>
      </div>
      <div v-if="profile.peak" class="rounded-lg bg-elevated/50 px-3 py-2 ring-1 ring-default">
        <p class="text-[10px] uppercase tracking-wider text-dimmed">{{ t('dash.seasons.peak') }}</p>
        <p class="text-sm font-semibold" :style="{ color: TIER_COLOR[profile.peak.tier] }">{{ tierLabel(profile.peak) }}</p>
      </div>
    </div>
    <div v-if="profile.previousSeasons.length">
      <p class="mb-1.5 text-[10px] uppercase tracking-wider text-dimmed">{{ t('dash.seasons.previous') }}</p>
      <ul class="flex flex-wrap gap-1.5">
        <li
          v-for="season in profile.previousSeasons.slice(0, 8)"
          :key="season.seasonId"
          class="rounded-md px-2 py-1 text-[11px] font-semibold ring-1 ring-default"
          :style="{ color: TIER_COLOR[season.tier], backgroundColor: `${TIER_COLOR[season.tier] ?? '#888'}1a` }"
          :title="t('dash.seasons.seasonHint', { id: season.seasonId })"
        >
          {{ tierLabel(season) }}
        </li>
      </ul>
    </div>
  </section>
</template>
