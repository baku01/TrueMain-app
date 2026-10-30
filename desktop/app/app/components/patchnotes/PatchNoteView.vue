<script setup lang="ts">
import type { PatchNote, PatchSection } from '~/utils/patch-notes'

/**
 * One patch's note: Riot's introduction, then its sections — champions,
 * items, systems — as cards, one per champion or item, narrowed by a search
 * and the section tabs. The text is the note's own, already sanitised
 * (`utils/patch-notes.ts`), so it is the one place `v-html` is used.
 */
const props = defineProps<{ note: PatchNote }>()

const { t } = useT()
const query = ref('')
const section = ref<string | null>(null)

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const words = computed(() => fold(query.value).split(/\s+/).filter(Boolean))
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ')

const visible = computed<PatchSection[]>(() => props.note.sections
  .filter(entry => !section.value || entry.id === section.value)
  .map(entry => ({
    ...entry,
    blocks: entry.blocks.filter((block) => {
      const haystack = fold(`${block.title} ${textOf(block.html)}`)
      return words.value.every(word => haystack.includes(word))
    }),
  }))
  .filter(entry => entry.blocks.length > 0))

const total = computed(() => visible.value.reduce((sum, entry) => sum + entry.blocks.length, 0))

watch(() => props.note, () => {
  query.value = ''
  section.value = null
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
    </div>

    <blockquote v-if="note.intro && !query && !section" class="note-html rounded-xl border border-default bg-default/40 p-4 text-sm leading-relaxed text-toned" v-html="note.intro" />

    <section v-for="entry in visible" :key="entry.id" class="space-y-3">
      <h2 v-if="entry.title" class="flex items-center gap-2">
        <span class="stat-label">{{ entry.title }}</span>
        <span class="rounded-full bg-accented px-1.5 text-[10px] text-muted">{{ entry.blocks.length }}</span>
      </h2>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(22rem,1fr))] gap-3">
        <article v-for="block in entry.blocks" :key="block.id" class="rounded-xl border border-default bg-default/40 p-4" :class="block.wide ? 'col-span-full' : ''">
          <header v-if="block.title" class="mb-3 flex items-center gap-4">
            <SkeletonImage v-if="block.iconUrl" :src="block.iconUrl" :alt="block.title" :width="64" :height="64" loading="lazy" class="size-16 shrink-0 rounded-xl ring-1 ring-default" />
            <h3 class="text-lg font-semibold tracking-tight text-highlighted">{{ block.title }}</h3>
          </header>
          <div class="note-html text-sm leading-relaxed text-toned" v-html="block.html" />
        </article>
      </div>
    </section>

    <p v-if="total === 0" class="py-8 text-center text-sm text-muted">{{ t('patchnotes.noMatch', { query }) }}</p>
  </div>
</template>

<style scoped>
.note-html :deep(p) { margin: 0 0 0.5rem; }
.note-html :deep(ul) { margin: 0.25rem 0 0.75rem; padding-left: 1rem; list-style: disc; }
.note-html :deep(li) { margin: 0.2rem 0; }
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
