<script setup lang="ts">
import type { CardHistory, CardMastery, CardRank, CardRead, CardSource } from '~/utils/sources/draft-player'
import { formatCount } from '#shared/utils/counts'
import { formatPercentage, getPositionIconUrl } from '#shared/utils/ddragon'
import { positionLabel } from '#common/utils/positions'
import { formatRank } from '#common/utils/tiers'
import { dataSource } from '~/utils/data-source'
import { regionOfPlatform } from '~/utils/blitz/player'
import { roleFit } from '~/utils/player-intel'
import { platformFor, queuedWith, readCardPart } from '~/utils/sources/draft-player'

/**
 * One player of our side, as Blitz's champion select shows them on hover: on
 * their role or off it (or autofilled), their rank, their mastery on the
 * champion they show, who of the lobby they queued with, and the champions
 * they played lately — each part from the source that had it, named beside it
 * (`utils/sources/draft-player`). Mounted when the hover opens, so a lobby is
 * only read for the players looked at; every read is kept for the session.
 */
const props = defineProps<{
  riotId: string
  championId: number | null
  /** The lane the client gave them. */
  position: string | null
  /** The player themselves: their own client's record is a source too. */
  me: boolean
  /** The others of our side the client names, for the duo line. */
  teammates: string[]
}>()

const { t } = useT()
const { nameOf } = useChampionStatics()
const { record, games } = usePlayerRecord()
const { state: lcu } = useLcuState()

const rank = ref<CardRead<CardRank> | null>(null)
const history = ref<CardRead<CardHistory> | null>(null)
const mastery = ref<CardRead<CardMastery> | null>(null)
const pending = ref(true)
const platform = ref<string | null>(null)

let latest = 0
watch(() => `${props.riotId}:${props.championId}`, async () => {
  const read = ++latest
  pending.value = true
  const platformId = await platformFor(props.riotId, record.value?.platformId ?? null)
  if (read !== latest) return
  platform.value = platformId
  const client = props.me ? { ranked: record.value?.ranked ?? [], games: games.value, mastery: lcu.value.championMastery ?? [] } : null
  const subject = { riotId: props.riotId, platformId: platformId ?? '', championId: props.championId }
  const [r, h, m] = await Promise.all([
    readCardPart<CardRank>('rank', subject, dataSource.value, client),
    readCardPart<CardHistory>('history', subject, dataSource.value, client),
    props.championId !== null ? readCardPart<CardMastery>('mastery', subject, dataSource.value, client) : Promise.resolve(null),
  ])
  if (read !== latest) return
  rank.value = r
  history.value = h
  mastery.value = m
  pending.value = false
}, { immediate: true })

const name = computed(() => {
  const at = props.riotId.lastIndexOf('#')
  return at > 0 ? { game: props.riotId.slice(0, at), tag: props.riotId.slice(at + 1) } : { game: props.riotId, tag: '' }
})
const fit = computed(() => (props.position && history.value ? roleFit(props.position, history.value.value.positions) : null))
const FIT_TONE = { main: 'text-data-good bg-data-good/10', secondary: 'text-warning bg-warning/10', autofill: 'text-data-bad bg-data-bad/10' } as const
const mates = computed(() => queuedWith(history.value?.value ?? null, props.teammates))
const gameNameOf = (riotId: string) => riotId.slice(0, Math.max(riotId.lastIndexOf('#'), 0)) || riotId
const winRate = computed(() => {
  const value = rank.value?.value
  const played = value ? value.wins + value.losses : 0
  return value && played ? value.wins / played : null
})
const champions = computed(() => (history.value?.value.champions ?? []).slice(0, 5))
/** Where the rank and the games came from, each named once. */
const sources = computed(() => [...new Set([rank.value?.source, history.value?.source].filter((source): source is CardSource => !!source))])
const sourceName = (source: CardSource) => (source === 'client' ? t('draft.player.source.client') : t(`source.name.${source}`))
const profile = computed(() => ({ path: '/', query: { riotId: props.riotId, region: platform.value ? regionOfPlatform(platform.value) ?? undefined : undefined } }))
</script>

<template>
  <div class="flex w-80 flex-col gap-3 p-3 text-left">
    <header class="flex items-center gap-2.5">
      <PlayerAvatar :src="null" :name="riotId" :size="36" :region="platform ? regionOfPlatform(platform) : null" />
      <div class="min-w-0 flex-1">
        <p class="flex items-center gap-2">
          <span class="min-w-0 flex-1 truncate text-sm font-bold text-highlighted">{{ name.game }}<span class="font-medium text-dimmed"> #{{ name.tag }}</span></span>
          <span v-if="fit" class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" :class="FIT_TONE[fit.kind]">{{ t(`draft.player.fit.${fit.kind}`) }}</span>
        </p>
        <p v-if="rank" class="flex min-w-0 items-center gap-1 text-xs text-muted">
          <RankIcon :tier="rank.value.tier" :size="16" class="shrink-0" />
          <span class="truncate">{{ formatRank(rank.value.tier, rank.value.division, { lp: rank.value.leaguePoints }) }}</span>
          <span v-if="winRate !== null" class="shrink-0 whitespace-nowrap font-semibold tabular-nums" :class="winRateTone(winRate)">· {{ formatPercentage(winRate, 0) }}</span>
        </p>
        <p v-else-if="!pending" class="text-xs text-dimmed">{{ t('draft.player.unranked') }}</p>
      </div>
    </header>

    <div v-if="pending" class="flex flex-col gap-1.5">
      <USkeleton class="h-4 w-2/3" />
      <USkeleton class="h-8 w-full" />
    </div>

    <template v-else>
      <!-- The roles their latest games gave them, ours marked. -->
      <section v-if="history?.value.positions.length" class="flex flex-col gap-1">
        <span class="stat-label">{{ t('draft.player.roles', { games: history.value.games }) }}</span>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="entry in history.value.positions"
            :key="entry.position"
            class="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset"
            :class="entry.position === position ? 'text-highlighted ring-primary/50 bg-primary/10' : 'text-muted ring-default'"
            :title="positionLabel(entry.position, { short: true }) ?? entry.position"
          >
            <img :src="getPositionIconUrl(entry.position)" alt="" class="size-3.5">{{ entry.games }}
          </span>
        </div>
      </section>

      <!-- Their mastery on the champion they show. -->
      <p v-if="championId !== null && mastery" class="flex items-center gap-2 text-xs text-default">
        <ChampionPortrait :champion-id="championId" size="sm" class="size-6! rounded-md!" />
        <span class="min-w-0 flex-1 truncate">
          {{ mastery.value.level !== null ? t('draft.player.masteryLevel', { level: mastery.value.level }) : t('draft.player.mastery') }}
          <span v-if="mastery.value.points !== null" class="text-dimmed">· {{ t('draft.player.points', { points: formatCount(mastery.value.points) }) }}</span>
        </span>
        <span class="text-[9px] font-semibold uppercase tracking-wide text-dimmed">{{ sourceName(mastery.source) }}</span>
      </p>

      <!-- Who of the lobby they queued with. -->
      <p v-if="mates.length" class="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <UIcon name="i-lucide-users" class="size-3.5" />
        {{ mates.length > 1 ? t('draft.player.trio', { names: mates.map(gameNameOf).join(', ') }) : t('draft.player.duo', { name: gameNameOf(mates[0]!) }) }}
      </p>

      <!-- The champions they played lately. -->
      <section v-if="champions.length" class="flex flex-col gap-1">
        <span class="stat-label">{{ t('draft.player.mostPlayed') }}</span>
        <div class="flex gap-1.5">
          <span v-for="entry in champions" :key="entry.championId" class="flex flex-col items-center gap-0.5" :title="nameOf(entry.championId)">
            <ChampionPortrait :champion-id="entry.championId" size="sm" class="size-8! rounded-md!" :class="entry.championId === championId ? 'ring-2 ring-primary' : ''" />
            <span class="text-[10px] font-semibold tabular-nums text-muted">{{ entry.games }}</span>
          </span>
        </div>
      </section>

      <p v-if="!rank && !history && !mastery" class="text-xs text-dimmed">{{ t('draft.player.nothing') }}</p>
    </template>

    <footer class="flex items-center justify-between gap-2 border-t border-default pt-2">
      <span class="flex flex-wrap gap-1">
        <span v-for="source in sources" :key="source" class="rounded bg-accented/60 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-muted">{{ sourceName(source) }}</span>
      </span>
      <NuxtLink :to="profile" class="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
        {{ t('draft.player.profile') }}<UIcon name="i-lucide-arrow-right" class="size-3.5" />
      </NuxtLink>
    </footer>
  </div>
</template>
