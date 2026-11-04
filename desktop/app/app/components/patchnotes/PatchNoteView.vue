<script setup lang="ts">
import type { ChangeKind, PatchBlock, PatchNote, PatchSection } from '~/utils/patch-notes'
import { blockChange, markChanges } from '~/utils/patch-notes'

/**
 * One patch's note: Riot's introduction, then its sections — champions,
 * items, systems — as cards, one per champion or item, narrowed by a search
 * and the section tabs. Each card is read as a buff, a nerf or an adjustment
 * from its numbers (`blockChange`), each line marked the same way, and a
 * section's cards are grouped by it — the buffs, then the nerfs, then the
 * adjustments, then the rest —, the kind a tab away too. The text is the
 * note's own, already sanitised (`utils/patch-notes.ts`), so it is the one
 * place `v-html` is used.
 */
const props = defineProps<{ note: PatchNote }>()

const { t } = useT()
const query = ref('')
const section = ref<string | null>(null)
const kind = ref<ChangeKind | null>(null)

/** Each card's kind and its marked html, read once per note. */
const read = computed(() => new Map(props.note.sections.flatMap(entry => entry.blocks).map(block => [block.id, { kind: blockChange(block.html), html: markChanges(block.html) }])))
const kindOf = (block: PatchBlock) => read.value.get(block.id)?.kind ?? null
const KINDS: ChangeKind[] = ['buff', 'nerf', 'adjust']
const KIND_STYLE: Record<ChangeKind, { icon: string, text: string, ring: string, bar: string }> = {
  buff: { icon: 'i-lucide-trending-up', text: 'text-data-good', ring: 'ring-data-good/40', bar: 'bg-data-good' },
  nerf: { icon: 'i-lucide-trending-down', text: 'text-error', ring: 'ring-error/40', bar: 'bg-error' },
  adjust: { icon: 'i-lucide-arrow-left-right', text: 'text-warning', ring: 'ring-warning/40', bar: 'bg-warning' },
}
const counts = computed(() => {
  const all = props.note.sections.flatMap(entry => entry.blocks).map(kindOf)
  return Object.fromEntries(KINDS.map(entry => [entry, all.filter(value => value === entry).length])) as Record<ChangeKind, number>
})

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const words = computed(() => fold(query.value).split(/\s+/).filter(Boolean))
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ')

const visible = computed<PatchSection[]>(() => props.note.sections
  .filter(entry => !section.value || entry.id === section.value)
  .map(entry => ({
    ...entry,
    blocks: entry.blocks.filter((block) => {
      if (kind.value && kindOf(block) !== kind.value) return false
      const haystack = fold(`${block.title} ${textOf(block.html)}`)
      return words.value.every(word => haystack.includes(word))
    }),
  }))
  .filter(entry => entry.blocks.length > 0))

/** A section's cards by kind, buffs first, the cards no number moves last. */
function groupsOf(entry: PatchSection) {
  const order: (ChangeKind | null)[] = [...KINDS, null]
  return order.map(value => ({ kind: value, blocks: entry.blocks.filter(block => kindOf(block) === value) })).filter(group => group.blocks.length)
}

const total = computed(() => visible.value.reduce((sum, entry) => sum + entry.blocks.length, 0))

watch(() => props.note, () => {
  query.value = ''
  section.value = null
  kind.value = null
})
</script>

<template>
  <div class="shrink-0 space-y-5">
    <div class="flex flex-wrap items-center gap-3">
      <UInput v-model="query" icon="i-lucide-search" :placeholder="t('patchnotes.search')" class="min-w-60 flex-1" :aria-label="t('patchnotes.search')" />
      <div class="flex flex-wrap gap-1.5" role="group" :aria-label="t('patchnotes.sections')">
        <UButton
          :label="t('patchnotes.allSections')"
          size="xs"
          :color="section === null ? 'primary' : 'neutral'"
          :variant="section === null ? 'soft' : 'ghost'"
          @click="section = null"
        />
        <UButton
          v-for="entry in note.sections"
          :key="entry.id"
          :label="entry.title"
          size="xs"
          :color="section === entry.id ? 'primary' : 'neutral'"
          :variant="section === entry.id ? 'soft' : 'ghost'"
          @click="section = entry.id"
        />
      </div>
      <div v-if="counts.buff + counts.nerf + counts.adjust" class="flex flex-wrap gap-1.5" role="group" :aria-label="t('patchnotes.kinds')">
        <UButton
          v-for="entry in KINDS"
          :key="entry"
          size="xs"
          :icon="KIND_STYLE[entry].icon"
          :label="`${t(`patchnotes.kind.${entry}`)} · ${counts[entry]}`"
          :color="kind === entry ? 'primary' : 'neutral'"
          :variant="kind === entry ? 'soft' : 'ghost'"
          :class="kind !== entry && KIND_STYLE[entry].text"
          :disabled="!counts[entry]"
          @click="kind = kind === entry ? null : entry"
        />
      </div>
    </div>

    <blockquote v-if="note.intro && !query && !section && !kind" class="note-html surface rounded-xl p-4 text-sm leading-relaxed text-toned" v-html="note.intro" />

    <section v-for="entry in visible" :key="entry.id" class="space-y-3">
      <h2 v-if="entry.title" class="flex items-center gap-2">
        <span class="stat-label">{{ entry.title }}</span>
        <span class="rounded-full bg-accented px-1.5 text-[10px] text-muted">{{ entry.blocks.length }}</span>
      </h2>
      <div v-for="group in groupsOf(entry)" :key="group.kind ?? 'other'" class="space-y-2">
        <h3 v-if="group.kind" class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" :class="KIND_STYLE[group.kind].text">
          <UIcon :name="KIND_STYLE[group.kind].icon" class="size-4" />{{ t(`patchnotes.kind.${group.kind}`) }}
          <span class="rounded-full bg-accented px-1.5 text-[10px] font-normal text-muted">{{ group.blocks.length }}</span>
        </h3>
        <h3 v-else-if="groupsOf(entry).length > 1" class="stat-label">{{ t('patchnotes.kind.other') }}</h3>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(22rem,1fr))] gap-3">
          <article
            v-for="block in group.blocks"
            :key="block.id"
            class="relative overflow-hidden surface rounded-xl p-4"
            :class="block.wide ? 'col-span-full' : ''"
          >
            <span v-if="group.kind" class="absolute inset-y-0 left-0 w-1" :class="KIND_STYLE[group.kind].bar" aria-hidden="true" />
            <header v-if="block.title" class="mb-3 flex items-center gap-4">
              <SkeletonImage v-if="block.iconUrl" :src="block.iconUrl" :alt="block.title" :width="64" :height="64" loading="lazy" class="size-16 shrink-0 rounded-xl ring-1" :class="group.kind ? KIND_STYLE[group.kind].ring : 'ring-default'" />
              <div class="min-w-0">
                <h3 class="text-lg font-semibold tracking-tight text-highlighted">{{ block.title }}</h3>
                <span v-if="group.kind" class="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider" :class="KIND_STYLE[group.kind].text">
                  <UIcon :name="KIND_STYLE[group.kind].icon" class="size-3.5" />{{ t(`patchnotes.kind.${group.kind}`) }}
                </span>
              </div>
            </header>
            <div class="note-html text-sm leading-relaxed text-toned" v-html="read.get(block.id)?.html ?? block.html" />
          </article>
        </div>
      </div>
    </section>

    <p v-if="total === 0" class="py-8 text-center text-sm text-muted">{{ t('patchnotes.noMatch', { query }) }}</p>
  </div>
</template>

<style scoped>
.note-html :deep(p) { margin: 0 0 0.5rem; }
.note-html :deep(ul) { margin: 0.25rem 0 0.75rem; padding-left: 1rem; list-style: disc; }
.note-html :deep(li) { margin: 0.2rem 0; }
/* A line read as a buff or a nerf: its marker and a thin tint say which. */
.note-html :deep(li.change-buff)::marker { color: var(--color-data-good); }
.note-html :deep(li.change-nerf)::marker { color: var(--ui-error); }
.note-html :deep(p.change-buff), .note-html :deep(li.change-buff) { background: color-mix(in srgb, var(--color-data-good) 8%, transparent); border-radius: 0.375rem; padding: 0.125rem 0.375rem; }
.note-html :deep(p.change-nerf), .note-html :deep(li.change-nerf) { background: color-mix(in srgb, var(--ui-error) 8%, transparent); border-radius: 0.375rem; padding: 0.125rem 0.375rem; }
.note-html :deep(strong) { color: var(--ui-text-highlighted); font-weight: 600; }
.note-html :deep(h4) { margin: 0.75rem 0 0.25rem; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ui-text-muted); }
.note-html :deep(h4.ability-title) { color: var(--ui-primary); }
.note-html :deep(blockquote) { margin: 0 0 0.75rem; font-style: italic; color: var(--ui-text-muted); }
.note-html :deep(img) { max-width: 100%; border-radius: 0.5rem; }
/* Riot's own pictures — the summary graphic, the skins — are the point of their block: they fill it. */
.note-html :deep(img.note-art) { width: 100%; height: auto; display: block; }
.note-html :deep(.gs-container) { display: grid; grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); gap: 1rem; }
.note-html :deep(.skin-title) { margin: 0.5rem 0 0; font-size: 0.8rem; letter-spacing: normal; text-transform: none; color: var(--ui-text-toned); }
/* A champion's ability or an item are icons beside their text, however big the file. */
.note-html :deep(img.note-icon) { width: 3.25rem; height: 3.25rem; object-fit: cover; display: inline-block; margin-right: 0.75rem; vertical-align: middle; }
</style>
