<script setup lang="ts">
import type { GuideIcon, GuideItemSection } from '~/utils/mobafire'
import { idOf } from '~/utils/guide-entities'

/**
 * The author's item sections as a buying progression: one step each, in the
 * guide's order — the starting items, the boots, each build they offer, the
 * situational ones —, under the author's own titles, joined by a rail down
 * the left. Each step's notes sit beside its items on a wide pane and under
 * them on a narrow one, never behind an icon. The items are the app's, with
 * their tooltips and names in the player's language, MOBAFire's picture for
 * one the index does not know.
 */
defineProps<{ sections: GuideItemSection[] }>()
const index = useGuideIndex()
const { items } = useStaticData()
const itemOf = (icon: GuideIcon) => {
  const id = index.value ? idOf(index.value.items, icon.name, icon.image) : null
  return id !== null ? items.value[id] ?? null : null
}
</script>

<template>
  <ol class="@container flex flex-col">
    <li v-for="(section, step) in sections" :key="step" class="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 pb-3 last:pb-0">
      <!-- The rail from this step to the next. -->
      <span v-if="step < sections.length - 1" class="absolute bottom-0 left-4 top-9 w-px -translate-x-1/2 bg-linear-to-b from-primary/45 to-primary/10" aria-hidden="true" />
      <span class="relative mt-1 grid size-8 place-items-center rounded-full bg-primary/14 text-xs font-bold tabular-nums text-primary ring-1 ring-primary/35">{{ step + 1 }}</span>
      <div class="grid min-w-0 gap-3 rounded-xl bg-elevated/45 p-3 ring-1 ring-white/4 transition-colors hover:bg-elevated/70" :class="section.notes && '@4xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]'">
        <div class="min-w-0">
          <h4 class="guide-text text-sm font-semibold text-highlighted">{{ section.title }}</h4>
          <div class="mt-2.5 flex flex-wrap gap-x-2 gap-y-3">
            <figure v-for="(item, place) in section.items" :key="`${item.name}-${place}`" class="flex w-17 flex-col items-center gap-1.5 text-center">
              <GameTooltipItemIcon v-if="itemOf(item)" :item="itemOf(item)" :width="44" :height="44" class="rounded-lg ring-1 ring-white/10" />
              <GuidesIcon v-else :icon="item" :size="44" :named="false" />
              <figcaption class="line-clamp-2 text-[11px] leading-tight text-toned">{{ itemOf(item)?.name ?? item.name }}</figcaption>
            </figure>
          </div>
        </div>
        <GuidesNotes :notes="section.notes" class="self-start" />
      </div>
    </li>
  </ol>
</template>
