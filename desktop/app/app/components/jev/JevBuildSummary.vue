<script setup lang="ts">
import type { LaidBuild } from '~/utils/jev-build'
import type { SkillKey } from '~/utils/skill-grid'
import { completeSkillGrid, skillGrid } from '~/utils/skill-grid'

/**
 * One build of the Jev page in a single compact card, so the recommended and
 * the most played sit side by side: the rune page, spells and starter on one
 * line; the skill order as its max order and one strip of the 18 levels (the
 * first three as measured, the rest by the game's rules); then the buy order,
 * the boots marked where they fall.
 */
const props = defineProps<{ build: LaidBuild, championId: number, recommended: boolean, title: string }>()
const { t } = useT()
const { items, summoners, championStatic } = useStaticData()

const spells = computed(() => (props.build.summonerSpells ? [props.build.summonerSpells.spell1Id, props.build.summonerSpells.spell2Id] : []))
const bootsId = computed(() => props.build.boots?.itemIds[0] ?? null)
const LEVELS = Array.from({ length: 18 }, (_, index) => index + 1)
const levels = computed(() => {
  const order = props.build.skillOrder
  if (!order) return null
  const opening = order.opening?.slice(0, 3)
  return opening?.length === 3
    ? completeSkillGrid(Object.fromEntries(opening.map((key, index) => [index + 1, key as SkillKey])) as Record<number, SkillKey>, order.sequence)
    : skillGrid(order.sequence)
})
const ability = (key: string) => championStatic(props.championId)?.championSpells[key] ?? null
</script>

<template>
  <article class="surface flex flex-col gap-3 rounded-2xl p-3.5" :class="recommended ? 'ring-1 ring-primary/40' : ''">
    <h3 class="flex items-center gap-2 text-sm font-semibold" :class="recommended ? 'text-primary' : 'text-muted'">
      <UIcon :name="recommended ? 'i-tabler-sparkles' : 'i-tabler-database'" class="size-4" />
      {{ title }}
    </h3>

    <!-- Runes, spells and starter on one line. -->
    <div class="flex flex-wrap items-end gap-x-5 gap-y-2">
      <div v-if="build.runePage" class="flex flex-col gap-1">
        <p class="stat-label">{{ t('jev.slot.runes') }}</p>
        <JevRunePage :page="build.runePage" />
      </div>
      <div v-if="spells.length" class="flex flex-col gap-1">
        <p class="stat-label">{{ t('jev.slot.spells') }}</p>
        <span class="flex gap-1">
          <GameTooltipSummonerSpellIcon v-for="id in spells" :key="id" :spell="summoners[id] ?? null" :width="32" :height="32" class="size-8 rounded-md" />
        </span>
      </div>
      <div v-if="build.starterItems" class="flex flex-col gap-1">
        <p class="stat-label">{{ t('jev.slot.starter') }}</p>
        <span class="flex gap-1">
          <GameTooltipItemIcon v-for="(id, index) in build.starterItems.itemIds" :key="`${id}-${index}`" :item="items[id] ?? null" :width="32" :height="32" class="rounded-md" />
        </span>
      </div>
    </div>

    <!-- The skill order: the max order, then the 18 levels in one strip. -->
    <div v-if="build.skillOrder" class="flex flex-col gap-1">
      <p class="stat-label">{{ t('jev.slot.skills') }}</p>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span class="flex items-center gap-0.5">
          <template v-for="(key, index) in build.skillOrder.sequence" :key="key">
            <UIcon v-if="index > 0" name="i-lucide-chevron-right" class="size-3 text-dimmed" />
            <span class="relative size-7">
              <GameTooltipChampionSpellIcon :spell="ability(key)" :width="28" :height="28" :fallback-label="key" class="size-7 rounded" />
              <span class="absolute -bottom-1 -right-1 rounded bg-default px-0.5 text-[9px] font-bold text-highlighted">{{ key }}</span>
            </span>
          </template>
        </span>
        <ol v-if="levels" class="grid grid-cols-[repeat(18,1.25rem)] gap-0.5">
          <li v-for="level in LEVELS" :key="level" class="flex flex-col items-center">
            <span class="text-[8px] leading-3 tabular-nums text-dimmed">{{ level }}</span>
            <span
              class="flex size-5 items-center justify-center rounded text-[10px] font-bold"
              :class="levels[level] === 'R' ? 'bg-primary/25 text-primary' : 'bg-primary/10 text-highlighted'"
            >{{ levels[level] }}</span>
          </li>
        </ol>
      </div>
    </div>

    <!-- The buy order, the boots where they fall. -->
    <div class="flex flex-col gap-1">
      <p class="stat-label">{{ t('jev.card.order') }}</p>
      <ol class="flex flex-wrap items-center gap-1">
        <template v-for="(itemId, index) in build.order" :key="`${itemId}-${index}`">
          <UIcon v-if="index > 0" name="i-lucide-chevron-right" class="size-3 text-dimmed" aria-hidden="true" />
          <li class="relative">
            <GameTooltipItemIcon :item="items[itemId] ?? null" :width="34" :height="34" class="rounded-md" :class="itemId === bootsId ? 'ring-1 ring-default' : ''" />
            <span class="absolute -bottom-1 -right-1 rounded bg-default px-0.5 text-[9px] font-semibold tabular-nums text-muted">{{ index + 1 }}</span>
          </li>
        </template>
      </ol>
    </div>
  </article>
</template>
