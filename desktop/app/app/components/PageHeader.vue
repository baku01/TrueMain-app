<script setup lang="ts">
/**
 * The one page header of the desktop app, on Blitz's pattern: over the title a breadcrumb saying where the page sits
 * (section / page); the title in the display face, with an optional muted
 * qualifier after it; a line saying what the page is for; the page's own
 * controls on the right (`#actions`); and under it all the page's tabs
 * (`#tabs`, underlined) and its filter bar (default slot). Replaces the
 * shared layer's for this app only (a component of the app wins over the
 * layer's of the same name); the layer's props still work.
 */
defineProps<{
  /** Kept for the layer's callers: the breadcrumb says what the eyebrow did. */
  eyebrow?: string
  title: string
  /** A qualifier after the title, in a quieter tone (`· Mestre+`). */
  suffix?: string
  description?: string
  /** Kept for callers that pass one: the header draws no emblem. */
  icon?: string
}>()

const { t } = useT()
const route = useRoute()

/** Each page's section, as the side menu files it (`AppNav`). */
const PAGES: [string, string, string | null][] = [
  ['/champions', 'i-game-icons-crossed-swords', 'nav.group.champions'], ['/tierlist', 'i-game-icons-podium', 'nav.group.champions'],
  ['/analytics', 'i-game-icons-histogram', 'nav.group.champions'], ['/classes', 'i-game-icons-visored-helm', 'nav.group.champions'],
  ['/matchup', 'i-game-icons-sword-clash', 'nav.group.champions'], ['/probuild', 'i-game-icons-laurels-trophy', 'nav.group.builds'],
  ['/kits', 'i-game-icons-knapsack', 'nav.group.builds'], ['/items', 'i-game-icons-potion-ball', 'nav.group.builds'],
  ['/patchnotes', 'i-game-icons-scroll-unfurled', 'nav.group.builds'], ['/draft', 'i-game-icons-rally-the-troops', 'nav.inGame'],
  ['/game', 'i-game-icons-targeted', 'nav.inGame'], ['/overlay', 'i-game-icons-eye-target', 'nav.inGame'],
  ['/favorites', 'i-game-icons-star-formation', null], ['/settings', 'i-game-icons-cog', null],
]
const page = computed(() => PAGES.find(([path]) => route.path.startsWith(path)) ?? (route.path === '/' ? ['/', 'i-game-icons-castle', null] : null))
const section = computed(() => (page.value?.[2] ? t(page.value[2]) : null))
</script>

<template>
  <header class="space-y-5">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div class="min-w-0 flex-1">
        <p class="flex items-center gap-1 text-xs text-dimmed">
          <span>TrueMain</span>
          <template v-if="section">
            <UIcon name="i-lucide-chevron-right" class="size-3" />
            <span>{{ section }}</span>
          </template>
        </p>
        <h1 class="font-display mt-0.5 truncate text-2xl font-semibold leading-tight tracking-tight text-highlighted">
          {{ title }}<span v-if="suffix" class="ml-2 font-normal text-muted">{{ suffix }}</span>
        </h1>
        <p v-if="description" class="mt-1 max-w-3xl text-sm leading-snug text-muted">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <div v-if="$slots.tabs" class="flex gap-6 border-b border-default">
      <slot name="tabs" />
    </div>
    <slot />
  </header>
</template>
