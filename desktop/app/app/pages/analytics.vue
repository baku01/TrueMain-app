<script setup lang="ts">
import type { ChampionAnalytics } from '~/utils/sources/analytics'
import { MATCHUP_SOURCES, readAnalytics } from '~/utils/sources/analytics-read'
import { LANES } from '~/utils/site-build'
import { LOLALYTICS_REGIONS } from '~/utils/sources/lolalytics'

/**
 * Analytics: one champion on one lane, detail by detail, from the source
 * Settings picked (`utils/sources/analytics-*`) — its figures, the build with
 * every option measured, items slot by slot, the first levels skill by skill,
 * matchups and allies lane by lane, objectives, game length, the trend and the
 * best players. A section the source does not measure says so. A champion is
 * picked; the page opens on the lane the tier list plays it most.
 */
const { t } = useT()
const { champions, nameOf, portraitOf } = useChampionStatics()
const { items, summoners, runeTree, loadChampion, championStatic } = useStaticData()
const { mainEntryOf } = useTierList()

const SOURCE_NAME: Record<string, string> = { truemain: 'TrueMain', blitz: 'Blitz', opgg: 'op.gg', lolalytics: 'lolalytics', tencent: 'Tencent' }
const source = computed(() => SOURCE_NAME[dataSource.value] ?? dataSource.value)
const ELOS = ['ALL', 'GOLD_PLUS', 'PLATINUM_PLUS', 'EMERALD_PLUS', 'DIAMOND_PLUS', 'MASTER_PLUS'] as const
const LANE_KEYS: Record<string, string> = { TOP: 'probuild.role.top', JUNGLE: 'probuild.role.jungle', MIDDLE: 'probuild.role.middle', BOTTOM: 'probuild.role.bottom', UTILITY: 'probuild.role.utility' }

const query = ref('')
const championId = ref<number | null>(null)
const position = ref<string | null>(null)
const elo = ref<typeof ELOS[number]>('EMERALD_PLUS')
/** lolalytics reads a region; the others read the whole world. */
const region = ref<typeof LOLALYTICS_REGIONS[number]>('all')
const regional = computed(() => dataSource.value === 'lolalytics')
const regions = computed(() => LOLALYTICS_REGIONS.map(value => ({ value, label: value === 'all' ? t('analytics.region.all') : value.toUpperCase() })))
const analytics = shallowRef<ChampionAnalytics | null>(null)
const reading = ref(false)
const failed = ref(false)

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
/** The champions whose names hold every word of `text`, none while it names the one `picked`. */
function matching(text: string, picked: number | null) {
  const words = fold(text).split(/\s+/).filter(Boolean)
  if (words.length === 0 || picked !== null && fold(nameOf(picked)) === fold(text)) return []
  return [...champions.value.keys()].filter(id => words.every(word => fold(nameOf(id)).includes(word))).sort((a, b) => nameOf(a).localeCompare(nameOf(b))).slice(0, 8)
}
const matches = computed(() => matching(query.value, championId.value))

/**
 * The lane opponent, as lolalytics reads a champion against one: the whole
 * page then over that matchup's games only, where the source measures it
 * (`MATCHUP_SOURCES`); picked by name or from the matchups on the lane.
 */
const opponentQuery = ref('')
const opponentId = ref<number | null>(null)
const opponentMatches = computed(() => matching(opponentQuery.value, opponentId.value))
const matchupSource = computed(() => MATCHUP_SOURCES.includes(dataSource.value))
function pickOpponent(id: number | null) {
  opponentId.value = id
  opponentQuery.value = id === null ? '' : nameOf(id)
}

function pick(id: number) {
  championId.value = id
  query.value = nameOf(id)
  position.value = mainEntryOf(id)?.position ?? 'MIDDLE'
  loadChampion(id)
}

let latest = 0
watch([championId, position, elo, region, opponentId], async ([id, lane, bracket, area, opponent]) => {
  if (id === null || !lane) return
  const read = ++latest
  reading.value = true
  failed.value = false
  try {
    const answer = await trackLoad(readAnalytics(id, lane, bracket, regional.value ? area : 'all', opponent))
    if (read !== latest) return
    analytics.value = answer
    failed.value = !answer.header && !answer.options
  }
  catch {
    if (read === latest) failed.value = true
  }
  finally {
    if (read === latest) reading.value = false
  }
})

/** The lanes to offer: the source's, with the share of games on each, or the five when it does not say. */
const lanes = computed(() => (analytics.value?.lanes.length ? analytics.value.lanes : LANES.map(lane => ({ position: lane, share: 0 }))))
const percent = (value: number) => `${Math.round(value * 1000) / 10}%`
const ABILITIES = ['P', 'Q', 'W', 'E', 'R'] as const
const average = computed(() => analytics.value?.header?.winRate ?? null)
const rowsOf = (list: { itemIds: number[], games: number, pickRate: number, winRate: number, minute?: number }[]) => list
const startingTabs = computed(() => [
  { key: 'sets', label: t('analytics.tab.sets'), rows: rowsOf(analytics.value?.startingSets ?? []) },
  { key: 'single', label: t('analytics.tab.single'), rows: rowsOf(analytics.value?.startingItems ?? []) },
].filter(tab => tab.rows.length))
const setTabs = computed(() => (analytics.value?.itemSets ?? []).filter(set => set.options.length).map(set => ({ key: String(set.size), label: t('analytics.tab.itemSet', { size: set.size }), rows: rowsOf(set.options) })))
const listTabs = computed(() => {
  const lists = analytics.value?.itemLists
  return lists ? (['popular', 'winning', 'all'] as const).map(key => ({ key, label: t(`analytics.tab.${key}`), rows: rowsOf(lists[key]) })).filter(tab => tab.rows.length) : []
})
const trendEmpty = computed(() => !analytics.value || Object.values(analytics.value.trend).every(series => series.every(line => line.points.length === 0)))
</script>

<template>
  <SharedPage :eyebrow="t('analytics.eyebrow')" :title="t('analytics.title')">
    <div class="@container mx-auto max-w-[110rem] space-y-4 p-4 md:p-6">
      <PageHeader :eyebrow="t('analytics.eyebrow')" :title="t('analytics.title')" :description="t('analytics.description')" />

      <div class="flex flex-wrap items-center gap-3">
        <div class="relative w-full max-w-sm">
          <UInput v-model="query" icon="i-lucide-search" :placeholder="t('analytics.search')" class="w-full" :aria-label="t('analytics.search')" @update:model-value="championId = null" />
          <ul v-if="matches.length" class="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-default bg-elevated p-1 shadow-lg">
            <li v-for="id in matches" :key="id">
              <button type="button" class="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accented" @click="pick(id)">
                <img v-if="portraitOf(id)" :src="portraitOf(id)!" alt="" width="28" height="28" class="img-skeleton size-7 rounded">
                <span class="text-sm text-default">{{ nameOf(id) }}</span>
              </button>
            </li>
          </ul>
        </div>
        <!-- Against one lane opponent: the page over that matchup's games. -->
        <div v-if="championId !== null" class="relative w-full max-w-xs">
          <UInput v-model="opponentQuery" icon="i-lucide-swords" :placeholder="t('analytics.versus.search')" class="w-full" :aria-label="t('analytics.versus.search')" @update:model-value="opponentId = null">
            <template v-if="opponentQuery" #trailing>
              <UButton icon="i-lucide-x" size="xs" color="neutral" variant="link" :aria-label="t('analytics.versus.clear')" @click="pickOpponent(null)" />
            </template>
          </UInput>
          <ul v-if="opponentMatches.length" class="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-default bg-elevated p-1 shadow-lg">
            <li v-for="id in opponentMatches" :key="id">
              <button type="button" class="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accented" @click="pickOpponent(id)">
                <img v-if="portraitOf(id)" :src="portraitOf(id)!" alt="" width="28" height="28" class="img-skeleton size-7 rounded">
                <span class="text-sm text-default">{{ nameOf(id) }}</span>
              </button>
            </li>
          </ul>
        </div>
        <USelect v-model="elo" :items="ELOS.map(value => ({ value, label: t(`analytics.elo.${value}`) }))" size="sm" class="w-40" :aria-label="t('analytics.elo')" />
        <!-- lolalytics reads a matchup over every server: its page takes no region. -->
        <USelect v-if="regional && opponentId === null" v-model="region" :items="regions" size="sm" class="w-40" :aria-label="t('analytics.region')" />
        <UBadge :label="t('analytics.source', { source })" color="neutral" variant="subtle" class="ml-auto" />
      </div>

      <p v-if="championId === null" class="surface rounded-xl px-4 py-10 text-center text-sm text-muted">{{ t('analytics.pick') }}</p>

      <template v-else>
        <header class="flex flex-wrap items-center gap-4 surface rounded-2xl bg-gradient-to-br from-primary/10 via-[var(--tm-pane)] to-[var(--tm-pane)] p-4">
          <img v-if="portraitOf(championId)" :src="portraitOf(championId)!" alt="" width="56" height="56" class="img-skeleton size-14 rounded-xl ring-1 ring-default">
          <div class="min-w-0">
            <h2 class="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-highlighted">
              {{ nameOf(championId) }}
              <span v-if="analytics?.versus" class="flex items-center gap-1.5 text-base font-medium text-muted">
                {{ t('analytics.versus.label') }}
                <img v-if="portraitOf(analytics.versus)" :src="portraitOf(analytics.versus)!" alt="" width="24" height="24" class="img-skeleton size-6 rounded">
                <span class="text-highlighted">{{ nameOf(analytics.versus) }}</span>
              </span>
            </h2>
            <p v-if="analytics?.patch" class="text-xs text-muted">Patch {{ analytics.patch }}</p>
            <div v-if="championStatic(championId)" class="mt-1.5 flex gap-1">
              <span v-for="key in ABILITIES" :key="key" class="relative size-7">
                <GameTooltipChampionSpellIcon :spell="championStatic(championId)?.championSpells[key] ?? null" :width="28" :height="28" class="size-7 rounded" /><ItemRankBadge :value="key" />
              </span>
            </div>
          </div>
          <div class="ml-auto flex flex-wrap gap-1.5" role="group">
            <UButton
              v-for="lane in lanes"
              :key="lane.position"
              :label="lane.share ? `${t(LANE_KEYS[lane.position] ?? lane.position)} · ${percent(lane.share)}` : t(LANE_KEYS[lane.position] ?? lane.position)"
              size="xs"
              :color="position === lane.position ? 'primary' : 'neutral'"
              :variant="position === lane.position ? 'soft' : 'ghost'"
              @click="position = lane.position"
            />
          </div>
        </header>

        <div v-if="reading && !analytics" aria-busy="true" class="space-y-3"><USkeleton class="h-24 w-full" /><USkeleton class="h-96 w-full" /></div>
        <p v-else-if="failed" class="surface rounded-xl px-4 py-10 text-center text-sm text-muted">{{ opponentId !== null && matchupSource ? t('analytics.versus.none', { source }) : t('analytics.failed') }}</p>

        <template v-else-if="analytics">
          <!-- An opponent the source cannot read against: the lane's figures, said so. -->
          <p v-if="opponentId !== null && analytics.versus === null" class="flex items-center gap-2 rounded-xl bg-accented/30 px-4 py-2.5 text-sm text-muted">
            <UIcon name="i-lucide-info" class="size-4 shrink-0" />{{ t('analytics.versus.unsupported', { source }) }}
          </p>
          <AnalyticsHeader v-if="analytics.header" :header="analytics.header" :damage="analytics.damage" :versus="analytics.versus !== null" />
          <AnalyticsSummaryLine :analytics="analytics" :champion-name="nameOf(championId)" :lane="t(LANE_KEYS[position ?? ''] ?? position ?? '')" />

          <AnalyticsSummaryBuild
            v-if="analytics.summary.common || analytics.summary.winning"
            :summary="analytics.summary"
            :champion-static="championStatic(championId)"
            :champion-id="championId"
            :items="items"
            :summoners="summoners"
            :rune-tree="runeTree"
          />
          <AnalyticsSection v-else :title="t('analytics.section.build')" empty :source="source" />

          <!-- A jungler's paths, op.gg's (the only source that measures them). -->
          <AnalyticsSection v-if="championId && position === 'JUNGLE'" :title="t('jungle.tab')" :empty="false" source="op.gg">
            <JunglePaths :champion-id="championId" bare />
          </AnalyticsSection>

          <AnalyticsSection :title="t('analytics.section.trend')" :empty="trendEmpty" :source="source">
            <AnalyticsTrend :trend="analytics.trend" />
          </AnalyticsSection>

          <div class="grid gap-4 @6xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div class="min-w-0 space-y-4">
              <AnalyticsSection :title="t('analytics.section.matchups')" :empty="!analytics.matchups.some(lane => lane.rows.length)" :source="source">
                <AnalyticsLaneRows :lanes="analytics.matchups" kind="counter" :pickable="matchupSource ? position : null" @pick="pickOpponent" />
              </AnalyticsSection>
              <AnalyticsSection :title="t('analytics.section.synergyTeam')" :empty="!analytics.synergies.length" :source="source">
                <AnalyticsLaneRows :lanes="analytics.synergies" kind="synergy" />
              </AnalyticsSection>
              <div class="grid gap-4 @4xl:grid-cols-2">
                <AnalyticsSection :title="t('analytics.section.spells')" :empty="!analytics.spellTable.length" :source="source">
                  <AnalyticsItemTable :tabs="[{ key: 'spells', label: '', rows: analytics.spellTable }]" :summoners="summoners" :average="average" :limit="6" />
                </AnalyticsSection>
                <AnalyticsSection :title="t('analytics.section.starting')" :empty="!startingTabs.length" :source="source">
                  <AnalyticsItemTable :tabs="startingTabs" :items="items" :average="average" :limit="6" />
                </AnalyticsSection>
                <AnalyticsSection :title="t('analytics.section.early')" :empty="!analytics.earlyItems.length" :source="source">
                  <AnalyticsItemTable :tabs="[{ key: 'early', label: '', rows: rowsOf(analytics.earlyItems) }]" :items="items" :average="average" :limit="8" />
                </AnalyticsSection>
                <AnalyticsSection :title="t('analytics.section.itemSets')" :empty="!setTabs.length" :source="source">
                  <AnalyticsItemTable :tabs="setTabs" :items="items" :average="average" :limit="8" />
                </AnalyticsSection>
              </div>
              <AnalyticsSection :title="t('analytics.section.itemLists')" :empty="!listTabs.length" :source="source">
                <AnalyticsItemTable :tabs="listTabs" :items="items" :average="average" :limit="15" />
              </AnalyticsSection>
              <AnalyticsSection :title="t('analytics.section.items')" :empty="!analytics.itemSlots.length" :source="source">
                <AnalyticsItemSlots :slots="analytics.itemSlots" :items="items" />
              </AnalyticsSection>
              <AnalyticsSection :title="t('analytics.section.skills')" :empty="!analytics.skillPaths.priority.length && !analytics.skillLevels.length" :source="source">
                <div class="@container"><AnalyticsSkillPaths :paths="analytics.skillPaths" :levels="analytics.skillLevels" :champion-static="championStatic(championId)" /></div>
              </AnalyticsSection>
              <AnalyticsSection :title="t('analytics.section.runes')" :empty="!analytics.runeStats.size || !runeTree" :source="source">
                <AnalyticsRunesTable v-if="runeTree" :stats="analytics.runeStats" :tree="runeTree" />
              </AnalyticsSection>
            </div>
            <div class="min-w-0 space-y-4">
              <AnalyticsSection :title="t('analytics.section.objectives')" :empty="!analytics.objectives.length" :source="source">
                <AnalyticsObjectives :objectives="analytics.objectives" />
              </AnalyticsSection>
              <AnalyticsSection :title="t('analytics.section.playerBase')" :empty="!analytics.playerBase" :source="source">
                <AnalyticsPlayerBase v-if="analytics.playerBase" :base="analytics.playerBase" />
              </AnalyticsSection>
              <AnalyticsSection :title="t('analytics.section.gameLength')" :empty="!analytics.gameLength.length" :source="source">
                <AnalyticsGameLength :bands="analytics.gameLength" />
              </AnalyticsSection>
              <AnalyticsSection :title="t('analytics.section.players')" :empty="!analytics.topPlayers.length" :source="source">
                <div class="@container"><AnalyticsPlayers :players="analytics.topPlayers" /></div>
              </AnalyticsSection>
              <AnalyticsSection :title="t('analytics.section.stats')" :empty="!analytics.stats.length" :source="source">
                <AnalyticsStats :stats="analytics.stats" />
              </AnalyticsSection>
            </div>
          </div>
        </template>
      </template>
    </div>
  </SharedPage>
</template>
