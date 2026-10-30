<script setup lang="ts">
import type { BuildItemSet, BuildRunePage, BuildSkillOrder, BuildSummonerSpells } from '#shared/types/champions'
import type { ChampionStaticData, RuneTreeResponse, StaticItemData, StaticSummonerSpellData } from '#shared/types/static-data'

/**
 * The core of a build, from the site's own blocks (`Champion/Core/*`), laid out
 * in cards for the app's pane rather than spread by flex as the site's
 * `Champion/BuildPanel/Core` does: the small pieces — summoners, starter, skill
 * order, boots — in one band across the top, the build's item tree in a card of
 * its own below (the `tree` slot), the runes in a card beside both from a 48rem
 * container (stacked under it below that). There is no build path line: the
 * tree draws it, item by item.
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
}>(), { summonersPending: false, noRunesMessage: null, championName: null })
</script>

<template>
  <div class="@container">
    <div class="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_296px] @3xl:items-start">
      <div class="flex min-w-0 flex-col gap-4">
        <!-- The small pieces in one band, spread edge to edge instead of floating apart. -->
        <div class="flex flex-wrap items-start justify-between gap-x-8 gap-y-5 rounded-xl border border-default bg-default/40 p-4">
          <div class="relative">
            <ChampionCoreSpells :summoners="summonerSpells" :summoners-map="summonersMap" :summoners-pending="summonersPending" />
            <!-- A kit's spell import (#2185), in the summoners' corner as the runes' is in theirs. -->
            <div v-if="$slots.spells" class="absolute -right-8 top-6"><slot name="spells" /></div>
          </div>
          <ChampionCoreStarterItems :starter="starterItems" :items-map="itemsMap" />
          <ChampionCoreBoots :boots="boots" :items-map="itemsMap" />
          <ChampionCoreSkillOrder v-if="championStatic" :skill-order="skillOrder" :champion-static="championStatic" />
        </div>

        <!-- The build's item tree: the sequence the items are bought in. -->
        <div v-if="$slots.tree" class="rounded-xl border border-default bg-default/40 p-4">
          <h3 class="stat-label mb-3">{{ t('build.tree.title') }}</h3>
          <slot name="tree" />
        </div>
      </div>

      <div class="relative rounded-xl border border-default bg-default/40 p-3">
        <div class="mx-auto w-full max-w-[272px] overflow-hidden">
          <ChampionCoreRunes v-if="runePage && runeTree" :page="runePage" :tree="runeTree" :size="36" :keystone-size="39" />
          <p v-else-if="!runePage && noRunesMessage" class="text-sm text-muted">{{ noRunesMessage }}</p>
        </div>
        <BuildRuneImport v-if="runePage && runeTree && championName !== null" :page="runePage" :champion="championName" class="absolute right-3 top-3" />
      </div>
    </div>
  </div>
</template>
