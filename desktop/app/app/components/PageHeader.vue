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
  ['/champions', 'i-tabler-swords', 'nav.group.champions'], ['/tierlist', 'i-tabler-chart-bar', 'nav.group.champions'],
  ['/analytics', 'i-tabler-chart-line', 'nav.group.champions'], ['/classes', 'i-tabler-hierarchy-2', 'nav.group.champions'],
  ['/matchup', 'i-tabler-scale', 'nav.group.champions'], ['/jev', 'i-tabler-sparkles', 'nav.group.champions'], ['/probuild', 'i-tabler-trophy', 'nav.group.builds'],
  ['/kits', 'i-tabler-backpack', 'nav.group.builds'], ['/items', 'i-tabler-flask', 'nav.group.builds'],
  ['/patchnotes', 'i-tabler-news', 'nav.group.builds'], ['/draft', 'i-tabler-users-group', 'nav.inGame'],
  ['/game', 'i-tabler-crosshair', 'nav.inGame'], ['/overlay', 'i-tabler-eye', 'nav.inGame'],
  ['/favorites', 'i-tabler-star', null], ['/settings', 'i-tabler-settings', null],
]
const page = computed(() => PAGES.find(([path]) => route.path.startsWith(path)) ?? (route.path === '/' ? ['/', 'i-tabler-home', null] : null))
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
