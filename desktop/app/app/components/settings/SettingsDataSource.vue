<script setup lang="ts">
import { DATA_SOURCES } from '~/utils/data-source'

/**
 * Where builds, the tier list, the champions list and matchups come from:
 * every source at once, nothing to choose (`utils/data-source.ts`) — each
 * listed with what it brings, the merge's rule said once: no game counted
 * twice. TrueMain's own API is not among them.
 */
const { t } = useT()
</script>

<template>
  <section class="space-y-4 surface rounded-xl p-5">
    <header class="space-y-1">
      <div class="flex items-center gap-2">
        <UIcon name="i-ph-database-light" class="size-5 text-primary" />
        <h2 class="text-sm font-semibold text-highlighted">{{ t('source.title') }}</h2>
      </div>
      <p class="text-xs text-muted">{{ t('source.description') }}</p>
    </header>

    <ul class="grid gap-2 sm:grid-cols-2">
      <li v-for="source in DATA_SOURCES" :key="source" class="flex items-start gap-3 rounded-lg bg-accented/30 px-3 py-2.5">
        <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-primary" />
        <span class="min-w-0">
          <span class="block text-sm font-semibold text-highlighted">{{ t(`source.name.${source}`) }}</span>
          <span class="block text-xs text-muted">{{ t(`source.hint.${source}`) }}</span>
        </span>
      </li>
    </ul>
  </section>
</template>
