<script setup lang="ts">
import { championDisplayName } from '#shared/utils/champion-name'
// The desktop app's tier list, laid out as Blitz lays its own: a row per tier,
// the tier's medal on a column tinted in its metal, and beside it every
// champion as a cell — portrait ringed in the metal, lane in the corner, name,
// win rate and pick rate. The data is the shared page's (`web/layers/common`),
// the layout the app's; a component of the app wins over the layer's.
import type { ChampionTierListResponse } from '#shared/types/champions'
import { isChampionPosition, type ChampionPosition } from '#common/utils/positions'
import { formatPercentage, getPositionIconUrl } from '#shared/utils/ddragon'
import { winRateTone } from '#common/utils/rate-tone'
import { isLoadingStatus } from '#common/utils/async-data'
import { describeStaleFetchError } from '#common/utils/errors'

const { t } = useT()

const { pathFor } = useChampionSlugs()

const { filters } = useChampionFilters()

// null = "All positions" — same RolePicker contract as the /champions filter.
const selectedPosition = computed<ChampionPosition | null>(() => {
  const value = filters.value.position ?? ''
  return isChampionPosition(value) ? value : null
})

// Tier list is computed server-side, so the fetch keys on patch + position +
// elo bracket and the backend does the per-role tiering. Client-only
// (`server: false`) to keep the SSR shell deterministic, mirroring the
// /champions directory page.
const apiFetch = useApiFetch()
const tierListFetch = useAsyncData<ChampionTierListResponse>(
  () => `champion-tierlist-${filters.value.patch ?? 'latest'}-${selectedPosition.value ?? 'all'}`
    + `-${filters.value.eloBracket ?? 'all'}-${filters.value.truemainsOnly ? 'truemains' : 'everyone'}`,
  (_nuxtApp, { signal }) => {
    const query: Record<string, string> = {}
    if (filters.value.patch) query.patch = filters.value.patch
    if (selectedPosition.value) query.position = selectedPosition.value
    if (filters.value.eloBracket) query.eloBracket = filters.value.eloBracket
    // Sent only when off: true is the API default, so pinning it would just make
    // every resting request carry a redundant param.
    if (!filters.value.truemainsOnly) query.truemainsOnly = 'false'
    return apiFetch<ChampionTierListResponse>('/champions/tierlist', { query, signal })
  },
  {
    watch: [
      () => filters.value.patch,
      selectedPosition,
      () => filters.value.eloBracket,
      () => filters.value.truemainsOnly,
    ],
    server: false,
    default: () => ({ patchVersion: '', position: null, tiers: [] }),
  },
)
const { status: tierListStatus, refresh: refreshTierList } = tierListFetch
// A failed filter click keeps the previous tiers on screen and answers with a
// toast (#1668); only a failed first load is the inline alert.
const actionToast = useActionToast()
const { data: tierList, error: tierListError, staleError: tierListStaleError } = useRefetchFallback(tierListFetch, {
  onStaleFailure: failure => actionToast.failure(t('pages.tierlist.updateFailed'), describeStaleFetchError(failure)),
})

// Static champion list (names + icons) — shared composable so navigating between
// /champions and the tier list pays the fetch once (same key + options).
const {
  data: staticList,
  error: staticError,
  status: staticStatus,
} = useChampionStaticList()

const apiPatch = computed(() => tierList.value?.patchVersion ?? '')
const selectedPatch = computed(() => filters.value.patch || apiPatch.value || '')

const error = computed(() => tierListError.value ?? staticError.value)
const isPending = computed(() =>
  isLoadingStatus(tierListStatus.value) || isLoadingStatus(staticStatus.value),
)

// Same `?championId=` search as the /champions directory: it narrows the tiers
// to that champion's lines instead of refetching.
const filterChampionId = useRouteQueryChampionId()

const nameById = useChampionsById(staticList)

// Flatten the tier groups into rows decorated with name + icon, carrying the
// tier letter so the template can render one badge per group and the row data.
const tierGroups = computed(() =>
  (tierList.value?.tiers ?? [])
    .map(group => ({
      tier: group.tier,
      entries: group.entries
        .filter(entry => filterChampionId.value === null || entry.championId === filterChampionId.value)
        .map((entry) => {
          const meta = nameById.value.get(entry.championId)
          return {
            ...entry,
            name: championDisplayName(entry.championId, meta),
            iconUrl: meta?.iconUrl ?? '',
          }
        }),
    }))
    .filter(group => group.entries.length > 0),
)

const hasRows = computed(() => tierGroups.value.some(group => group.entries.length > 0))

// Each chip links to the champion page, pinned to the current patch + the row's
// own position — same destination shape as the /champions directory rows.
function championDestination(entry: { championId: number, position: string }) {
  return {
    path: pathFor(entry.championId),
    query: {
      ...(selectedPatch.value ? { patch: selectedPatch.value } : {}),
      ...(entry.position ? { position: entry.position } : {}),
    },
  }
}

/** Each tier's metal, as its medal (`TierBadge`) wears it. */
const METAL: Record<string, string> = { S: '#3b7cf0', A: '#d4a032', B: '#a3adbb', C: '#b06a30', D: '#6a646c' }
const metalOf = (tier: string) => METAL[tier.toUpperCase().charAt(0)] ?? METAL.D!

// A client-side navigation keeps the outgoing page under the loading bar until
// the tier list is in (#1689); the static lookups keep their skeleton.
await tierListFetch
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
    <PageHeader :title="t('pages.tierlist.title')" :suffix="apiPatch ? `· Patch ${apiPatch}` : undefined" :description="t('pages.tierlist.description')">
      <ChampionListFilters :champions="staticList ?? []" :api-patch="apiPatch" />
    </PageHeader>

    <ClientOnly>
      <FetchErrorAlert v-if="error" :error="error" :title="t('pages.tierlist.loadFailed')" />
      <TierlistSkeleton v-else-if="isPending" />

      <template v-else>
        <StaleContentNotice :error="tierListStaleError" :subject="t('pages.tierlist.previousTiers')" :on-retry="() => refreshTierList()" />

        <div class="space-y-3">
          <section
            v-for="group in tierGroups"
            :key="group.tier"
            class="tier-row grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2"
            :style="{ '--metal': metalOf(group.tier) }"
          >
            <!-- The tier: its medal on a column washed in its metal, the count under it. -->
            <div class="tier-side flex flex-col items-center gap-2 rounded-xl px-2 pt-5">
              <TierBadge :tier="group.tier" :size="48" />
              <span class="text-[11px] tabular-nums text-muted">{{ group.entries.length }}</span>
            </div>

            <ul class="tier-body grid content-start gap-1 rounded-xl p-2 [grid-template-columns:repeat(auto-fill,minmax(9.75rem,1fr))]">
              <li v-for="entry in group.entries" :key="`${entry.championId}-${entry.position}`">
                <NuxtLink
                  :to="championDestination(entry)"
                  class="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
                  :title="`${entry.name} · ${t('champion.pickRate')} ${formatPercentage(entry.pickRate, 1)}`"
                >
                  <span class="relative shrink-0">
                    <img :src="entry.iconUrl" :alt="entry.name" width="40" height="40" loading="lazy" class="tier-portrait img-skeleton size-10 rounded-lg">
                    <img v-if="entry.position" :src="getPositionIconUrl(entry.position)" alt="" width="14" height="14" class="absolute -bottom-1 -right-1 size-4 rounded bg-default p-0.5">
                  </span>
                  <span class="min-w-0 leading-tight">
                    <span class="block truncate text-[13px] font-medium text-highlighted group-hover:text-primary">{{ entry.name }}</span>
                    <span class="block text-[11px] font-semibold tabular-nums" :class="winRateTone(entry.winRate)">{{ formatPercentage(entry.winRate, 1) }}</span>
                  </span>
                </NuxtLink>
              </li>
            </ul>
          </section>
        </div>

        <p v-if="!hasRows" class="text-sm text-muted">{{ t('pages.noChampionsMatch') }}</p>
      </template>

      <template #fallback>
        <TierlistSkeleton />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
/* The tier's metal, faint: a wash down its column and along its body, a thin ring on each portrait. */
.tier-side {
  background: linear-gradient(180deg, color-mix(in oklch, var(--metal) 26%, var(--tm-pane)), color-mix(in oklch, var(--metal) 8%, var(--tm-pane)));
}
.tier-body {
  background: linear-gradient(90deg, color-mix(in oklch, var(--metal) 7%, var(--tm-pane)), var(--tm-pane) 40%);
}
.tier-portrait {
  box-shadow: 0 0 0 1.5px color-mix(in oklch, var(--metal) 70%, transparent);
}
</style>
