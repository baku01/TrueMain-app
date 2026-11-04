<script setup lang="ts">
/**
 * The one page header of the desktop app: the page's icon in a tile, the
 * title, a line saying what the page is for, and the page's own controls on
 * the right (`#actions`) — every page opens the same way, at the same height.
 * What sits under the title row (filters, a search) goes in the default slot.
 * Replaces the shared layer's for this app only (a component of the app wins
 * over the layer's of the same name); the layer's props still work.
 */
defineProps<{
  /** Kept for the layer's callers; the icon tile now says what the eyebrow did. */
  eyebrow?: string
  title: string
  description?: string
  /** An `i-…` icon name; by default the page's own, as the side menu shows it. */
  icon?: string
}>()

/** Each page's icon, the side menu's (`AppNav`): the header shows the same one. */
const PAGE_ICONS: [string, string][] = [
  ['/champions', 'i-ph-sword-light'], ['/tierlist', 'i-ph-ranking-light'], ['/analytics', 'i-ph-chart-line-light'],
  ['/classes', 'i-ph-tree-structure-light'], ['/matchup', 'i-ph-scales-light'], ['/probuild', 'i-ph-trophy-light'],
  ['/kits', 'i-ph-backpack-light'], ['/items', 'i-ph-flask-light'], ['/patchnotes', 'i-ph-scroll-light'],
  ['/draft', 'i-ph-users-three-light'], ['/game', 'i-ph-crosshair-simple-light'], ['/overlay', 'i-ph-eye-light'],
  ['/favorites', 'i-ph-star-four-light'], ['/settings', 'i-ph-gear-six-light'],
]
const route = useRoute()
const pageIcon = computed(() => PAGE_ICONS.find(([path]) => route.path.startsWith(path))?.[1] ?? (route.path === '/' ? 'i-ph-castle-turret-light' : null))
</script>

<template>
  <header class="space-y-4">
    <div class="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-3">
      <span v-if="icon ?? pageIcon" class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
        <UIcon :name="(icon ?? pageIcon)!" class="size-5" />
      </span>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-[22px] font-semibold leading-tight tracking-tight text-highlighted">{{ title }}</h1>
        <p v-if="description" class="mt-0.5 truncate text-sm text-muted">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </header>
</template>
