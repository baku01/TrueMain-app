<script setup lang="ts">
import type { StaticItemData } from '#shared/types/static-data'
import type { BuildPath, PathTile } from '~/utils/build-path'
import type { NextItemOrderStep } from '~/utils/next-item'
import { aroundParam } from '~/utils/split-param'

/**
 * Under the next item on the overlay (`OverlayNextItem`, and the preview's
 * sample): its recipe as one row — the parts joined by "+", owned ones
 * checked, the one to buy now lit — with one
 * line saying what to buy next and whether the gold in hand pays it; then the
 * whole build as a row, with how far into it the game is.
 */
const props = defineProps<{
  path: BuildPath | null
  order: NextItemOrderStep[]
  statics: Record<number, StaticItemData>
  gold: number
}>()

const { t } = useT()
const [beforeToGo, afterToGo] = aroundParam('overlay.nextItem.toGo', 'missing')
const nameOf = (id: number) => props.statics[id]?.name ?? t('game.itemFallback', { id })

/** The path as one row: an intermediate being started stands as its own parts, so nothing is drawn twice. */
const tiles = computed<PathTile[]>(() => props.path?.entries.flatMap(entry => (entry.parts.length ? entry.parts : [entry])) ?? [])
/** The first part not yet owned: what the shop is opened for next. */
const next = computed(() => tiles.value.find(tile => tile.state !== 'owned') ?? null)
const nextToGo = computed(() => (next.value ? Math.max(0, next.value.cost - props.gold) : 0))
const done = computed(() => props.order.filter(step => step.state === 'Completed').length)
</script>

<template>
  <div class="space-y-2.5">
    <section v-if="tiles.length" :aria-label="t('game.buildPath')">
      <p class="mb-1.5 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-wider text-dimmed">
        {{ t('overlay.nextItem.recipe') }}
        <span v-if="next" class="ml-auto flex min-w-0 items-center gap-1 normal-case tracking-normal">
          <template v-if="nextToGo === 0">
            <UIcon name="i-lucide-shopping-bag" class="size-3 shrink-0 text-primary" />
            <span class="truncate font-semibold text-primary">{{ t('overlay.nextItem.buyNow', { name: nameOf(next.itemId) }) }}</span>
          </template>
          <span v-else class="truncate text-muted">{{ nameOf(next.itemId) }} · {{ beforeToGo }}<span class="font-semibold tabular-nums text-stat-gold">{{ nextToGo }}</span>{{ afterToGo }}</span>
        </span>
      </p>
      <ol class="flex flex-wrap items-start gap-x-1 gap-y-1.5">
        <li v-for="(tile, index) in tiles" :key="`${tile.itemId}-${index}`" class="flex items-start gap-1">
          <span v-if="index > 0" class="mt-[7px] text-[11px] font-semibold text-dimmed" aria-hidden="true">+</span>
          <div class="flex w-8 flex-col items-center gap-0.5">
            <div class="relative">
              <GameTooltipItemIcon
                :item="statics[tile.itemId] ?? null"
                :width="28"
                :height="28"
                class="size-7 rounded-md"
                :class="{
                  'opacity-40 grayscale': tile.state === 'owned',
                  'ring-2 ring-primary shadow-[0_0_8px_-1px] shadow-primary/70': tile === next,
                  'ring-1 ring-primary/40': tile !== next && tile.state === 'buy',
                  'opacity-60': tile.state === 'later' && tile !== next,
                }"
              />
              <span v-if="tile.state === 'owned'" class="absolute -right-0.5 -top-0.5 flex size-3 items-center justify-center rounded-full bg-primary">
                <UIcon name="i-lucide-check" class="size-2 text-inverted" />
              </span>
            </div>
            <span
              class="text-[10px] leading-none tabular-nums"
              :class="tile.state === 'owned' ? 'text-dimmed' : tile === next ? 'font-semibold text-primary' : tile.state === 'buy' ? 'text-primary/80' : 'text-dimmed'"
            >{{ tile.state === 'owned' ? '\u00A0' : `${tile.approx ? '≈' : ''}${tile.cost}` }}</span>
          </div>
        </li>
      </ol>
    </section>

    <section v-if="order.length" class="border-t border-default pt-2" :aria-label="t('game.buildOrder')">
      <p class="mb-1.5 flex items-center text-[9px] font-semibold uppercase tracking-wider text-dimmed">
        {{ t('overlay.nextItem.build') }}
        <span class="ml-auto tabular-nums normal-case tracking-normal">{{ done }}/{{ order.length }}</span>
      </p>
      <GameBuildOrder :steps="order" :statics="statics" :size="22" />
    </section>
  </div>
</template>
