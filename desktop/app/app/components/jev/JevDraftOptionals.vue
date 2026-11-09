<script setup lang="ts">
import type { DraftOptional } from '~/utils/jev-optionals'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * "Optional by the draft" (`utils/jev-optionals`): each need of the enemy
 * team that stands out — how much the draft calls for it, the item slot a
 * rule makes it due by, the enemies behind it — and the champion's own items
 * that answer it, most first, each with its win rate and games, those the
 * build holds marked. Beside the build, not in it: what to buy when the game
 * asks for it, also written into the imported item set. The same row on the
 * Jev board and in champion select (`JevBuildPath`).
 */
defineProps<{ optionals: DraftOptional[] }>()
const { t } = useT()
const { nameOf, portraitOf } = useChampionStatics()
const { items } = useStaticData()
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const tone = (value: number) => (value >= 0.52 ? 'text-primary' : value < 0.48 ? 'text-muted' : 'text-highlighted')
const percent = (value: number) => `${Math.round(value * 100)}%`
</script>

<template>
  <div class="@container flex flex-col gap-1.5">
    <p class="stat-label" :title="t('jev.optional.hint')">{{ t('jev.optional.title') }}</p>
    <ul class="grid gap-1.5 @3xl:grid-cols-2">
      <li v-for="optional in optionals" :key="optional.need" class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-accented/25 px-3 py-2" :data-need="optional.need">
        <!-- The need: how much the draft calls for it, when a rule makes it due, who is behind it. -->
        <div class="flex min-w-0 flex-col gap-1">
          <span class="flex flex-wrap items-center gap-1.5">
            <span class="text-[10px] font-semibold uppercase tracking-wide text-muted" :title="t(`jev.need.${optional.need}.hint`)">{{ t(`jev.need.${optional.need}`) }}</span>
            <span class="rounded bg-primary/15 px-1.5 py-px text-[10px] font-semibold tabular-nums text-primary">{{ percent(optional.call) }}</span>
            <UBadge v-if="optional.dueBy" :label="t('jev.optional.due', { slot: optional.dueBy })" color="warning" variant="subtle" size="xs" />
          </span>
          <span v-if="optional.enemies.length" class="flex items-center gap-1">
            <template v-for="id in optional.enemies.slice(0, 5)" :key="id">
              <img v-if="portraitOf(id)" :src="portraitOf(id)!" :alt="nameOf(id)" :title="nameOf(id)" width="20" height="20" class="img-skeleton size-5 rounded">
            </template>
          </span>
        </div>

        <!-- The champion's items that answer it, most first. -->
        <ol class="ml-auto flex items-start gap-2">
          <li v-for="item in optional.items" :key="item.id" class="flex w-11 flex-col items-center gap-0.5">
            <span class="relative">
              <GameTooltipItemIcon :item="items[item.id] ?? null" :width="32" :height="32" class="rounded-md" :class="item.inBuild ? 'ring-1 ring-primary/60' : ''" />
              <UIcon v-if="item.inBuild" name="i-tabler-chess-knight" class="absolute -right-1 -top-1 size-3 text-primary" :aria-label="t('jev.optional.inBuild')" />
            </span>
            <span class="text-[10px] font-semibold tabular-nums" :class="tone(item.winRate)">{{ formatPercentage(item.winRate, 1) }}</span>
            <span class="text-[10px] tabular-nums text-dimmed">{{ compact.format(item.games) }}</span>
          </li>
        </ol>
      </li>
    </ul>
  </div>
</template>
