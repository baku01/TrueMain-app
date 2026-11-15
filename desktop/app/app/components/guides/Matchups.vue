<script setup lang="ts">
import type { GuideMatchup } from '~/utils/mobafire'
import { nameKey } from '~/utils/guide-entities'

/**
 * A guide's threats and synergies, as MOBAFire splits them: the champions on
 * either side by how much they matter (Extreme to Tiny), a level to narrow
 * them to — the gravest, as the site opens on, until another is picked —, and
 * each one's note by the author.
 */
const props = defineProps<{ threats: GuideMatchup[], synergies: GuideMatchup[] }>()
const { t } = useT()
const index = useGuideIndex()
const { nameOf } = useChampionStatics()
/** The champion's id in the app's data, for its portrait and its name in the player's language. */
const championOf = (matchup: GuideMatchup) => index.value?.champions.get(nameKey(matchup.champion)) ?? null

const side = ref<'threats' | 'synergies'>(props.threats.length ? 'threats' : 'synergies')
const sideList = (name: 'threats' | 'synergies') => (name === 'threats' ? props.threats : props.synergies)
const levelsOf = (name: 'threats' | 'synergies') => [...new Set(sideList(name).map(matchup => matchup.level))].sort((a, b) => a - b)
const level = ref<number | null>(levelsOf(side.value)[0] ?? null)
const levels = computed(() => levelsOf(side.value))
const shown = computed(() => sideList(side.value)
  .filter(matchup => level.value === null || matchup.level === level.value)
  .sort((a, b) => a.level - b.level))

function pickSide(name: 'threats' | 'synergies') {
  side.value = name
  level.value = levelsOf(name)[0] ?? null
}

const LEVEL_COLOR: Record<number, string> = { 1: 'text-error', 2: 'text-warning', 3: 'text-toned', 4: 'text-muted', 5: 'text-dimmed' }
</script>

<template>
  <section class="surface flex flex-col gap-3 rounded-xl p-4">
    <header class="flex flex-wrap items-center gap-2">
      <UButton
        v-for="name in (['threats', 'synergies'] as const)"
        :key="name"
        :label="`${t(`guides.${name}`)} · ${(name === 'threats' ? threats : synergies).length}`"
        size="sm"
        :icon="name === 'threats' ? 'i-lucide-swords' : 'i-lucide-handshake'"
        :color="side === name ? 'primary' : 'neutral'"
        :variant="side === name ? 'soft' : 'ghost'"
        :disabled="!(name === 'threats' ? threats : synergies).length"
        @click="pickSide(name)"
      />
      <div class="ml-auto flex flex-wrap gap-1">
        <UButton :label="t('guides.allLevels')" size="xs" :color="level === null ? 'primary' : 'neutral'" :variant="level === null ? 'soft' : 'ghost'" @click="level = null" />
        <UButton
          v-for="entry in levels"
          :key="entry"
          :label="t(`guides.level.${entry}`)"
          size="xs"
          :color="level === entry ? 'primary' : 'neutral'"
          :variant="level === entry ? 'soft' : 'ghost'"
          @click="level = entry"
        />
      </div>
    </header>
    <ul class="flex flex-col gap-2">
      <li v-for="matchup in shown" :key="matchup.champion" class="flex gap-3 rounded-lg bg-elevated/40 p-3">
        <ChampionPortrait v-if="championOf(matchup)" :champion-id="championOf(matchup)!" size="sm" class="size-10! shrink-0 rounded-md!" />
        <img v-else-if="matchup.image" :src="matchup.image" :alt="matchup.champion" class="img-skeleton size-10 shrink-0 rounded-md" loading="lazy">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-highlighted">{{ championOf(matchup) ? nameOf(championOf(matchup)!) : matchup.champion }}</span>
            <span class="text-[11px] font-bold uppercase tracking-wider" :class="LEVEL_COLOR[matchup.level] ?? 'text-muted'">{{ t(`guides.level.${matchup.level}`) }}</span>
          </div>
          <p v-if="matchup.note" class="mt-1 whitespace-pre-line text-xs leading-relaxed text-toned">{{ matchup.note }}</p>
        </div>
      </li>
    </ul>
  </section>
</template>
