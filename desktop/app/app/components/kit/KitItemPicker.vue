<script setup lang="ts">
import type { StaticItemData } from '#shared/types/static-data'
import type { ItemClassMap, ItemShopClass, KitItemGroup } from '~/utils/kit-items'
import { ITEM_SHOP_CLASSES, kitItemGroups, searchKitItems } from '~/utils/kit-items'

/**
 * The item picker of the kit editor: the patch's Rift shop, searched by name,
 * grouped — legendaries, boots, components, starters — each icon with the
 * site's item card on hover (`GameTooltipItemIcon`). The legendaries filter by
 * the in-game shop's classes — Fighter, Marksman, Assassin, Mage, Tank,
 * Support — once those are read (`useItemClasses`). An item that would repeat
 * one already taken is shown, with its card, but cannot be taken.
 */
const SHOP_CLASS_KEYS: Record<ItemShopClass, string> = {
  Fighter: 'kit.class.fighter',
  Marksman: 'kit.class.marksman',
  Assassin: 'kit.class.assassin',
  Mage: 'kit.class.mage',
  Tank: 'kit.class.tank',
  Support: 'kit.class.support',
}

const props = withDefaults(defineProps<{
  items: Record<number, StaticItemData>
  /** The groups this slot takes, in picker order. */
  groups: KitItemGroup[]
  /** Items that cannot go here, and why, after the item's name. */
  blocked?: number[]
  blockedNote?: string
  /** Each item's shop classes; without them the picker offers no class filter. */
  classes?: ItemClassMap
  title: string
}>(), { blocked: () => [], blockedNote: undefined, classes: () => ({}) })

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ pick: [itemId: number] }>()

const { t } = useT()
const note = computed(() => props.blockedNote ?? t('kit.picker.alreadyOnPath'))
const query = ref('')
const shopClass = ref<ItemShopClass | 'all'>('all')
watch(open, (value) => {
  if (!value) return
  query.value = ''
  shopClass.value = 'all'
})

const classTabs = computed(() => [{ label: t('kit.picker.all'), value: 'all' }, ...ITEM_SHOP_CLASSES.map(c => ({ ...c, label: t(SHOP_CLASS_KEYS[c.value]) }))])
const filtersByClass = computed(() => props.groups.includes('legendary') && Object.keys(props.classes).length > 0)

const grouped = computed(() => kitItemGroups(props.items))
const sections = computed(() => searchKitItems(props.items, grouped.value, query.value, props.groups, {
  shopClass: filtersByClass.value && shopClass.value !== 'all' ? shopClass.value : null,
  classes: props.classes,
}))

function pick(itemId: number) {
  if (props.blocked.includes(itemId)) return
  emit('pick', itemId)
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" :title="title" :ui="{ content: 'max-w-xl', body: 'p-0 sm:p-0' }">
    <template #body>
      <div class="space-y-2 border-b border-default p-3">
        <UInput v-model="query" icon="i-lucide-search" :placeholder="t('kit.picker.search')" class="w-full" :aria-label="t('kit.picker.search')" />
        <UTabs
          v-if="filtersByClass"
          v-model="shopClass"
          :items="classTabs"
          :content="false"
          variant="pill"
          color="neutral"
          size="xs"
          :aria-label="t('kit.picker.itemClass')"
          :ui="{ list: 'ring ring-default', indicator: 'rounded-md bg-accented shadow-none', trigger: 'px-2.5 data-[state=active]:text-highlighted' }"
        />
      </div>
      <div class="h-[22rem] space-y-4 overflow-y-auto p-3">
        <section v-for="section in sections" :key="section.group">
          <h3 class="stat-label mb-2">{{ section.label }}</h3>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1.5">
            <button
              v-for="item in section.items"
              :key="item.id"
              type="button"
              class="rounded transition hover:brightness-125 focus-visible:outline-2 focus-visible:outline-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-disabled:hover:brightness-100"
              :aria-disabled="blocked.includes(item.id)"
              :aria-label="blocked.includes(item.id) ? `${item.name}, ${note}` : item.name"
              @click="pick(item.id)"
            >
              <GameTooltipItemIcon :item="item" :width="36" :height="36" loading="lazy" class="size-9 rounded" />
            </button>
          </div>
        </section>
        <p v-if="sections.length === 0" class="py-6 text-center text-sm text-muted">
          {{ query ? t('kit.picker.noMatch', { query }) : t('kit.picker.noneInClass') }}
        </p>
      </div>
    </template>
  </UModal>
</template>
