<script setup lang="ts">
import { formatPercentage } from '#shared/utils/ddragon'
import type { ChampionBuildResponse } from '~/types/build'
import type { ChampionStats, Tally } from '~/utils/high-elo'
import { POSITION_BY_CODE, THIN_SAMPLE, winRate } from '~/utils/high-elo'
import { kitItemGroups } from '~/utils/kit-items'
import { mostPlayedLane, statsFromSite } from '~/utils/site-build'

/**
 * ProBuild: what truemain.lol measured for a champion — how often each
 * keystone, rune page, item and pair of spells was taken, and how often the
 * game was won (`useProBuilds`, `utils/site-build.ts`). A champion is picked;
 * the page opens on its most played lane, and the lanes narrow it.
 */
const { t } = useT()
const { champions, nameOf, portraitOf } = useChampionStatics()
const { items, summoners, runeTree } = useStaticData()
const { lanes: readLanes } = useProBuilds()
const blitz = fromBlitz()

const query = ref('')
const championId = ref<number | null>(null)
const position = ref<string | null>(null)
const result = ref<ChampionStats | null>(null)
const reading = ref(false)
const answers = ref<Record<string, ChampionBuildResponse>>({})

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const matches = computed(() => {
  const words = fold(query.value).split(/\s+/).filter(Boolean)
  if (words.length === 0 || championId.value !== null && fold(nameOf(championId.value)) === fold(query.value)) return []
  return [...champions.value.keys()].filter(id => words.every(word => fold(nameOf(id)).includes(word))).sort((a, b) => nameOf(a).localeCompare(nameOf(b))).slice(0, 8)
})

function pick(id: number) {
  championId.value = id
  query.value = nameOf(id)
  position.value = null
}

async function read() {
  if (championId.value === null) return
  const id = championId.value
  reading.value = true
  try {
    const read = await readLanes(id)
    if (id !== championId.value) return
    answers.value = read
    // Opened on the lane most played, until another is chosen.
    position.value ??= mostPlayedLane(read)
    result.value = statsFromSite(id, read, position.value ?? '')
  }
  finally {
    reading.value = false
  }
}

watch(championId, () => {
  result.value = null
  void read()
})
watch(position, (lane) => {
  if (championId.value !== null && lane) result.value = statsFromSite(championId.value, answers.value, lane)
})

const groups = computed(() => kitItemGroups(items.value))
const total = computed(() => result.value?.games ?? 0)
const thin = computed(() => total.value > 0 && total.value < THIN_SAMPLE)
const pickRate = (tally: Tally) => (total.value > 0 ? tally.games / total.value : 0)

/** Items the build is made of: the legendaries and the boots, the ones worth reading, each seen often enough to mean something. */
const mainItems = computed(() => (result.value?.items ?? []).filter(tally => groups.value.get(tally.id) === 'legendary' && tally.games >= Math.max(2, total.value * 0.03)).slice(0, 12))
const boots = computed(() => (result.value?.items ?? []).filter(tally => groups.value.get(tally.id) === 'boots' && tally.games >= 2).slice(0, 4))
const keystones = computed(() => (result.value?.keystones ?? []).slice(0, 5))
const lanes = computed(() => (result.value?.positions ?? []).filter(tally => POSITION_BY_CODE[tally.id]))
const LANE_KEYS: Record<string, string> = { TOP: 'probuild.role.top', JUNGLE: 'probuild.role.jungle', MIDDLE: 'probuild.role.middle', BOTTOM: 'probuild.role.bottom', UTILITY: 'probuild.role.utility' }
const percent = (value: number) => formatPercentage(value, 1)
const tone = (value: number) => (value >= 0.52 ? 'text-primary' : value < 0.48 ? 'text-muted' : 'text-default')
</script>

<template>
  <SharedPage :eyebrow="t('probuild.eyebrow')" :title="t('probuild.title')">
    <div class="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <PageHeader :eyebrow="t('probuild.eyebrow')" :title="t('probuild.title')" :description="t('probuild.description')" />

      <section class="space-y-5">
        <div class="relative max-w-md">
          <UInput v-model="query" icon="i-lucide-search" :placeholder="t('probuild.champion.search')" class="w-full" :aria-label="t('probuild.champion.search')" @update:model-value="championId = null" />
          <ul v-if="matches.length" class="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-default bg-elevated p-1 shadow-lg">
            <li v-for="id in matches" :key="id">
              <button type="button" class="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accented" @click="pick(id)">
                <img v-if="portraitOf(id)" :src="portraitOf(id)!" alt="" width="28" height="28" class="img-skeleton size-7 rounded">
                <span class="text-sm text-default">{{ nameOf(id) }}</span>
              </button>
            </li>
          </ul>
        </div>

        <p v-if="championId === null" class="rounded-xl border border-dashed border-default px-4 py-10 text-center text-sm text-muted">{{ t('probuild.champion.pick') }}</p>

        <template v-else-if="result">
          <header class="flex flex-wrap items-center gap-4 rounded-xl border border-default bg-gradient-to-br from-primary/10 via-elevated to-elevated p-4">
            <img v-if="portraitOf(championId)" :src="portraitOf(championId)!" alt="" width="56" height="56" class="img-skeleton size-14 rounded-xl ring-1 ring-default">
            <div class="min-w-0">
              <h2 class="text-xl font-semibold tracking-tight text-highlighted">{{ nameOf(championId) }}</h2>
              <p class="text-sm text-muted">{{ t('probuild.summary', { games: result.games, rate: percent(winRate(result)), patch: result.patch || '—' }) }}</p>
            </div>
          </header>

          <p v-if="result.games === 0" class="rounded-xl border border-dashed border-default px-4 py-10 text-center text-sm text-muted">{{ t('probuild.none') }}</p>

          <template v-else>
            <p v-if="thin" class="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-default">
              <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0" />{{ t('probuild.thin', { min: THIN_SAMPLE }) }}
            </p>

            <div v-if="lanes.length" class="flex flex-wrap items-center gap-1.5" role="group" :aria-label="t('probuild.roles')">
              <UButton
                v-for="lane in lanes"
                :key="lane.id"
                :label="`${t(LANE_KEYS[POSITION_BY_CODE[lane.id]!]!)} · ${lane.games}`"
                size="xs"
                :color="position === POSITION_BY_CODE[lane.id] ? 'primary' : 'neutral'"
                :variant="position === POSITION_BY_CODE[lane.id] ? 'soft' : 'ghost'"
                @click="position = POSITION_BY_CODE[lane.id]!"
              />
            </div>

            <section class="space-y-3 rounded-xl border border-default bg-default/40 p-4">
              <h3 class="stat-label">{{ t('probuild.keystones') }}</h3>
              <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <li v-for="tally in keystones" :key="tally.id" class="flex items-center gap-3 rounded-lg border border-default px-3 py-2">
                  <GameTooltipPerkIcon :perk="runeTree?.perks[tally.id] ?? null" :width="40" :height="40" class="size-10 rounded-full" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium text-highlighted">{{ runeTree?.perks[tally.id]?.name ?? tally.id }}</span>
                    <span class="block text-xs text-muted tabular-nums">{{ t('probuild.picked', { rate: percent(pickRate(tally)), games: tally.games }) }}</span>
                  </span>
                  <span class="text-sm font-semibold tabular-nums" :class="tone(winRate(tally))">{{ percent(winRate(tally)) }}</span>
                </li>
              </ul>

              <h3 class="stat-label pt-2">{{ t('probuild.pages') }}</h3>
              <ul class="space-y-2">
                <li v-for="page in result.pages.slice(0, 3)" :key="page.runes.join('-')" class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-default px-3 py-2">
                  <div class="flex items-center gap-1.5">
                    <GameTooltipPerkIcon v-for="(id, index) in page.runes" :key="id" :perk="runeTree?.perks[id] ?? null" :width="index === 0 ? 40 : 30" :height="index === 0 ? 40 : 30" :class="index === 0 ? 'size-10 rounded-full' : 'size-[30px] rounded-full'" />
                  </div>
                  <span class="ml-auto text-xs text-muted tabular-nums">{{ t('probuild.picked', { rate: percent(page.games / total), games: page.games }) }}</span>
                  <span class="text-sm font-semibold tabular-nums" :class="tone(winRate(page))">{{ percent(winRate(page)) }}</span>
                </li>
              </ul>
            </section>

            <section class="space-y-3 rounded-xl border border-default bg-default/40 p-4">
              <h3 class="stat-label">{{ t('probuild.items') }}</h3>
              <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <li v-for="tally in mainItems" :key="tally.id" class="flex items-center gap-3 rounded-lg border border-default px-3 py-2">
                  <GameTooltipItemIcon :item="items[tally.id] ?? null" :width="36" :height="36" class="size-9 rounded" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium text-highlighted">{{ items[tally.id]?.name ?? tally.id }}</span>
                    <span class="block text-xs text-muted tabular-nums">{{ t('probuild.picked', { rate: percent(pickRate(tally)), games: tally.games }) }}</span>
                  </span>
                  <span class="text-sm font-semibold tabular-nums" :class="tone(winRate(tally))">{{ percent(winRate(tally)) }}</span>
                </li>
              </ul>
              <template v-if="boots.length">
                <h3 class="stat-label pt-2">{{ t('probuild.boots') }}</h3>
                <ul class="flex flex-wrap gap-2">
                  <li v-for="tally in boots" :key="tally.id" class="flex items-center gap-2.5 rounded-lg border border-default px-3 py-2">
                    <GameTooltipItemIcon :item="items[tally.id] ?? null" :width="32" :height="32" class="size-8 rounded" />
                    <span class="text-xs text-muted tabular-nums">{{ percent(pickRate(tally)) }}</span>
                    <span class="text-sm font-semibold tabular-nums" :class="tone(winRate(tally))">{{ percent(winRate(tally)) }}</span>
                  </li>
                </ul>
              </template>
            </section>

            <section class="space-y-3 rounded-xl border border-default bg-default/40 p-4">
              <h3 class="stat-label">{{ t('probuild.spells') }}</h3>
              <ul class="flex flex-wrap gap-2">
                <li v-for="pair in result.spells.slice(0, 4)" :key="pair.spells.join('-')" class="flex items-center gap-3 rounded-lg border border-default px-3 py-2">
                  <span class="flex gap-1.5"><GameTooltipSummonerSpellIcon v-for="id in pair.spells" :key="id" :spell="summoners[id] ?? null" :width="32" :height="32" class="size-8 rounded" /></span>
                  <span class="text-xs text-muted tabular-nums">{{ percent(pair.games / total) }}</span>
                  <span class="text-sm font-semibold tabular-nums" :class="tone(winRate(pair))">{{ percent(winRate(pair)) }}</span>
                </li>
              </ul>
            </section>
          </template>
        </template>
        <div v-else-if="reading" aria-busy="true" class="space-y-3"><USkeleton class="h-24 w-full" /><USkeleton class="h-40 w-full" /></div>
      </section>

      <!-- The best players on the champion: Blitz's pros with their games, every other source's ranked players. -->
      <ProbuildProMatches v-if="blitz && championId !== null" :champion-id="championId" :position="position" />
      <ProbuildTopPlayers v-else-if="championId !== null" :champion-id="championId" :position="position" />
    </div>
  </SharedPage>
</template>
