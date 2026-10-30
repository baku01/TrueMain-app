<script setup lang="ts">
import { formatCount } from '#shared/utils/counts'
import type { StaticItemData } from '#shared/types/static-data'
import type { CatalogEntry } from '~/utils/item-catalog'

/**
 * An item's recipe drawn as a tree: the item at the top, its components under
 * it on a rail, the combining cost between them and the total, and the items
 * it goes into below. Every tile is a link to that item's own page of the
 * catalogue.
 */
const props = defineProps<{
  entry: CatalogEntry
  items: Record<number, StaticItemData>
}>()

const emit = defineEmits<{ select: [itemId: number] }>()
const { t } = useT()
const gold = (amount: number) => formatCount(amount)
const name = (id: number) => props.items[id]?.name ?? t('items.unknown', { id })
</script>

<template>
  <div class="space-y-5">
    <section v-if="entry.from.length" :aria-label="t('items.recipe.builtFrom')">
      <h3 class="stat-label mb-3">{{ t('items.recipe.builtFrom') }}</h3>
      <div class="flex flex-col items-center">
        <div class="flex flex-col items-center gap-1">
          <SkeletonImage :src="entry.item.iconUrl" :alt="entry.item.name" :width="48" :height="48" class="size-12 rounded-lg ring-2 ring-primary/60" />
          <span class="text-xs font-medium text-highlighted">{{ entry.item.name }}</span>
        </div>
        <span class="h-4 w-px bg-accented" aria-hidden="true" />
        <ul class="flex flex-wrap justify-center">
          <li
            v-for="(id, index) in entry.from"
            :key="`${id}-${index}`"
            class="relative px-1.5 pt-4 before:absolute before:top-0 before:h-px before:bg-accented after:absolute after:left-1/2 after:top-0 after:h-4 after:w-px after:bg-accented"
            :class="entry.from.length === 1 ? 'before:hidden' : index === 0 ? 'before:left-1/2 before:right-0' : index === entry.from.length - 1 ? 'before:left-0 before:right-1/2' : 'before:inset-x-0'"
          >
            <button
              type="button"
              class="flex w-20 flex-col items-center gap-1 rounded-lg p-1.5 transition hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
              :aria-label="name(id)"
              @click="emit('select', id)"
            >
              <GameTooltipItemIcon :item="items[id] ?? null" :width="40" :height="40" class="size-10 rounded-md" />
              <span class="line-clamp-2 text-center text-[11px] leading-tight text-default">{{ name(id) }}</span>
              <span class="flex items-center gap-0.5 text-[11px] text-stat-active"><UIcon name="i-lucide-circle-dollar-sign" class="size-3" />{{ gold(items[id]?.totalGold ?? 0) }}</span>
            </button>
          </li>
        </ul>
      </div>
      <dl class="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div v-if="entry.combineCost !== null" class="rounded-lg bg-default/40 px-3 py-2">
          <dt class="stat-label">{{ t('items.recipe.combine') }}</dt>
          <dd class="mt-0.5 flex items-center gap-1 font-semibold text-stat-active"><UIcon name="i-lucide-circle-dollar-sign" class="size-3.5" />{{ gold(entry.combineCost) }}</dd>
        </div>
        <div class="rounded-lg bg-default/40 px-3 py-2" :class="entry.combineCost === null ? 'col-span-2' : ''">
          <dt class="stat-label">{{ t('items.recipe.total') }}</dt>
          <dd class="mt-0.5 flex items-center gap-1 font-semibold text-stat-active"><UIcon name="i-lucide-circle-dollar-sign" class="size-3.5" />{{ gold(entry.item.totalGold) }}</dd>
        </div>
      </dl>
    </section>
    <p v-else class="flex items-center gap-2 rounded-lg bg-default/40 px-3 py-2.5 text-sm text-muted">
      <UIcon name="i-lucide-package-check" class="size-4 shrink-0" />{{ t('items.recipe.none') }}
    </p>

    <section v-if="entry.into.length" :aria-label="t('items.recipe.buildsInto')">
      <h3 class="stat-label mb-2">{{ t('items.recipe.buildsInto') }} · {{ entry.into.length }}</h3>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="id in entry.into"
          :key="id"
          type="button"
          class="rounded-md ring-1 ring-default transition hover:ring-primary/60 hover:brightness-125 focus-visible:outline-2 focus-visible:outline-primary"
          :aria-label="name(id)"
          @click="emit('select', id)"
        >
          <GameTooltipItemIcon :item="items[id] ?? null" :width="36" :height="36" loading="lazy" class="size-9 rounded-md" />
        </button>
      </div>
    </section>
  </div>
</template>
