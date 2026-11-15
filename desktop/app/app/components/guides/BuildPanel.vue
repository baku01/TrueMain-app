<script setup lang="ts">
import type { ItemSetNamedBlocks } from '~/composables/useItemSetImport'
import type { GuideBuild, GuideIcon } from '~/utils/mobafire'
import { idOf, runePageOf } from '~/utils/guide-entities'
import { unresolvedRunes } from '~/utils/guide-build'

/**
 * One build of a MOBAFire guide, read the way the app's build pages read: at
 * a glance first — the rune page, the summoner spells and the recommended
 * items side by side on a wide pane, the ability order across under them —,
 * then the author's item sections as a buying progression
 * (`GuidesItemPath`). The rune pages and spell sets are each a switch between
 * the author's options, under the option's title, the author's notes under
 * each part rather than behind an icon.
 *
 * What the game names is drawn from the app's own data (`useGuideIndex`):
 * its icons and tooltips, its names in the player's language, a rune page as
 * every rune page in the app, ready to import into the client — or a line
 * saying which rune keeps it from importing. Anything the index does not
 * know keeps the site's picture and word.
 */
const props = defineProps<{
  build: GuideBuild
  /** The champion the guide is for, when known: its abilities by key. */
  championId: number | null
  /** What the rune import names its page after. */
  championName: string | null
  /** The whole itemization as one item set, once the index is read (`utils/guide-build`). */
  itemSet: ItemSetNamedBlocks | null
}>()
/** The rune page and spell set on show, kept by the page: its banner imports the same page. */
const runeIndex = defineModel<number>('runePage', { default: 0 })
const spellIndex = defineModel<number>('spellSet', { default: 0 })

const { t } = useT()
const index = useGuideIndex()
const { items, summoners, runeTree } = useStaticData()

const runePage = computed(() => props.build.runes[runeIndex.value] ?? props.build.runes[0] ?? null)
const resolvedRunes = computed(() => (runePage.value && index.value ? runePageOf(runePage.value, index.value) : null))
/** Why the page on show cannot be imported, once the index can tell: the runes it does not know, else that the page is incomplete. */
const runeProblem = computed(() => {
  if (!runePage.value || !index.value || resolvedRunes.value) return null
  const missing = unresolvedRunes(runePage.value, index.value)
  return missing.length ? t('guides.runesUnresolved', { runes: missing.join(', ') }) : t('guides.runesIncomplete')
})
const spellSet = computed(() => props.build.spells[spellIndex.value] ?? props.build.spells[0] ?? null)

const itemOf = (icon: GuideIcon) => {
  const id = index.value ? idOf(index.value.items, icon.name, icon.image) : null
  return id !== null ? items.value[id] ?? null : null
}
const spellOf = (icon: GuideIcon) => {
  const id = index.value ? idOf(index.value.spells, icon.name, icon.image) : null
  return id !== null ? summoners.value[id] ?? null : null
}
</script>

<template>
  <div class="@container flex flex-col gap-4">
    <div class="guide-glance">
      <!-- The rune pages. -->
      <section v-if="runePage" class="surface flex flex-col gap-3 rounded-xl p-4 [grid-area:runes]">
        <header class="flex items-center gap-2">
          <h3 class="stat-label">{{ t('guides.runes') }}</h3>
          <BuildRuneImport
            v-if="resolvedRunes && championName"
            class="ml-auto"
            :page="resolvedRunes"
            :champion="championName"
            :closed-hint="t('guides.importClosed')"
            labeled
          />
        </header>
        <div v-if="build.runes.length > 1" class="flex flex-wrap gap-1" role="tablist" :aria-label="t('guides.runes')">
          <button
            v-for="(page, at) in build.runes"
            :key="at"
            type="button"
            role="tab"
            :aria-selected="at === runeIndex"
            class="max-w-full truncate rounded-md px-2 py-1 text-left text-xs font-medium ring-1 transition-colors"
            :class="at === runeIndex ? 'bg-primary/15 text-highlighted ring-primary/40' : 'text-muted ring-default hover:bg-elevated hover:text-highlighted'"
            :title="page.title"
            @click="runeIndex = at"
          >
            <span class="mr-1 tabular-nums text-dimmed">{{ at + 1 }}</span><span class="guide-text">{{ page.title || t('guides.runePage', { number: at + 1 }) }}</span>
          </button>
        </div>
        <span v-else-if="runePage.title" class="guide-text text-sm font-semibold text-highlighted">{{ runePage.title }}</span>

        <div v-if="resolvedRunes && runeTree" class="flex justify-center py-1">
          <ChampionCoreRunes :page="resolvedRunes" :tree="runeTree" :size="36" :keystone-size="48" />
        </div>
        <template v-else>
          <div v-for="tree in [runePage.primary, runePage.secondary]" :key="tree.tree" class="flex flex-col gap-2">
            <span class="text-xs font-semibold text-primary">{{ tree.tree }}</span>
            <div class="flex flex-wrap gap-2">
              <GuidesIcon v-for="(rune, at) in tree.runes" :key="`${rune.name}-${at}`" :icon="rune" :size="tree === runePage.primary && at === 0 ? 48 : 38" round lit />
            </div>
          </div>
          <!-- The shards' bonuses as the site words them, when its own runes are drawn: the app's page shows its shards. -->
          <div v-if="runePage.bonuses.length" class="border-t border-default/60 pt-3 text-xs text-muted">
            <span class="stat-label">{{ t('guides.bonus') }}</span>
            <p v-for="(bonus, at) in runePage.bonuses" :key="at">{{ bonus }}</p>
          </div>
        </template>
        <p v-if="runeProblem" class="flex items-start gap-2 rounded-lg bg-warning/8 px-3 py-2 text-xs text-toned ring-1 ring-warning/20">
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0 text-warning" />{{ runeProblem }}
        </p>
        <GuidesNotes :notes="runePage.notes" />
      </section>

      <!-- The spell sets. -->
      <section v-if="spellSet" class="surface flex flex-col gap-3 rounded-xl p-4 [grid-area:spells]">
        <header class="flex flex-wrap items-center gap-2">
          <h3 class="stat-label">{{ t('guides.spells') }}</h3>
          <div v-if="build.spells.length > 1" class="ml-auto flex flex-wrap gap-1" role="tablist" :aria-label="t('guides.spells')">
            <button
              v-for="(set, at) in build.spells"
              :key="at"
              type="button"
              role="tab"
              :aria-selected="at === spellIndex"
              class="max-w-48 truncate rounded-md px-2 py-1 text-xs font-medium ring-1 transition-colors"
              :class="at === spellIndex ? 'bg-primary/15 text-highlighted ring-primary/40' : 'text-muted ring-default hover:bg-elevated hover:text-highlighted'"
              :title="set.title"
              @click="spellIndex = at"
            >
              <span class="mr-1 tabular-nums text-dimmed">{{ at + 1 }}</span><span class="guide-text">{{ set.title || t('guides.spellSet', { number: at + 1 }) }}</span>
            </button>
          </div>
        </header>
        <div class="flex flex-wrap items-start gap-x-6 gap-y-3">
          <div class="flex gap-3">
            <figure v-for="(spell, at) in spellSet.spells" :key="`${spell.name}-${at}`" class="flex w-16 flex-col items-center gap-1.5 text-center">
              <GameTooltipSummonerSpellIcon v-if="spellOf(spell)" :spell="spellOf(spell)" :width="44" :height="44" class="rounded-lg ring-1 ring-white/10" />
              <GuidesIcon v-else :icon="spell" :size="44" :named="false" />
              <figcaption class="text-[11px] leading-tight text-toned">{{ spellOf(spell)?.name ?? spell.name }}</figcaption>
            </figure>
          </div>
          <GuidesNotes :notes="spellSet.notes" class="min-w-56 flex-1" />
        </div>
      </section>

      <!-- The recommended items, in the order the author buys them. -->
      <section v-if="build.recommended.length" class="surface flex flex-col gap-3 rounded-xl p-4 [grid-area:core]">
        <header class="flex items-center gap-2">
          <h3 class="stat-label">{{ t('guides.recommended') }}</h3>
        </header>
        <ol class="flex flex-wrap items-start gap-y-3">
          <li v-for="(item, at) in build.recommended" :key="`${item.name}-${at}`" class="flex items-start">
            <figure class="flex w-19 flex-col items-center gap-1.5 text-center">
              <GameTooltipItemIcon v-if="itemOf(item)" :item="itemOf(item)" :width="48" :height="48" class="rounded-lg ring-1 ring-white/10" />
              <GuidesIcon v-else :icon="item" :size="48" :named="false" />
              <figcaption class="line-clamp-2 text-[11px] leading-tight text-toned">{{ itemOf(item)?.name ?? item.name }}</figcaption>
            </figure>
            <UIcon v-if="at < build.recommended.length - 1" name="i-lucide-chevron-right" class="mt-4 size-4 shrink-0 text-dimmed" />
          </li>
        </ol>
      </section>

      <!-- The ability order over the levels. -->
      <section v-if="build.abilities" class="surface flex flex-col gap-3 rounded-xl p-4 [grid-area:skills]">
        <header class="flex flex-wrap items-center gap-2">
          <h3 class="stat-label">{{ t('guides.abilities') }}</h3>
          <span v-if="build.abilities.title" class="guide-text truncate text-sm font-semibold text-highlighted">{{ build.abilities.title }}</span>
        </header>
        <GuidesSkillOrder :rows="build.abilities.rows" :champion-id="championId" />
        <GuidesNotes :notes="build.abilities.notes" />
      </section>
    </div>

    <!-- The author's item sections, step by step. -->
    <section v-if="build.items.length" id="guide-items" class="surface flex scroll-mt-16 flex-col gap-4 rounded-xl p-4">
      <header class="flex items-center gap-2">
        <h3 class="stat-label">{{ t('guides.itemPath') }}</h3>
        <span class="text-xs text-dimmed">{{ t('guides.itemPathHint') }}</span>
        <BuildItemSetImport v-if="itemSet" class="ml-auto" :subject="itemSet" :closed-hint="t('guides.importClosed')" labeled />
      </header>
      <GuidesItemPath :sections="build.items" />
    </section>
  </div>
</template>

<style scoped>
/*
 * The build at a glance, as the app's build pages lay theirs (`.blitz-grid`):
 * stacked on a narrow pane; from 52rem the runes take a column and the
 * spells and the recommended items stack beside them, the ability order
 * across under both.
 */
.guide-glance {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "runes" "spells" "core" "skills";
}

@container (width >= 52rem) {
  .guide-glance {
    grid-template-columns: 23rem minmax(0, 1fr);
    grid-template-rows: auto 1fr auto;
    grid-template-areas: "runes spells" "runes core" "skills skills";
  }
}
</style>
