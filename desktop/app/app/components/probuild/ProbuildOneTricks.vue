<script setup lang="ts">
import { formatCount } from '#shared/utils/counts'
import { formatPercentage, getPositionIconUrl } from '#shared/utils/ddragon'
import { formatTierName } from '#common/utils/tiers'
import { POSITIONS, positionLabel } from '#common/utils/positions'
import type { OneTrick, OneTricks } from '~/utils/sources/one-tricks'
import { readOneTricks } from '~/utils/sources/one-tricks'
import { PLAYER_REGIONS, platformOf, regionOfPlatform } from '~/utils/blitz/player'

/**
 * The champion's one-tricks, as Blitz's "One Tricks" page lists them: each
 * player, their rank, how much of a one-trick they are, their games on the
 * champion, its share of their games and their win rate on it — by lane and
 * server, the most dedicated first, any column a click away from sorting by
 * it. On ProBuild rather than the champion page: ProBuild is where the app
 * lists the players a champion's builds are read from (the pros, the ranked
 * players), and a one-trick is the next such player — the champion page is
 * the lane's numbers. A badge says which source the rows came from
 * (`utils/sources/one-tricks.ts`); a name opens that player's profile.
 */
const props = defineProps<{ championId: number, position: string | null }>()
const { t } = useT()
const { nameOf, patch } = useChampionStatics()
const { mainEntryOf } = useTierList()

/** The page's lane, else the champion's main one; the player can switch it here as on Blitz. */
const lane = ref<string>('MIDDLE')
watch(() => [props.championId, props.position] as const, () => {
  lane.value = props.position ?? mainEntryOf(props.championId)?.position ?? 'MIDDLE'
}, { immediate: true })
const region = ref('world')
const regions = computed(() => [{ label: t('onetricks.world'), value: 'world' }, ...PLAYER_REGIONS.map(key => ({ label: key.toUpperCase(), value: key }))])

const answer = shallowRef<OneTricks | null>(null)
const failed = ref(false)
let latest = 0
watch(() => [props.championId, lane.value, region.value] as const, async ([championId, position, server]) => {
  const read = ++latest
  answer.value = null
  failed.value = false
  try {
    const result = await trackLoad(readOneTricks(championId, position, server === 'world' ? null : platformOf(server)))
    if (read === latest) answer.value = result
  }
  catch {
    if (read === latest) failed.value = true
  }
}, { immediate: true })

const SOURCE_NAME = { truemain: 'TrueMain', blitz: 'Blitz' } as const
type Column = 'score' | 'games' | 'share' | 'winRate'
const sort = ref<Column>('score')
const COLUMNS: { key: Column, label: string, hint?: string }[] = [
  { key: 'score', label: 'onetricks.score', hint: 'onetricks.scoreHint' },
  { key: 'games', label: 'onetricks.games' },
  { key: 'share', label: 'onetricks.share' },
  { key: 'winRate', label: 'onetricks.winRate' },
]
const rows = computed(() => [...answer.value?.players ?? []].sort((a, b) => (b[sort.value] ?? -1) - (a[sort.value] ?? -1)))
/** The first twenty, the rest a click away: every avatar reads its account. */
const shown = ref(20)
watch(answer, () => (shown.value = 20))

const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER'])
const rankText = (player: OneTrick) => {
  if (!player.tier) return '—'
  const tier = formatTierName(player.tier)
  const lp = player.leaguePoints !== null ? `${formatCount(player.leaguePoints)} LP` : ''
  return APEX.has(player.tier.toUpperCase()) ? `${tier} · ${lp}` : `${tier} ${player.division ?? ''} · ${lp}`
}
const riotId = (player: OneTrick) => `${player.gameName}#${player.tagLine}`
const profileOf = (player: OneTrick) => {
  const key = player.platformId ? regionOfPlatform(player.platformId) : null
  return { path: '/', query: key ? { riotId: riotId(player), region: key } : { riotId: riotId(player) } }
}
const iconOf = (player: OneTrick) => (player.profileIconId !== null && patch.value ? `https://ddragon.leagueoflegends.com/cdn/${patch.value}/img/profileicon/${player.profileIconId}.png` : null)
</script>

<template>
  <section class="surface space-y-3 rounded-2xl p-4">
    <header class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div class="min-w-0">
        <h3 class="flex items-center gap-2 text-base font-semibold text-highlighted">
          <UIcon name="i-lucide-crosshair" class="size-4 text-primary" />{{ t('onetricks.title') }}
          <span v-if="answer" class="rounded bg-primary/15 px-1.5 py-px text-[10px] font-bold text-primary" :title="t('onetricks.from', { source: SOURCE_NAME[answer.source] })">{{ SOURCE_NAME[answer.source] }}</span>
        </h3>
        <p class="text-xs text-muted">{{ t('onetricks.description', { name: nameOf(championId) }) }}</p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <div class="flex rounded-lg p-0.5 ring-1 ring-inset ring-default" role="group" :aria-label="t('onetricks.lane')">
          <button
            v-for="entry in POSITIONS"
            :key="entry"
            type="button"
            class="flex size-7 items-center justify-center rounded-md transition-colors"
            :class="lane === entry ? 'bg-accented' : 'opacity-50 hover:opacity-100'"
            :title="positionLabel(entry, { short: true })"
            :aria-pressed="lane === entry"
            @click="lane = entry"
          >
            <img :src="getPositionIconUrl(entry)" alt="" class="size-4">
          </button>
        </div>
        <USelect v-model="region" :items="regions" size="sm" class="w-28" :aria-label="t('onetricks.region')" />
      </div>
    </header>

    <div v-if="answer === null && !failed" class="space-y-1.5">
      <USkeleton v-for="row in 5" :key="row" class="h-10 w-full" />
    </div>
    <p v-else-if="failed" class="py-6 text-center text-sm text-muted">{{ t('onetricks.failed') }}</p>
    <div v-else-if="!rows.length" class="flex flex-col items-center gap-1 py-8 text-center">
      <UIcon name="i-lucide-search-x" class="size-6 text-dimmed" />
      <p class="text-sm font-semibold text-highlighted">{{ t('onetricks.none') }}</p>
      <p class="max-w-sm text-xs text-muted">{{ t('onetricks.noneHint', { name: nameOf(championId) }) }}</p>
    </div>
    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-[40rem] text-sm">
        <thead>
          <tr class="border-b border-default text-left">
            <th class="w-6 pb-2" />
            <th class="pb-2 stat-label">{{ t('onetricks.player') }}</th>
            <th class="pb-2 stat-label">{{ t('onetricks.rank') }}</th>
            <th v-for="column in COLUMNS" :key="column.key" class="pb-2 text-right">
              <button type="button" class="stat-label inline-flex items-center gap-0.5 transition-colors hover:text-highlighted" :class="sort === column.key && 'text-primary!'" :title="column.hint ? t(column.hint) : undefined" @click="sort = column.key">
                {{ t(column.label) }}<UIcon v-if="sort === column.key" name="i-lucide-chevron-down" class="size-3" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(player, index) in rows.slice(0, shown)" :key="riotId(player)" class="border-b border-default/50 transition-colors last:border-0 hover:bg-accented/30">
            <td class="py-1.5 pr-1 text-right text-xs font-semibold tabular-nums text-dimmed">{{ index + 1 }}</td>
            <td class="py-1.5">
              <NuxtLink :to="profileOf(player)" class="group flex min-w-0 items-center gap-2.5" :title="t('onetricks.openProfile', { name: riotId(player) })">
                <PlayerAvatar :src="iconOf(player)" :name="riotId(player)" :region="player.profileIconId === null ? player.platformId : null" :size="28" class="rounded-md" />
                <span class="min-w-0 truncate">
                  <span class="font-semibold text-highlighted group-hover:text-primary">{{ player.gameName }}</span>
                  <span class="text-xs text-dimmed"> #{{ player.tagLine }}</span>
                </span>
              </NuxtLink>
            </td>
            <td class="py-1.5">
              <span class="flex items-center gap-1.5 whitespace-nowrap text-xs text-default">
                <RankIcon :tier="player.tier" :size="20" loading="lazy" />{{ rankText(player) }}
              </span>
            </td>
            <td class="py-1.5 text-right font-semibold tabular-nums text-highlighted">{{ player.score !== null ? Math.round(player.score * 100) : '—' }}</td>
            <td class="py-1.5 text-right tabular-nums text-default">{{ formatCount(player.games) }}</td>
            <td class="py-1.5 text-right tabular-nums text-default">{{ player.share !== null ? formatPercentage(player.share, 0) : '—' }}</td>
            <td class="py-1.5 text-right font-semibold tabular-nums" :class="winRateTone(player.winRate)" :title="player.winRate === null ? t('onetricks.noWinRate') : undefined">{{ player.winRate !== null ? formatPercentage(player.winRate, 0) : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <UButton v-if="rows.length > shown" :label="t('onetricks.more', { count: rows.length - shown })" color="neutral" variant="ghost" size="xs" class="mt-2" @click="shown = rows.length" />
    </div>
  </section>
</template>
