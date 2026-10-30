<script setup lang="ts">
import type { RuneTreeResponse, StaticPerkData } from '#shared/types/static-data'

/**
 * Every rune, tree by tree, as cards tinted with their tree's colour: the
 * keystones large on top, each row's runes below, the stat shards in a card of
 * their own. A rune's full text opens in the panel on the right, with the
 * site's rune card on hover.
 */
const props = defineProps<{
  runeTree: RuneTreeResponse | null
  loading: boolean
}>()

const { t } = useT()
const query = ref('')
const selectedId = ref<number | null>(null)

/** The five trees' colours, as the League client draws them. */
const TREE_COLORS: Record<number, string> = {
  8000: '#c8aa6e',
  8100: '#d44242',
  8200: '#9faafc',
  8300: '#49aab9',
  8400: '#a1d586',
}
const SHARD_COLOR = '#8b8b95'

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const words = computed(() => fold(query.value).split(/\s+/).filter(Boolean))
const matches = (id: number) => {
  const perk = props.runeTree?.perks[id]
  return !!perk && words.value.every(word => fold(perk.name).includes(word))
}

interface Block { key: string, keystone: boolean, perks: number[] }
interface Section { id: number, name: string, tagline?: string, iconUrl: string, color: string, blocks: Block[] }

const sections = computed<Section[]>(() => {
  const tree = props.runeTree
  if (!tree) return []
  const result: Section[] = []
  for (const style of tree.styles) {
    const blocks: Block[] = [
      { key: 'keystones', keystone: true, perks: style.keystones },
      ...style.subRows.map((perks, index) => ({ key: `row-${index}`, keystone: false, perks })),
    ].map(block => ({ ...block, perks: block.perks.filter(matches) })).filter(block => block.perks.length > 0)
    if (blocks.length) {
      result.push({ id: style.styleId, name: style.name, tagline: tree.perkStyles[style.styleId]?.tooltip, iconUrl: style.iconUrl, color: TREE_COLORS[style.styleId] ?? SHARD_COLOR, blocks })
    }
  }
  const shards = tree.shardSlots
    .map((perks, index) => ({ key: `shard-${index}`, keystone: false, perks: perks.filter(matches) }))
    .filter(block => block.perks.length > 0)
  if (shards.length) result.push({ id: 0, name: t('runes.shards'), iconUrl: '', color: SHARD_COLOR, blocks: shards })
  return result
})

const selected = computed<StaticPerkData | null>(() => {
  const perk = selectedId.value === null ? null : props.runeTree?.perks[selectedId.value] ?? null
  // The rune texts list their effects with a bare `<li>`, which the card's parser runs together on one line.
  return perk?.longDesc ? { ...perk, longDesc: perk.longDesc.replace(/<li>/g, '<br>• ') } : perk
})
const selectedSection = computed(() => sections.value.find(section => section.blocks.some(block => block.perks.includes(selectedId.value ?? -1))) ?? null)

watch(sections, (list) => {
  if (selectedSection.value) return
  selectedId.value = list[0]?.blocks[0]?.perks[0] ?? null
}, { immediate: true })
</script>

<template>
  <div class="surface grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,24rem)] overflow-hidden rounded-xl">
    <div class="flex min-h-0 flex-col border-r border-default">
      <div class="border-b border-default p-3">
        <UInput v-model="query" icon="i-lucide-search" :placeholder="t('runes.search')" class="w-full" :aria-label="t('runes.search')" />
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-3">
        <div v-if="loading && !runeTree" aria-busy="true" class="grid grid-cols-2 gap-3">
          <USkeleton v-for="card in 6" :key="card" class="h-44 w-full" />
        </div>
        <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-3">
          <section
            v-for="section in sections"
            :key="section.id"
            class="overflow-hidden rounded-xl border border-default bg-default/40"
            :style="{ '--tree': section.color }"
          >
            <h2 class="flex items-center gap-2.5 border-b border-default px-3.5 py-2.5" :style="{ background: `linear-gradient(90deg, color-mix(in srgb, ${section.color} 18%, transparent), transparent)` }">
              <SkeletonImage v-if="section.iconUrl" :src="section.iconUrl" transparent :alt="section.name" :width="26" :height="26" class="size-6.5" />
              <span class="min-w-0">
                <span class="block text-sm font-semibold uppercase tracking-wider" :style="{ color: section.color }">{{ section.name }}</span>
                <span v-if="section.tagline" class="block truncate text-[11px] text-muted">{{ section.tagline }}</span>
              </span>
            </h2>
            <div class="divide-y divide-default/60">
              <div v-for="block in section.blocks" :key="block.key" class="flex items-center justify-center gap-3 px-3 py-2.5">
                <button
                  v-for="id in block.perks"
                  :key="id"
                  type="button"
                  class="rounded-full ring-2 ring-transparent transition hover:brightness-125 focus-visible:outline-2 focus-visible:outline-primary"
                  :class="id === selectedId ? 'ring-[var(--tree)]!' : ''"
                  :aria-label="runeTree?.perks[id]?.name"
                  :aria-current="id === selectedId"
                  @click="selectedId = id"
                >
                  <GameTooltipPerkIcon
                    :perk="runeTree?.perks[id] ?? null"
                    :width="block.keystone ? 52 : 40"
                    :height="block.keystone ? 52 : 40"
                    :class="block.keystone ? 'size-13 rounded-full' : 'size-10 rounded-full'"
                  />
                </button>
              </div>
            </div>
          </section>
        </div>
        <p v-if="!loading && sections.length === 0" class="py-8 text-center text-sm text-muted">
          {{ query ? t('runes.noMatch', { query }) : t('runes.empty') }}
        </p>
      </div>
    </div>

    <aside class="min-h-0 overflow-y-auto bg-muted/50 p-4" :aria-label="t('runes.detail')">
      <div v-if="selected" class="space-y-4">
        <header
          class="flex items-center gap-4 rounded-xl border border-default p-4"
          :style="{ background: `linear-gradient(135deg, color-mix(in srgb, ${selectedSection?.color ?? SHARD_COLOR} 22%, transparent), transparent 70%)` }"
        >
          <SkeletonImage :src="selected.iconUrl" transparent :alt="selected.name" :width="64" :height="64" class="size-16 shrink-0 rounded-full" />
          <div class="min-w-0">
            <h2 class="text-xl font-semibold leading-tight tracking-tight text-highlighted">{{ selected.name }}</h2>
            <p v-if="selectedSection" class="mt-1 text-xs font-semibold uppercase tracking-wider" :style="{ color: selectedSection.color }">{{ selectedSection.name }}</p>
          </div>
        </header>
        <section class="rounded-xl bg-default/40 p-4">
          <GameTooltipPerkBody :perk="selected" class="[&>header]:hidden [&>div]:border-0 [&>div]:pt-0" />
        </section>
      </div>
      <p v-else class="py-8 text-center text-sm text-muted">{{ t('runes.pick') }}</p>
    </aside>
  </div>
</template>
