<script setup lang="ts">
import type { GuideBuild } from '~/utils/mobafire'

/**
 * One build of a MOBAFire guide, block by block as the site lays it: the
 * recommended items, the rune pages and the spell sets — each a switch
 * between the author's options, under the option's title —, the items by
 * section, and the ability order over the 18 levels.
 */
const props = defineProps<{ build: GuideBuild }>()
const { t } = useT()

const runeIndex = ref(0)
const spellIndex = ref(0)
watch(() => props.build, () => {
  runeIndex.value = 0
  spellIndex.value = 0
})
const runePage = computed(() => props.build.runes[runeIndex.value] ?? null)
const spellSet = computed(() => props.build.spells[spellIndex.value] ?? null)
const LEVELS = Array.from({ length: 18 }, (_, index) => index + 1)
</script>

<template>
  <div class="flex flex-col gap-4">
    <section v-if="build.recommended.length" class="surface rounded-xl p-4">
      <h3 class="stat-label mb-3">{{ t('guides.recommended') }}</h3>
      <div class="flex flex-wrap justify-center gap-4">
        <GuidesIcon v-for="(item, index) in build.recommended" :key="`${item.name}-${index}`" :icon="item" :size="56" round />
      </div>
    </section>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <!-- The rune pages. -->
      <section v-if="runePage" class="surface flex flex-col gap-3 rounded-xl p-4">
        <header class="flex flex-wrap items-center gap-2">
          <h3 class="stat-label">{{ t('guides.runes') }}</h3>
          <span v-if="runePage.title" class="truncate text-sm font-semibold text-highlighted">{{ runePage.title }}</span>
          <div class="ml-auto flex items-center gap-1">
            <GuidesNotes :notes="runePage.notes" />
            <template v-if="build.runes.length > 1">
              <UButton
                v-for="(page, index) in build.runes"
                :key="index"
                :label="String(index + 1)"
                size="xs"
                :title="page.title"
                :color="index === runeIndex ? 'primary' : 'neutral'"
                :variant="index === runeIndex ? 'solid' : 'soft'"
                @click="runeIndex = index"
              />
            </template>
          </div>
        </header>
        <div v-for="tree in [runePage.primary, runePage.secondary]" :key="tree.tree" class="flex flex-col gap-2">
          <span class="text-xs font-semibold uppercase tracking-wider text-primary">{{ tree.tree }}</span>
          <div class="flex flex-wrap gap-2">
            <GuidesIcon v-for="(rune, index) in tree.runes" :key="`${rune.name}-${index}`" :icon="rune" :size="tree === runePage.primary && index === 0 ? 52 : 40" round lit />
          </div>
        </div>
        <div v-if="runePage.shards.length || runePage.bonuses.length" class="flex flex-wrap items-center gap-4 border-t border-default/60 pt-3">
          <div class="flex gap-1.5">
            <img v-for="(shard, index) in runePage.shards" :key="index" :src="shard.image ?? undefined" :alt="shard.name" :title="shard.name" class="size-7 rounded-full bg-black/30 p-0.5" loading="lazy">
          </div>
          <div v-if="runePage.bonuses.length" class="text-xs text-muted">
            <span class="stat-label">{{ t('guides.bonus') }}</span>
            <p v-for="(bonus, index) in runePage.bonuses" :key="index">{{ bonus }}</p>
          </div>
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
                v-for="(set, index) in build.spells"
                :key="index"
                :label="String(index + 1)"
                size="xs"
                :title="set.title"
                :color="index === spellIndex ? 'primary' : 'neutral'"
                :variant="index === spellIndex ? 'solid' : 'soft'"
                @click="spellIndex = index"
              />
            </template>
          </div>
        </header>
        <span v-if="spellSet.title" class="text-sm font-semibold text-highlighted">{{ spellSet.title }}</span>
        <div class="flex flex-wrap gap-4">
          <GuidesIcon v-for="(spell, index) in spellSet.spells" :key="`${spell.name}-${index}`" :icon="spell" :size="52" />
        </div>
      </section>
    </div>

    <!-- The items, section by section. -->
    <section v-if="build.items.length" class="surface flex flex-col gap-3 rounded-xl p-4">
      <h3 class="stat-label">{{ t('guides.items') }}</h3>
      <div v-for="(section, index) in build.items" :key="index" class="flex flex-col gap-2 rounded-lg bg-elevated/40 p-3">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-highlighted">{{ section.title }}</span>
          <GuidesNotes class="ml-auto" :notes="section.notes" />
        </div>
        <div class="flex flex-wrap gap-3">
          <GuidesIcon v-for="(item, at) in section.items" :key="`${item.name}-${at}`" :icon="item" :size="44" />
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
          <img v-if="row.image" :src="row.image" :alt="row.name" :title="row.name" class="size-8 shrink-0 rounded-md" loading="lazy">
          <span class="w-36 shrink-0 truncate text-xs text-toned">{{ row.name }}</span>
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
