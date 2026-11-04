<script setup lang="ts">
/**
 * The desktop app's page header, compact as Blitz's: the eyebrow small over a
 * title sized for a pane rather than a landing page, the description beside
 * the title's weight. Replaces the shared layer's for this app only (a
 * component of the app wins over the layer's of the same name); the props
 * are the layer's.
 */
defineProps<{ eyebrow?: string, title: string, description?: string }>()
</script>

<template>
  <header class="space-y-3">
    <div class="space-y-0.5">
      <p v-if="eyebrow" class="text-xs font-medium text-primary">{{ eyebrow }}</p>
      <h1 class="text-xl font-semibold tracking-tight text-highlighted text-balance sm:text-2xl">{{ title }}</h1>
      <p v-if="description" class="text-sm text-muted">{{ description }}</p>
    </div>
    <slot />
  </header>
</template>
