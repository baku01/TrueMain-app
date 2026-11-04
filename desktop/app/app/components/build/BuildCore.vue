<script setup lang="ts">
import type { BuildItemSet, BuildRunePage, BuildSkillOrder, BuildSummonerSpells } from '#shared/types/champions'
import type { ChampionStaticData, RuneTreeResponse, StaticItemData, StaticSummonerSpellData } from '#shared/types/static-data'

/**
 * The core of a build, from the site's own blocks (`Champion/Core/*`), laid out
 * in cards for the app's pane rather than spread by flex as the site's
 * `Champion/BuildPanel/Core` does. From a 56rem container, two columns: on the
 * left the runes, large, with the small pieces — summoners, starter, boots —
 * in a card under them; on the right the build's item tree (the `tree` slot),
 * stretched to the height of the left column so neither leaves a hollow; the
 * skill order, with its level-by-level grid, across the bottom
 * (`BuildSkillGrid`). Narrower, the same cards stack, the tree first. There is no
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
}>(), { summonersPending: false, noRunesMessage: null, championName: null, championId: null })
</script>

<template>
  <div class="@container">
    <div class="grid gap-4 @4xl:grid-cols-[24rem_minmax(0,1fr)]">
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
      <div v-if="$slots.tree" class="order-first flex flex-col surface rounded-xl p-4 @4xl:order-none">
        <h3 class="stat-label mb-3">{{ t('build.tree.title') }}</h3>
        <div class="flex flex-1 items-center justify-center">
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
