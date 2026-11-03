<script setup lang="ts">
import type { StaticItemData } from '#shared/types/static-data'
import type { ItemSlot } from '~/utils/sources/analytics'
import { formatPercentage } from '#shared/utils/ddragon'

/**
 * Items slot by slot — the boots, then a build's first, second… item — each
 * slot a row of the items taken there, most taken first, with win rate, share,
 * games and, when the source keeps it, the minute it is usually bought. A row
 * scrolls sideways rather than wrap.
 */
const props = defineProps<{ slots: ItemSlot[], items: Record<number, StaticItemData> }>()
// lolalytics counts "no boots" as a boots option under an id that is no item: only real items are listed.
const shown = computed(() => props.slots.map(slot => ({ ...slot, options: slot.options.filter(option => props.items[option.itemIds[0]!]) })).filter(slot => slot.options.length))
const { t } = useT()
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const tone = (value: number) => (value >= 0.52 ? 'text-primary' : value < 0.48 ? 'text-muted' : 'text-highlighted')
</script>

<template>
  <div class="space-y-2">
    <div v-for="slot in shown" :key="slot.slot" class="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl bg-accented/15 p-2">
      <p class="text-center text-sm font-semibold text-highlighted">{{ slot.slot === 0 ? t('analytics.slot.boots') : t('analytics.slot', { slot: slot.slot }) }}</p>
      <ul class="flex gap-1.5 overflow-x-auto pb-1">
        <li v-for="(option, index) in slot.options" :key="index" class="flex w-[5.5rem] shrink-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-center leading-tight" :class="index === 0 ? 'bg-accented/60' : 'bg-accented/25'">
          <GameTooltipItemIcon :item="items[option.itemIds[0]!] ?? null" :width="36" :height="36" class="size-9 rounded-md" />
          <span class="text-[13px] font-semibold tabular-nums" :class="tone(option.winRate)">{{ formatPercentage(option.winRate, 1) }}</span>
          <span class="whitespace-nowrap text-[10px] tabular-nums text-dimmed">{{ formatPercentage(option.pickRate, 1) }} · {{ compact.format(option.games) }}</span>
          <span v-if="option.minute !== undefined" class="whitespace-nowrap text-[10px] tabular-nums text-muted">{{ t('analytics.minute', { minute: option.minute }) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
