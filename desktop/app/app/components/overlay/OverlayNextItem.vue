<script setup lang="ts">
import type { GameState } from '~/types/game'
import { basketName } from '~/utils/next-item'

/**
 * The overlay's build path (#2183): the next item and whether the gold in
 * hand buys it, its components in the order the mains buy them — owned,
 * bought now, later — and under it the build as a row (#2101), to see where
 * the game stands and when the boots come. No runners-up: a glance over the
 * game takes in one decision. Until a starter is bought, the starter stands
 * in for it: it is what the shop is open for at the start. The game page's
 * panel (`GameNextItem`) keeps the full answer; both read `useNextItemPanel`.
 */
const props = defineProps<{ game: GameState }>()

const { failure, bootsDue, statics, order, top, remaining, path, state, name, starter, starterGold, fromKit } = useNextItemPanel(toRef(props, 'game'))

/** The gold still to earn before it can be bought; 0 once the gold in hand covers it. */
const { t } = useT()
const missing = computed(() => Math.max(0, remaining.value - props.game.gold))

/** The basket's face: its first item that is not a potion. */
const starterItem = computed(() => {
  const ids = starter.value?.itemIds ?? []
  const face = ids.find(id => !statics.value[id]?.tags?.includes('Consumable')) ?? ids[0]
  return face === undefined ? null : statics.value[face] ?? null
})

/**
 * The component to buy next: the first one of the path not yet owned — the
 * part inside an intermediate that is being started, when it is open — with
 * what it costs from here and whether the gold in hand pays it now.
 */
const nextComponent = computed(() => {
  const entry = path.value?.entries.find(candidate => candidate.state !== 'owned')
  if (!entry) return null
  return entry.parts.find(part => part.state !== 'owned') ?? entry
})
/** The path as one row of components: an intermediate being started is replaced by its own parts, so nothing is framed or drawn twice. */
const steps = computed(() => path.value?.entries.flatMap(entry => (entry.parts.length ? entry.parts : [entry])) ?? [])
const componentToGo = computed(() => (nextComponent.value ? Math.max(0, nextComponent.value.cost - props.game.gold) : 0))

const message = computed(() => {
  switch (state.value) {
    case 'unmeasured': return t('overlay.nextItem.unmeasured')
    case 'complete': return t('overlay.nextItem.complete')
    case 'offline': return t('overlay.nextItem.offline')
    default: return null
  }
})
</script>

<template>
  <OverlayNextItemCard v-if="starter" :label="t('overlay.nextItem.starter')" :item="starterItem" :name="basketName(starter.itemIds, name)" :missing="Math.max(0, starterGold - game.gold)" :total="starterGold" />
  <div v-else-if="state === 'ready' && top" class="space-y-1.5">
    <!-- The player's active kit (#2185) answers under its own label: its next step, not the mains'. -->
    <OverlayNextItemCard :item="statics[top.itemId] ?? null" :name="name(top.itemId)" :missing="missing" :total="remaining" :label="fromKit ? t('overlay.nextItem.kit') : bootsDue ? t('overlay.nextItem.boots') : t('overlay.nextItem.title')" />
    <!-- What to buy first, said once and large: the rest of the path is the context around it. -->
    <div
      v-if="nextComponent"
      class="flex items-center gap-2 rounded-lg px-2 py-1.5 ring-1"
      :class="nextComponent.state === 'buy' ? 'bg-primary/10 ring-primary/50' : 'bg-elevated/60 ring-default'"
    >
      <GameTooltipItemIcon :item="statics[nextComponent.itemId] ?? null" :width="30" :height="30" class="size-[30px] shrink-0 rounded-md ring-1 ring-primary/60" />
      <div class="min-w-0 flex-1">
        <p class="text-[9px] font-semibold uppercase tracking-wider text-dimmed">{{ t('overlay.nextItem.component') }}</p>
        <p class="truncate text-[12px] font-semibold leading-tight text-highlighted">{{ name(nextComponent.itemId) }}</p>
      </div>
      <span class="shrink-0 text-right text-[11px] font-semibold tabular-nums">
        <span v-if="componentToGo === 0" class="flex items-center gap-0.5 text-primary">
          <UIcon name="i-lucide-circle-check" class="size-3" />{{ nextComponent.approx ? '≈' : '' }}{{ nextComponent.cost }}
        </span>
        <span v-else class="text-stat-gold">{{ nextComponent.cost }}</span>
      </span>
    </div>
    <ol v-if="steps.length" class="flex flex-wrap items-start gap-y-2 pt-1" :aria-label="t('game.buildPath')">
      <li v-for="(step, index) in steps" :key="`${step.itemId}-${index}`" class="flex items-start">
        <UIcon v-if="index > 0" name="i-lucide-chevron-right" class="mx-0.5 mt-1.5 size-3 shrink-0 text-dimmed" />
        <GameBuildPathTile :tile="step" :statics="statics" :size="26" />
      </li>
    </ol>
    <!-- The whole build, set apart from the components by a hairline. -->
    <div class="border-t border-default pt-2">
      <GameBuildOrder :steps="order" :statics="statics" :size="22" />
    </div>
  </div>
  <div v-else class="flex items-center gap-2.5">
    <USkeleton v-if="!message" class="size-9 shrink-0 rounded-md" />
    <AppMark v-else class="size-4 shrink-0" />
    <div class="min-w-0 flex-1">
      <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">{{ t('overlay.nextItem.title') }}</p>
      <USkeleton v-if="!message" class="mt-1 h-3 w-28" />
      <p v-else class="text-[11px] text-muted">{{ message }}</p>
      <p v-if="state === 'offline' && failure" class="mt-0.5 line-clamp-3 break-all text-[9px] leading-tight text-dimmed">{{ failure }}</p>
    </div>
  </div>
</template>
