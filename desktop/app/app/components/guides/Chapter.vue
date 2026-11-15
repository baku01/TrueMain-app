<script setup lang="ts">
import type { GuideChapter } from '~/utils/mobafire'

/** One chapter of a guide, folding as the site's do: the author's writing, kept to what `sanitizeGuideHtml` allows. */
defineProps<{ chapter: GuideChapter }>()
const open = ref(true)
</script>

<template>
  <section class="surface overflow-hidden rounded-xl">
    <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accented/40" :aria-expanded="open" @click="open = !open">
      <span class="flex-1 text-sm font-semibold uppercase tracking-wide text-highlighted">{{ chapter.title }}</span>
      <UIcon :name="open ? 'i-lucide-minus' : 'i-lucide-plus'" class="size-4 text-muted" />
    </button>
    <!-- eslint-disable-next-line vue/no-v-html -- built by `sanitizeGuideHtml`, from an allow-list, element by element -->
    <div v-if="open" class="guide-html border-t border-default/60 px-5 py-4 text-sm leading-relaxed text-default" v-html="chapter.html" />
  </section>
</template>

<style scoped>
.guide-html :deep(h2) { margin: 1rem 0 0.5rem; font-size: 1.15rem; font-weight: 700; color: var(--ui-text-highlighted); }
.guide-html :deep(h3) { margin: 0.9rem 0 0.4rem; font-size: 1rem; font-weight: 600; color: var(--ui-text-highlighted); }
.guide-html :deep(h4), .guide-html :deep(h5) { margin: 0.75rem 0 0.25rem; font-size: 0.85rem; font-weight: 600; color: var(--ui-text-highlighted); }
.guide-html :deep(p) { margin: 0 0 0.5rem; }
.guide-html :deep(ul) { margin: 0.25rem 0 0.75rem; padding-left: 1.25rem; list-style: disc; }
.guide-html :deep(ol) { margin: 0.25rem 0 0.75rem; padding-left: 1.25rem; list-style: decimal; }
.guide-html :deep(li) { margin: 0.2rem 0; }
.guide-html :deep(strong), .guide-html :deep(b) { color: var(--ui-text-highlighted); font-weight: 600; }
.guide-html :deep(blockquote) { margin: 0 0 0.75rem; border-left: 3px solid var(--ui-border-accented); padding-left: 0.75rem; color: var(--ui-text-muted); }
.guide-html :deep(hr) { margin: 1rem 0; border-color: var(--ui-border); }
.guide-html :deep(table) { margin: 0.5rem 0; border-collapse: collapse; }
.guide-html :deep(td), .guide-html :deep(th) { padding: 0.25rem 0.5rem; vertical-align: top; }
.guide-html :deep(.guide-center) { text-align: center; }
.guide-html :deep(img) { display: inline-block; max-width: 100%; height: auto; border-radius: 0.375rem; vertical-align: middle; }
/* The site's own icons in the text — an item, a rune, a champion — stay the size of a word or two. */
.guide-html :deep(img.guide-icon) { width: 1.6rem; height: 1.6rem; margin: 0 0.2rem; border-radius: 0.25rem; }
</style>
