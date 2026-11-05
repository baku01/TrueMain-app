<script setup lang="ts">
import type { BuildItemPath, BuildItemSet, BuildRunePage, BuildSkillOrder, BuildSummonerSpells } from '#shared/types/champions'
import { formatCount } from '#shared/utils/counts'
import { formatPercentage } from '#shared/utils/ddragon'
import type { ChampionStaticData, RuneTreeResponse, StaticItemData, StaticSummonerSpellData } from '#shared/types/static-data'

/**
 * The core of a build, from the site's own blocks (`Champion/Core/*`), laid out
 * in cards for the app's pane rather than spread by flex as the site's
 * `Champion/BuildPanel/Core` does. From a 48rem container, two columns: on the
 * left the runes, large, with the small pieces — summoners, starter, boots —
 * in a card under them; on the right the build's item tree (the `tree` slot),
 * its tree from the top of a card as tall as the left column; the skill order,
 * with its level-by-level grid, across the bottom (`BuildSkillGrid`). Narrower, the same cards stack, the tree first. There is no
 * build path line: the tree draws it, item by item.
 *
 * The runes carry the import button in their corner (#1678).
 */
const { t } = useT()

withDefaults(defineProps<{
  summonerSpells: BuildSummonerSpells | null
  starterItems: BuildItemSet | null
  skillOrder: BuildSkillOrder | null
  boots: BuildItemSet | null
  runePage: BuildRunePage | null
  /** Null while the champion's spells are loading; the skill order waits for them, as on the site. */
  championStatic: ChampionStaticData | null
  itemsMap: Record<number, StaticItemData>
  summonersMap: Record<number, StaticSummonerSpellData>
  summonersPending?: boolean
  runeTree: RuneTreeResponse | null
  /** Said in the runes column when the sample carried no rune page. */
  noRunesMessage?: string | null
  /** Names the page the import button pushes into the client; no button without it. */
  championName?: string | null
  /** The champion, for the abilities' clips under the pointer (`AbilityHover`). */
  championId?: number | null
  /**
   * Champion select's layout, as Blitz lays a build there: the runes on the
   * left; on the right the spells and starter side by side, the core build
   * path as one row, the boots and the situational items, the max order — the
   * item set import in that column's header (`itemImport` slot). No tree.
   */
  compact?: boolean
  /** The core build path, for the compact layout. */
  itemPath?: BuildItemPath | null
  /** The situational items, for the compact layout. */
  situational?: number[]
}>(), { summonersPending: false, noRunesMessage: null, championName: null, championId: null, compact: false, itemPath: null, situational: () => [] })
</script>

<template>
  <div v-if="compact" class="@container">
    <div class="grid gap-4 @3xl:grid-cols-2">
      <!-- The runes, whole. -->
      <div class="surface flex flex-col rounded-xl p-4">
        <div class="mb-3 flex items-center gap-3">
          <h3 class="text-sm font-semibold text-highlighted">{{ t('build.compact.runes') }}</h3>
          <span v-if="runePage && runePage.games > 0" class="text-xs text-muted">{{ formatPercentage(runePage.winRate, 1) }} · {{ t('build.skillGrid.games', { games: formatCount(runePage.games) }) }}</span>
          <BuildRuneImport v-if="runePage && runeTree && championName !== null" :page="runePage" :champion="championName" labeled class="ml-auto" />
        </div>
        <div class="flex w-full flex-1 items-center justify-center overflow-hidden">
          <ChampionCoreRunes v-if="runePage && runeTree" :page="runePage" :tree="runeTree" :size="48" :keystone-size="60" />
          <p v-else-if="!runePage && noRunesMessage" class="text-sm text-muted">{{ noRunesMessage }}</p>
        </div>
      </div>

      <!-- Spells and the build, top to bottom, each one row. -->
      <div class="surface flex flex-col gap-4 rounded-xl p-4">
        <div class="flex items-center gap-3">
          <h3 class="text-sm font-semibold text-highlighted">{{ t('build.compact.spellsBuilds') }}</h3>
          <span class="ml-auto"><slot name="itemImport" /></span>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <ChampionCoreSpells :summoners="summonerSpells" :summoners-map="summonersMap" :summoners-pending="summonersPending" />
          <ChampionCoreStarterItems :starter="starterItems" :items-map="itemsMap" />
        </div>
        <ChampionCoreBuildPath :path="itemPath" :items-map="itemsMap" />
        <div class="grid grid-cols-2 gap-4">
          <ChampionCoreBoots :boots="boots" :items-map="itemsMap" />
          <div v-if="situational.length" class="flex flex-col gap-2">
            <h2 class="text-sm font-medium text-muted">{{ t('build.compact.situational') }}</h2>
            <div class="flex flex-wrap gap-1">
              <GameTooltipItemIcon v-for="id in situational.slice(0, 6)" :key="id" :item="itemsMap[id] ?? null" :width="32" :height="32" class="rounded-md" />
            </div>
          </div>
        </div>
        <BuildSkillGrid v-if="championStatic" :skill-order="skillOrder" :champion-static="championStatic" :champion-id="championId ?? null" priority-only />
      </div>
    </div>
  </div>

  <div v-else class="@container">
    <div class="grid gap-4 @3xl:grid-cols-[20rem_minmax(0,1fr)] @5xl:grid-cols-[24rem_minmax(0,1fr)]">
      <!-- The runes, large — the part of a build most worth reading at a glance — and under them the small pieces. -->
      <div class="flex flex-col gap-4">
        <div class="relative surface rounded-xl p-4">
          <div class="mx-auto w-full max-w-[22rem] overflow-hidden">
            <ChampionCoreRunes v-if="runePage && runeTree" :page="runePage" :tree="runeTree" :size="40" :keystone-size="48" />
            <p v-else-if="!runePage && noRunesMessage" class="text-sm text-muted">{{ noRunesMessage }}</p>
          </div>
          <BuildRuneImport v-if="runePage && runeTree && championName !== null" :page="runePage" :champion="championName" class="absolute right-3 top-3" />
        </div>

        <div class="grid flex-1 content-start gap-x-6 gap-y-5 surface rounded-xl p-4 sm:grid-cols-2">
          <div class="relative">
            <ChampionCoreSpells :summoners="summonerSpells" :summoners-map="summonersMap" :summoners-pending="summonersPending" />
            <!-- A kit's spell import (#2185), in the summoners' corner as the runes' is in theirs. -->
            <div v-if="$slots.spells" class="absolute -right-8 top-6"><slot name="spells" /></div>
          </div>
          <ChampionCoreBoots :boots="boots" :items-map="itemsMap" />
          <div class="sm:col-span-2">
            <ChampionCoreStarterItems :starter="starterItems" :items-map="itemsMap" />
          </div>
        </div>
      </div>

      <!-- The build's item tree: the sequence the items are bought in, centred in a card as tall as the column beside it. -->
      <div v-if="$slots.tree" class="order-first flex flex-col surface rounded-xl p-4 @3xl:order-none">
        <h3 class="stat-label mb-3">{{ t('build.tree.title') }}</h3>
        <div class="flex flex-1 items-start justify-center">
          <div class="w-full"><slot name="tree" /></div>
        </div>
      </div>
    </div>

    <!-- The skill order across the bottom: the priority and, beside it, the level-by-level grid. -->
    <div v-if="championStatic" class="mt-4 surface rounded-xl p-4">
      <BuildSkillGrid :skill-order="skillOrder" :champion-static="championStatic" :champion-id="championId ?? null" />
    </div>
  </div>
</template>
