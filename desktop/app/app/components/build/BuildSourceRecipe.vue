<script setup lang="ts">
import type { StaticItemData } from '#shared/types/static-data'
import type { ItemOption, SlotGroup } from '~/utils/sources/model'
import type { ItemOrders } from '~/utils/recommended-item-set'
import { isBoots, readBlitzBuildDoc } from '~/utils/blitz/builds'
import { buyingOrder, finalBuild } from '~/utils/recommended-item-set'
import { isQuestReward } from '~/utils/support-quest'

/**
 * The picked build as a recipe, the way Blitz lays its items out: what to
 * start with, what to buy in order — each of the first items' components as
 * players buy them (Blitz's measured order, else the recipe), then the item —,
 * the six items it ends on, and the situational ones beside them. Icons only
 * (in the buying order, the build's own items ringed, their components not):
 * the numbers are on the choices around it. The same reading the automatic
 * import writes into the shop (`utils/recommended-item-set.ts`).
 */
const props = defineProps<{
  championId: number
  position: string
  core: ItemOption | null
  starter: ItemOption | null
  boots: ItemOption[]
  followUps: SlotGroup[]
  /** The other builds offered: their items are the situational ones too. */
  cores?: ItemOption[]
  /** A support's quest reward, picked when the quest is done: its own row, never bought (`utils/support-quest`). */
  questReward?: ItemOption | null
  items: Record<number, StaticItemData>
}>()

const { t } = useT()

// Blitz measures the buying order of each item for every champion; another source's build reads it too.
const orders = shallowRef<ItemOrders | null>(null)
watch(() => `${props.championId}:${props.position}`, async () => {
  orders.value = null
  const key = `${props.championId}:${props.position}`
  const doc = await readBlitzBuildDoc(props.championId, props.position).catch(() => undefined)
  if (key === `${props.championId}:${props.position}`) orders.value = doc?.itemOrders ?? null
}, { immediate: true })

const recipe = computed(() => {
  if (!props.core) return null
  const path = props.core.itemIds.filter(id => !isBoots(id))
  const boots = props.core.itemIds.find(isBoots) ?? props.boots[0]?.itemIds[0]
  const after = [
    ...props.followUps.flatMap(group => group.options.map(option => option.itemIds.at(-1)!)),
    ...(props.cores ?? []).flatMap(option => option.itemIds),
  ].filter(id => !path.includes(id) && !isBoots(id) && !isQuestReward(id))
  const starter = [...new Set(props.starter?.itemIds ?? [])]
  const final = finalBuild({ key: 'recipe', title: '', starter, path, boots: boots ? [boots] : [], situational: after })
  const known = (ids: number[]) => ids.filter(id => id in props.items)
  return {
    starter: known(starter),
    quest: known(props.questReward?.itemIds ?? []),
    order: known(buyingOrder(final, starter, props.items, orders.value)),
    final: known(final),
    situational: known([...new Set(after)].filter(id => !final.includes(id) && !isBoots(id))).slice(0, 7),
  }
})

const ROWS = [
  { key: 'starter', label: 'panel.recipe.starter' },
  { key: 'quest', label: 'panel.recipe.quest' },
  { key: 'order', label: 'panel.recipe.order' },
  { key: 'final', label: 'panel.recipe.final' },
  { key: 'situational', label: 'panel.recipe.situational' },
] as const
</script>

<template>
  <section v-if="recipe" class="surface min-w-0 space-y-3 rounded-2xl p-3">
    <h3 class="stat-label">{{ t('panel.recipe') }}</h3>
    <div v-for="row in ROWS" v-show="recipe[row.key].length" :key="row.key" class="space-y-1.5">
      <p class="text-xs font-medium text-muted">{{ t(row.label) }}</p>
      <div class="flex flex-wrap items-center gap-1">
        <template v-for="(id, index) in recipe[row.key]" :key="`${row.key}-${index}`">
          <GameTooltipItemIcon
            :item="items[id] ?? null"
            :width="row.key === 'order' ? 30 : 34"
            :height="row.key === 'order' ? 30 : 34"
            class="shrink-0 rounded-md"
            :class="row.key === 'order' && recipe.final.includes(id) ? 'ring-1 ring-primary/60' : ''"
          />
          <UIcon v-if="row.key === 'final' && index < recipe[row.key].length - 1" name="i-lucide-chevron-right" class="size-3 shrink-0 text-dimmed" />
        </template>
      </div>
    </div>
  </section>
</template>

