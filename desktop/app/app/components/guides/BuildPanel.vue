<script setup lang="ts">
import type { GuideBuild, GuideIcon } from '~/utils/mobafire'
import { idOf, runePageOf } from '~/utils/guide-entities'

/**
 * One build of a MOBAFire guide, block by block as the site lays it: the
 * recommended items, the rune pages and the spell sets — each a switch
 * between the author's options, under the option's title —, the items by
 * section, and the ability order over the 18 levels.
 *
 * What the game names is drawn from the app's own data (`useGuideIndex`):
 * its icons and tooltips, its names in the player's language, a rune page as
 * every rune page in the app, ready to import into the client. Anything the
 * index does not know keeps the site's picture and word.
 */
const props = defineProps<{
  build: GuideBuild
  /** The champion the guide is for, when known: its abilities by key. */
  championId: number | null
  /** What the rune import names its page after. */
  championName: string | null
}>()
const { t } = useT()
const index = useGuideIndex()
const { items, summoners, runeTree, championStatic, loadChampion } = useStaticData()

watch(() => props.championId, (id) => {
  if (id) void loadChampion(id)
}, { immediate: true })

const runeIndex = ref(0)
const spellIndex = ref(0)
watch(() => props.build, () => {
  runeIndex.value = 0
  spellIndex.value = 0
})
const runePage = computed(() => props.build.runes[runeIndex.value] ?? null)
const resolvedRunes = computed(() => (runePage.value && index.value ? runePageOf(runePage.value, index.value) : null))
const spellSet = computed(() => props.build.spells[spellIndex.value] ?? null)
const LEVELS = Array.from({ length: 18 }, (_, at) => at + 1)

const itemOf = (icon: GuideIcon) => {
  const id = index.value ? idOf(index.value.items, icon.name, icon.image) : null
  return id !== null ? items.value[id] ?? null : null
}
const spellOf = (icon: GuideIcon) => {
  const id = index.value ? idOf(index.value.spells, icon.name, icon.image) : null
  return id !== null ? summoners.value[id] ?? null : null
}
const abilityOf = (key: string) => (props.championId ? championStatic(props.championId)?.championSpells[key] ?? null : null)
</script>

<template>
  <div class="flex flex-col gap-4">
    <section v-if="build.recommended.length" class="surface rounded-xl p-4">
      <h3 class="stat-label mb-3">{{ t('guides.recommended') }}</h3>
      <div class="flex flex-wrap justify-center gap-4">
        <figure v-for="(item, at) in build.recommended" :key="`${item.name}-${at}`" class="flex w-20 flex-col items-center gap-1.5 text-center">
          <GameTooltipItemIcon v-if="itemOf(item)" :item="itemOf(item)" :width="56" :height="56" class="rounded-full ring-1 ring-white/10" />
          <GuidesIcon v-else :icon="item" :size="56" round :named="false" />
          <figcaption class="line-clamp-2 text-[11px] leading-tight text-toned">{{ itemOf(item)?.name ?? item.name }}</figcaption>
        </figure>
      </div>
    </section>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <!-- The rune pages. -->
      <section v-if="runePage" class="surface flex flex-col gap-3 rounded-xl p-4">
        <header class="flex flex-wrap items-center gap-2">
          <h3 class="stat-label">{{ t('guides.runes') }}</h3>
          <span v-if="runePage.title" class="truncate text-sm font-semibold text-highlighted">{{ runePage.title }}</span>
          <div class="ml-auto flex items-center gap-1">
            <BuildRuneImport v-if="resolvedRunes && runeTree && championName" :page="resolvedRunes" :champion="championName" labeled />
            <GuidesNotes :notes="runePage.notes" />
            <template v-if="build.runes.length > 1">
              <UButton
                v-for="(page, at) in build.runes"
                :key="at"
                :label="String(at + 1)"
                size="xs"
                :title="page.title"
                :color="at === runeIndex ? 'primary' : 'neutral'"
                :variant="at === runeIndex ? 'solid' : 'soft'"
                @click="runeIndex = at"
              />
            </template>
          </div>
        </header>
        <div v-if="resolvedRunes && runeTree" class="flex justify-center">
          <ChampionCoreRunes :page="resolvedRunes" :tree="runeTree" :size="38" :keystone-size="50" />
        </div>
        <template v-else>
          <div v-for="tree in [runePage.primary, runePage.secondary]" :key="tree.tree" class="flex flex-col gap-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-primary">{{ tree.tree }}</span>
            <div class="flex flex-wrap gap-2">
              <GuidesIcon v-for="(rune, at) in tree.runes" :key="`${rune.name}-${at}`" :icon="rune" :size="tree === runePage.primary && at === 0 ? 52 : 40" round lit />
            </div>
          </div>
        </template>
        <!-- The shards' bonuses as the site words them, when its own runes are drawn: the app's page shows its shards. -->
        <div v-if="runePage.bonuses.length && !resolvedRunes" class="border-t border-default/60 pt-3 text-xs text-muted">
          <span class="stat-label">{{ t('guides.bonus') }}</span>
          <p v-for="(bonus, at) in runePage.bonuses" :key="at">{{ bonus }}</p>
        </div>
      </section>

      <!-- The spell sets. -->
      <section v-if="spellSet" class="surface flex flex-col gap-3 rounded-xl p-4">
        <header class="flex flex-wrap items-center gap-2">
          <h3 class="stat-label">{{ t('guides.spells') }}</h3>
          <div class="ml-auto flex items-center gap-1">
            <GuidesNotes :notes="spellSet.notes" />
            <template v-if="build.spells.length > 1">
              <UButton
                v-for="(set, at) in build.spells"
                :key="at"
                :label="String(at + 1)"
                size="xs"
                :title="set.title"
                :color="at === spellIndex ? 'primary' : 'neutral'"
                :variant="at === spellIndex ? 'solid' : 'soft'"
                @click="spellIndex = at"
              />
            </template>
          </div>
        </header>
        <span v-if="spellSet.title" class="text-sm font-semibold text-highlighted">{{ spellSet.title }}</span>
        <div class="flex flex-wrap gap-4">
          <figure v-for="(spell, at) in spellSet.spells" :key="`${spell.name}-${at}`" class="flex w-20 flex-col items-center gap-1.5 text-center">
            <GameTooltipSummonerSpellIcon v-if="spellOf(spell)" :spell="spellOf(spell)" :width="52" :height="52" class="rounded-lg" />
            <GuidesIcon v-else :icon="spell" :size="52" :named="false" />
            <figcaption class="text-[11px] leading-tight text-toned">{{ spellOf(spell)?.name ?? spell.name }}</figcaption>
          </figure>
        </div>
      </section>
    </div>

    <!-- The items, section by section. -->
    <section v-if="build.items.length" class="surface flex flex-col gap-3 rounded-xl p-4">
      <h3 class="stat-label">{{ t('guides.items') }}</h3>
      <div v-for="(section, at) in build.items" :key="at" class="flex flex-col gap-2 rounded-lg bg-elevated/40 p-3">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-highlighted">{{ section.title }}</span>
          <GuidesNotes class="ml-auto" :notes="section.notes" />
        </div>
        <div class="flex flex-wrap gap-3">
          <figure v-for="(item, place) in section.items" :key="`${item.name}-${place}`" class="flex w-18 flex-col items-center gap-1.5 text-center">
            <GameTooltipItemIcon v-if="itemOf(item)" :item="itemOf(item)" :width="44" :height="44" class="rounded-lg" />
            <GuidesIcon v-else :icon="item" :size="44" :named="false" />
            <figcaption class="line-clamp-2 text-[11px] leading-tight text-toned">{{ itemOf(item)?.name ?? item.name }}</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <!-- The ability order over the levels. -->
    <section v-if="build.abilities" class="surface flex flex-col gap-3 rounded-xl p-4">
      <header class="flex items-center gap-2">
        <h3 class="stat-label">{{ t('guides.abilities') }}</h3>
        <span v-if="build.abilities.title" class="truncate text-sm font-semibold text-highlighted">{{ build.abilities.title }}</span>
        <GuidesNotes class="ml-auto" :notes="build.abilities.notes" />
      </header>
      <div class="flex flex-col gap-1.5 overflow-x-auto">
        <div v-for="row in build.abilities.rows" :key="row.key + row.name" class="flex items-center gap-2">
          <GameTooltipChampionSpellIcon v-if="abilityOf(row.key)" :spell="abilityOf(row.key)" :width="32" :height="32" class="shrink-0 rounded-md" />
          <img v-else-if="row.image" :src="row.image" :alt="row.name" class="size-8 shrink-0 rounded-md" loading="lazy">
          <span class="w-36 shrink-0 truncate text-xs text-toned">{{ abilityOf(row.key)?.name ?? row.name }}</span>
          <div v-if="row.key !== 'P'" class="flex gap-0.5">
            <span
              v-for="level in LEVELS"
              :key="level"
              class="flex size-6 items-center justify-center rounded text-[11px] font-bold tabular-nums"
              :class="row.levels.includes(level) ? 'bg-primary text-inverted' : 'bg-accented/50 text-dimmed'"
            >{{ row.levels.includes(level) ? row.key : level }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
