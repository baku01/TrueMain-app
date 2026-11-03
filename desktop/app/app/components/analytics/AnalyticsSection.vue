<script setup lang="ts">
/**
 * One section of the Analytics page: a card with its title, the section's
 * content, or — when the source does not measure it — a line saying so,
 * rather than numbers borrowed from another source.
 */
defineProps<{ title: string, empty: boolean, source: string }>()
const { t } = useT()
</script>

<template>
  <section class="surface min-w-0 rounded-2xl p-4">
    <header class="mb-3 flex items-center gap-2">
      <h2 class="stat-label">{{ title }}</h2>
      <slot name="actions" />
    </header>
    <p v-if="empty" class="flex items-center gap-2 text-sm text-dimmed">
      <UIcon name="i-lucide-circle-slash" class="size-4 shrink-0" />{{ t('analytics.notFromSource', { source }) }}
    </p>
    <slot v-else />
  </section>
</template>
