<script setup lang="ts">
import { formatCount } from '#shared/utils/counts'
import type { StaticItemData } from '#shared/types/static-data'
import { parseItemDescription } from '#shared/utils/tooltip-parser'
import type { CatalogEntry } from '~/utils/item-catalog'
import { CATALOG_GROUPS } from '~/utils/item-catalog'

/** The panel of one item: a header with its icon, name, group and price, its description, its recipe. */
const props = defineProps<{
  entry: CatalogEntry
  items: Record<number, StaticItemData>
}>()

const emit = defineEmits<{ select: [itemId: number] }>()
const { t } = useT()

const groupLabel = computed(() => t(CATALOG_GROUPS.find(({ group }) => group === props.entry.group)?.label ?? 'items.group.other'))
const parsed = computed(() => (props.entry.item.description ? parseItemDescription(props.entry.item.description) : []))
</script>

<template>
  <div class="space-y-4">
    <header class="relative overflow-hidden rounded-xl border border-default bg-gradient-to-br from-rosegold-950/70 via-elevated to-elevated p-4">
      <div class="flex items-center gap-4">
        <SkeletonImage :src="entry.item.iconUrl" :alt="entry.item.name" :width="64" :height="64" class="size-16 shrink-0 rounded-xl shadow-lg ring-2 ring-primary/50" />
        <div class="min-w-0">
          <h2 class="text-xl font-semibold leading-tight tracking-tight text-highlighted">{{ entry.item.name }}</h2>
          <div class="mt-1.5 flex flex-wrap items-center gap-2">
            <UBadge :label="groupLabel" color="neutral" variant="subtle" size="sm" />
            <span v-if="entry.item.totalGold > 0" class="flex items-center gap-1 text-sm font-semibold text-stat-active">
              <UIcon name="i-lucide-circle-dollar-sign" class="size-4" />{{ formatCount(entry.item.totalGold) }}
            </span>
          </div>
        </div>
      </div>
      <p v-if="entry.item.plaintext" class="mt-3 text-sm italic text-muted">{{ entry.item.plaintext }}</p>
    </header>

    <section v-if="parsed.length" class="rounded-xl bg-default/40 p-4 text-sm leading-relaxed">
      <GameTooltipRichText :segments="parsed" />
    </section>

    <section class="rounded-xl bg-default/40 p-4">
      <CatalogItemRecipe :entry="entry" :items="items" @select="emit('select', $event)" />
    </section>
  </div>
</template>
