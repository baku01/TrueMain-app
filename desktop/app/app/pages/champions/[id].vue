<script setup lang="ts">
import ChampionAbilities from '~/components/Champion/ChampionAbilities.vue'
import ChampionCounters from '~/components/Champion/ChampionCounters.vue'
import ChampionSynergies from '~/components/Champion/ChampionSynergies.vue'
import { POSITIONS, positionLabel } from '#common/utils/positions'
import type { ChampionTierListResponse, ChampionTrendPoint } from '#shared/types/champions'
import type { TierEntry } from '~/composables/useTierList'
import type { Lane } from '~/types/draft'
import { SOURCE_ELO_BRACKET } from '~/utils/data-source'
import { normalizePatch } from '~/utils/sources/directory'

/**
 * One champion: the site's champion banner (`ChampionHero`) on a lane, and its
 * builds on that lane in the same view the draft opens after a pick. The lanes
 * offered are the ones the site tiers it on, most played first.
 */
const { t } = useT()
const route = useRoute()
const router = useRouter()

const championId = computed(() => Number(route.params.id))
const { nameOf, portraitOf, splashOf } = useChampionStatics()
const { entries: defaultEntries, patch: defaultPatch } = useTierList()

const requestedPatch = computed(() => (typeof route.query.patch === 'string' && route.query.patch ? route.query.patch : null))
const requestedElo = computed(() => (typeof route.query.elo === 'string' && route.query.elo ? route.query.elo.toUpperCase() : null))
const customSlice = computed(() => Boolean(
  (requestedElo.value && requestedElo.value !== SOURCE_ELO_BRACKET)
  || (requestedPatch.value && defaultPatch.value && normalizePatch(requestedPatch.value) !== normalizePatch(defaultPatch.value)),
))

const sliceEntries = shallowRef<TierEntry[] | null>(null)
const slicePatch = ref('')
let sliceToken = 0
watch([requestedPatch, requestedElo, customSlice], async ([patchQuery, eloQuery, isCustom]) => {
  const token = ++sliceToken
  if (!isCustom) {
    sliceEntries.value = null
    slicePatch.value = ''
    return
  }
  const query: Record<string, string> = {}
  if (patchQuery) query.patch = patchQuery
  if (eloQuery) query.eloBracket = eloQuery
  try {
    const answer = await apiGet<ChampionTierListResponse>('/champions/tierlist', query)
    if (token !== sliceToken) return
    sliceEntries.value = answer.tiers.flatMap(group => group.entries.map(item => ({ ...item, tier: group.tier })))
    slicePatch.value = answer.patchVersion
  }
  catch {
    if (token === sliceToken) sliceEntries.value = null
  }
}, { immediate: true })

const entries = computed(() => sliceEntries.value ?? defaultEntries.value)
const patch = computed(() => slicePatch.value || defaultPatch.value)

/** The lanes the champion is tiered on, most played first. */
const lanes = computed<Lane[]>(() => entries.value
  .filter(item => item.championId === championId.value)
  // A source that counts no games (Tencent) orders them by pick rate.
  .sort((a, b) => b.games - a.games || b.pickRate - a.pickRate)
  .map(item => item.position as Lane)
  .filter(item => POSITIONS.includes(item)))

const lane = computed<Lane | null>({
  get: () => {
    const asked = String(route.query.position ?? '').toUpperCase() as Lane
    return POSITIONS.includes(asked) ? asked : lanes.value[0] ?? null
  },
  set: value => void router.replace({ query: { ...route.query, position: value ?? undefined } }),
})

const entry = computed<TierEntry | null>(() => {
  if (!lane.value) return null
  return entries.value.find(item => item.championId === championId.value && item.position === lane.value) ?? null
})

/**
 * The lane's builds, its counters and its synergies as Blitz ranks them, the
 * player's own kits on it (#2185), the champion's abilities with its insights
 * under them, or a jungler's paths; kept in the URL like the lane.
 */
type View = 'builds' | 'counters' | 'synergies' | 'kits' | 'abilities' | 'jungle'
const VIEWS: View[] = ['builds', 'counters', 'synergies', 'kits', 'abilities', 'jungle']
const view = computed<View>({
  // The insights' old address opens the abilities, where they now are; the jungle paths are a jungler's only.
  get: () => {
    const asked = route.query.view === 'insights' ? 'abilities' : VIEWS.includes(route.query.view as View) ? route.query.view as View : 'builds'
    return asked === 'jungle' && lane.value !== 'JUNGLE' ? 'builds' : asked
  },
  set: value => void router.replace({ query: { ...route.query, view: value === 'builds' ? undefined : value } }),
})
const views = computed(() => [
  { label: t('dash.champion.builds'), value: 'builds', icon: 'i-tabler-list-details' },
  { label: t('counters.tab'), value: 'counters', icon: 'i-tabler-swords' },
  { label: t('synergies.tab'), value: 'synergies', icon: 'i-tabler-users' },
  { label: t('dash.champion.kits'), value: 'kits', icon: 'i-tabler-backpack' },
  { label: t('abilities.tab'), value: 'abilities', icon: 'i-tabler-book-2' },
  ...(lane.value === 'JUNGLE' ? [{ label: t('jungle.tab'), value: 'jungle', icon: 'i-tabler-route' }] : []),
])

// The banner's figures, anchored on the tier list & directory row for the active
// patch so games, win rate, pick rate and ban rate always agree across every view;
// the previous patch from `trend` supplies the patch-over-patch delta.
const { data: trend, pending: trendPending } = useChampionTrend(championId, lane, () => lane.value !== null, requestedElo)

const heroTrend = computed<ChampionTrendPoint[] | null>(() => {
  const raw = trend.value?.points ?? []
  const current = entry.value
  if (!current) return raw.length ? raw : null
  const activePatch = patch.value || raw.at(-1)?.patch || ''
  const canonical: ChampionTrendPoint = {
    patch: activePatch,
    winRate: current.winRate,
    pickRate: current.pickRate,
    banRate: current.banRate,
    games: current.games,
  }
  const index = activePatch ? raw.findIndex(point => normalizePatch(point.patch) === normalizePatch(activePatch)) : -1
  if (index >= 0) return raw.map((point, at) => (at === index ? canonical : point))
  const earlier = raw.filter(point => !activePatch || normalizePatch(point.patch) !== normalizePatch(activePatch))
  return [...earlier, canonical]
})
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- The site's champion banner: the tier list's sample for the lane and the
         lane's figures against the patch before; the app's lane picker stands in
         for the lane icon. -->
    <div class="shrink-0 px-4 pt-4">
      <ChampionHero
        class="on-art"
        :champion-name="nameOf(championId)"
        :champion-icon-url="portraitOf(championId)"
        :champion-id="championId"
        :splash-url="splashOf(championId)"
        :position="lane ?? ''"
        :patch="patch || null"
        :total-games="entry?.games ?? heroTrend?.at(-1)?.games ?? 0"
        :tier="entry?.tier ?? null"
        :trend="heroTrend"
        :trend-loading="trendPending && !entry"
      >
        <template v-if="lanes.length" #lane>
          <RolePicker v-model:position="lane" hide-all />
        </template>
        <template #actions>
          <FavoriteToggle
            :champion="{ championId, position: lane }"
            :champion-label="[nameOf(championId), positionLabel(lane)].filter(Boolean).join(' ')"
          />
        </template>
      </ChampionHero>
    </div>

    <div v-if="lane" class="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <!-- The champion's views as the app's other pages lay theirs: underlined, Blitz's way. -->
      <nav class="flex shrink-0 gap-6 border-b border-default">
        <button
          v-for="tab in views"
          :key="tab.value"
          type="button"
          class="tm-tab flex items-center gap-1.5"
          :data-active="view === tab.value || undefined"
          :aria-pressed="view === tab.value"
          @click="view = tab.value as View"
        >
          <UIcon :name="tab.icon" class="size-4" :class="view === tab.value ? 'text-primary' : ''" />
          {{ tab.label }}
        </button>
      </nav>
      <ChampionCounters v-if="view === 'counters'" :champion-id="championId" :position="lane" class="min-h-0 flex-1" />
      <ChampionSynergies v-else-if="view === 'synergies'" :champion-id="championId" :position="lane" class="min-h-0 flex-1" />
      <KitPanel v-else-if="view === 'kits'" :champion-id="championId" :position="lane" class="min-h-0 flex-1" />
      <ChampionAbilities v-else-if="view === 'abilities'" :champion-id="championId" class="min-h-0 flex-1" />
      <div v-else-if="view === 'jungle'" class="min-h-0 flex-1 overflow-y-auto">
        <!-- The tab names it: the card holds the paths alone. -->
        <JunglePaths :champion-id="championId" bare class="surface rounded-2xl p-4" />
      </div>
      <BuildView v-else :champion-id="championId" :position="lane" class="min-h-0 flex-1">
        <template #advice>
          <BuildDamageSplit :champion-id="championId" :position="lane" />
        </template>
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-semibold text-highlighted">{{ positionLabel(lane, { short: true }) }}</span>
            <div class="flex items-center gap-0.5">
              <UButton
                :to="`/matchup?champion=${championId}&position=${lane}`"
                icon="i-lucide-wand-sparkles"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="t('dash.champion.matchup')"
                :title="t('dash.champion.against')"
              />
            </div>
          </div>
        </template>
      </BuildView>
    </div>
  </div>
</template>
