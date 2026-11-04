<script setup lang="ts">
import PlayerAvatar from '~/components/PlayerAvatar.vue'
import type { ProMatch } from '~/utils/blitz/pro'
import { readProMatches } from '~/utils/blitz/pro'

/**
 * ProBuild's pros: the recent solo-queue games professional players played on
 * the champion and lane the page shows, from Blitz (`utils/blitz/pro.ts`) —
 * who, for which team, against whom, the result, and the build they finished
 * with. Only shown while Settings reads from Blitz; TrueMain has no pros.
 * A player's chip narrows the list to that player's games.
 */
const props = defineProps<{ championId: number, position: string | null }>()

const { t } = useT()
const { nameOf, portraitOf } = useChampionStatics()
const { items, summoners, runeTree } = useStaticData()

const matches = ref<ProMatch[]>([])
const loading = ref(false)
const player = ref<number | null>(null)

let latest = 0
watch(() => [props.championId, props.position] as const, async ([championId, position]) => {
  const id = ++latest
  loading.value = true
  player.value = null
  try {
    const read = await trackLoad(readProMatches(championId, position))
    if (id === latest) matches.value = read
  }
  catch {
    if (id === latest) matches.value = []
  }
  finally {
    if (id === latest) loading.value = false
  }
}, { immediate: true })

/** The players in the list, most games first, for the chips. */
const players = computed(() => {
  const counts = new Map<number, { id: number, name: string, portraitUrl: string | null, games: number }>()
  for (const match of matches.value) {
    const known = counts.get(match.player.id)
    counts.set(match.player.id, { ...match.player, games: (known?.games ?? 0) + 1 })
  }
  return [...counts.values()].sort((a, b) => b.games - a.games).slice(0, 10)
})

const shown = computed(() => matches.value.filter(match => player.value === null || match.player.id === player.value).slice(0, 20))

const ago = (at: number) => {
  const hours = Math.round((at - Date.now()) / 3_600_000)
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  return Math.abs(hours) < 24 ? format.format(hours, 'hour') : format.format(Math.round(hours / 24), 'day')
}
const kda = (match: ProMatch) => `${match.kills} / ${match.deaths} / ${match.assists}`
</script>

<template>
  <section class="surface space-y-4 rounded-2xl p-4">
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h3 class="text-base font-semibold text-highlighted">{{ t('pro.title') }}</h3>
        <p class="text-xs text-muted">{{ t('pro.description') }}</p>
      </div>
      <UBadge :label="t('source.badge')" color="primary" size="sm" />
    </header>

    <div v-if="players.length > 1" class="flex flex-wrap gap-1.5">
      <UButton :label="t('pro.allPros')" size="xs" :color="player === null ? 'primary' : 'neutral'" :variant="player === null ? 'soft' : 'ghost'" @click="player = null" />
      <UButton
        v-for="entry in players"
        :key="entry.id"
        size="xs"
        :color="player === entry.id ? 'primary' : 'neutral'"
        :variant="player === entry.id ? 'soft' : 'ghost'"
        @click="player = player === entry.id ? null : entry.id"
      >
        <PlayerAvatar :src="entry.portraitUrl" :name="entry.name" :size="18" class="rounded-sm" />
        {{ entry.name }} · {{ entry.games }}
      </UButton>
    </div>

    <div v-if="loading && !matches.length" aria-busy="true" class="space-y-2">
      <USkeleton v-for="row in 4" :key="row" class="h-16 w-full" />
    </div>
    <p v-else-if="!shown.length" class="surface rounded-xl px-4 py-8 text-center text-sm text-muted">{{ t('pro.none') }}</p>

    <ul v-else class="space-y-2">
      <li
        v-for="match in shown"
        :key="match.matchId"
        class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-xl border-l-[3px] px-3 py-2.5 lg:grid-cols-[auto_minmax(0,11rem)_auto_minmax(0,1fr)_auto]"
        :class="match.win ? 'pro-win' : 'pro-loss'"
      >
        <PlayerAvatar :src="match.player.portraitUrl" :name="match.player.name" :size="40" class="rounded-lg" />

        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-highlighted">
            {{ match.player.name }}
            <span v-if="match.team" class="ml-1 text-xs font-medium text-dimmed">{{ match.team.tag }}</span>
          </p>
          <p class="truncate text-[11px] text-muted">
            {{ match.region }} · {{ ago(match.playedAt) }} · {{ t('pro.minutes', { minutes: Math.round(match.durationSeconds / 60) }) }}
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <div class="flex items-center gap-1.5">
            <img v-if="portraitOf(match.championId)" :src="portraitOf(match.championId)!" :alt="nameOf(match.championId)" width="32" height="32" class="img-skeleton size-8 rounded-md">
            <template v-if="match.opponentChampionId">
              <span class="text-[10px] uppercase text-dimmed">{{ t('pro.vs') }}</span>
              <img v-if="portraitOf(match.opponentChampionId)" :src="portraitOf(match.opponentChampionId)!" :alt="nameOf(match.opponentChampionId)" width="24" height="24" class="img-skeleton size-6 rounded-md opacity-80">
            </template>
          </div>
          <div class="text-right">
            <p class="text-sm font-semibold tabular-nums text-highlighted">{{ kda(match) }}</p>
            <UBadge :label="match.win ? t('pro.win') : t('pro.loss')" :color="match.win ? 'primary' : 'error'" variant="subtle" size="sm" class="mt-0.5" />
          </div>
        </div>

        <div class="col-span-3 flex flex-wrap items-center gap-3 lg:col-span-1">
          <div class="flex items-center gap-1">
            <GameTooltipPerkIcon v-if="match.keystoneId" :perk="runeTree?.perks[match.keystoneId] ?? null" :width="28" :height="28" class="size-7 rounded-full" />
            <GameTooltipSummonerSpellIcon v-for="id in match.spells" :key="id" :spell="summoners[id] ?? null" :width="22" :height="22" class="size-[22px] rounded" />
          </div>
          <div class="flex items-center gap-1">
            <template v-for="(id, index) in match.items" :key="index">
              <GameTooltipItemIcon v-if="id" :item="items[id] ?? null" :width="26" :height="26" class="size-[26px] rounded" />
              <span v-else class="size-[26px] rounded bg-accented/60" />
            </template>
          </div>
        </div>

        <span class="hidden text-[11px] text-dimmed lg:block">{{ t('pro.patch', { patch: match.patch }) }}</span>
      </li>
    </ul>
  </section>
</template>
