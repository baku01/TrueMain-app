<script setup lang="ts">
import type { GuideChapter } from '~/utils/mobafire'

/**
 * One chapter of a guide, folding as the site's do: the author's writing,
 * kept to what `sanitizeGuideHtml` allows. A video in it is its thumbnail,
 * opened on YouTube in the player's browser on a click (`open_guide_video`).
 */
defineProps<{ chapter: GuideChapter }>()
const open = ref(true)
const { t } = useT()

async function play(event: MouseEvent) {
  const video = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-video]')?.dataset.video
  if (!video || !/^[\w-]{11}$/.test(video)) return
  if (insideTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('open_guide_video', { video }).catch(() => {})
  }
  else {
    window.open(`https://www.youtube.com/watch?v=${video}`, '_blank', 'noopener')
  }
}
</script>

<template>
  <section class="surface overflow-hidden rounded-xl">
    <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accented/40" :aria-expanded="open" @click="open = !open">
      <span class="flex-1 text-sm font-semibold uppercase tracking-wide text-highlighted">{{ chapter.title }}</span>
      <UIcon :name="open ? 'i-lucide-minus' : 'i-lucide-plus'" class="size-4 text-muted" />
    </button>
    <!-- eslint-disable-next-line vue/no-v-html, vuejs-accessibility/no-static-element-interactions, vuejs-accessibility/click-events-have-key-events -- built by `sanitizeGuideHtml`, from an allow-list, element by element; the click is a video's in it -->
    <div v-if="open" class="guide-html border-t border-default/60 px-5 py-4 text-sm leading-relaxed text-default" :data-watch="t('guides.watchVideo')" @click="play" v-html="chapter.html" />
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
/* A video: its thumbnail under a play mark, a click away from YouTube. */
.guide-html :deep(.guide-video) { position: relative; display: block; width: 100%; max-width: 32rem; margin: 0.5rem 0; cursor: pointer; border-radius: 0.5rem; overflow: hidden; }
.guide-html :deep(.guide-video img) { width: 100%; border-radius: 0; transition: filter 150ms; }
.guide-html :deep(.guide-video:hover img) { filter: brightness(1.15); }
.guide-html :deep(.guide-video)::after { content: '▶'; position: absolute; inset: 50% auto auto 50%; transform: translate(-50%, -50%); display: grid; place-items: center; width: 4rem; height: 2.75rem; border-radius: 0.75rem; background: rgb(220 38 38 / 0.9); color: white; font-size: 1.25rem; }
/* The site's own icons in the text — an item, a rune, a champion — stay the size of a word or two. */
.guide-html :deep(img.guide-icon) { width: 1.6rem; height: 1.6rem; margin: 0 0.2rem; border-radius: 0.25rem; }
</style>
