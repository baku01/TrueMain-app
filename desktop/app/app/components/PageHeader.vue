<script setup lang="ts">
/**
 * The one page header of the desktop app, on Blitz's pattern: the page's
 * emblem on the left; over the title a breadcrumb saying where the page sits
 * (section / page); the title in the display face, with an optional muted
 * qualifier after it; a line saying what the page is for; the page's own
 * controls on the right (`#actions`); and under it all the page's tabs
 * (`#tabs`, underlined) and its filter bar (default slot). Replaces the
 * shared layer's for this app only (a component of the app wins over the
 * layer's of the same name); the layer's props still work.
 */
const props = defineProps<{
  /** Kept for the layer's callers: the breadcrumb says what the eyebrow did. */
  eyebrow?: string
  title: string
  /** A qualifier after the title, in a quieter tone (`· Mestre+`). */
  suffix?: string
  description?: string
  /** An `i-…` icon name; by default the page's own, as the side menu shows it. */
  icon?: string
}>()

const { t } = useT()
const route = useRoute()

/** Each page's emblem and section, as the side menu files it (`AppNav`). */
const PAGES: [string, string, string | null][] = [
  ['/champions', 'i-ph-sword-light', 'nav.group.champions'], ['/tierlist', 'i-ph-ranking-light', 'nav.group.champions'],
  ['/analytics', 'i-ph-chart-line-light', 'nav.group.champions'], ['/classes', 'i-ph-tree-structure-light', 'nav.group.champions'],
  ['/matchup', 'i-ph-scales-light', 'nav.group.champions'], ['/probuild', 'i-ph-trophy-light', 'nav.group.builds'],
  ['/kits', 'i-ph-backpack-light', 'nav.group.builds'], ['/items', 'i-ph-flask-light', 'nav.group.builds'],
  ['/patchnotes', 'i-ph-scroll-light', 'nav.group.builds'], ['/draft', 'i-ph-users-three-light', 'nav.inGame'],
  ['/game', 'i-ph-crosshair-simple-light', 'nav.inGame'], ['/overlay', 'i-ph-eye-light', 'nav.inGame'],
  ['/favorites', 'i-ph-star-four-light', null], ['/settings', 'i-ph-gear-six-light', null],
]
const page = computed(() => PAGES.find(([path]) => route.path.startsWith(path)) ?? (route.path === '/' ? ['/', 'i-ph-castle-turret-light', null] : null))
const emblem = computed(() => props.icon ?? page.value?.[1] ?? null)
const section = computed(() => (page.value?.[2] ? t(page.value[2]) : null))
</script>

<template>
  <header class="space-y-5">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
      <span v-if="emblem" class="tm-emblem grid size-12 shrink-0 place-items-center rounded-xl text-primary">
        <UIcon :name="emblem" class="size-6" />
      </span>
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
